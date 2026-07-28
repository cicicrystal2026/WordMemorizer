const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs-ocr");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function tokensFromDetections(detections, source) {
  return (detections || []).flatMap((detection) => {
    const confidence = Number(detection.Confidence ?? detection.ConfidenceScore ?? 100);
    const words = String(detection.DetectedText || "").match(/[A-Za-z][A-Za-z'-]{1,30}/g) || [];
    return words.map((word) => ({ word: word.toLowerCase(), confidence, source }));
  });
}

exports.main = async (event) => {
  try {
    if (!event.fileID) return { ok: false, message: "缺少图片文件" };
    const file = await cloud.downloadFile({ fileID: event.fileID });
    const imageBase64 = file.fileContent.toString("base64");
    const OcrClient = tencentcloud.ocr.v20181119.Client;
    const client = new OcrClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY
      },
      region: process.env.TENCENT_REGION || "ap-guangzhou",
      profile: { httpProfile: { endpoint: "ocr.tencentcloudapi.com" } }
    });
    const [accurate, english] = await Promise.all([
      client.GeneralAccurateOCR({ ImageBase64: imageBase64, LanguageType: "en" }),
      client.EnglishOCR({ ImageBase64: imageBase64 })
    ]);
    const accurateTokens = tokensFromDetections(accurate.TextDetections, "accurate");
    const englishTokens = tokensFromDetections(english.TextDetections, "english");
    const grouped = new Map();
    for (const token of [...accurateTokens, ...englishTokens]) {
      const current = grouped.get(token.word) || { word: token.word, confidences: [], sources: new Set() };
      current.confidences.push(token.confidence);
      current.sources.add(token.source);
      grouped.set(token.word, current);
    }
    const items = [...grouped.values()].map((item) => {
      const confidence = Math.round(item.confidences.reduce((sum, value) => sum + value, 0) / item.confidences.length);
      return {
        word: item.word,
        confidence,
        matchedByBoth: item.sources.size === 2,
        needsReview: item.sources.size !== 2 || confidence < 90
      };
    });
    return {
      ok: true,
      items,
      audit: {
        accurateCount: accurateTokens.length,
        englishCount: englishTokens.length,
        uncertainCount: items.filter((item) => item.needsReview).length
      }
    };
  } catch (error) {
    console.error("OCR_FAILED", error);
    return { ok: false, message: "图片识别失败，请保证照片清晰、完整、无反光后重试" };
  }
};