const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs-ocr");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  try {
    if (!event.fileID) return { ok: false, message: "缺少图片文件" };
    const file = await cloud.downloadFile({ fileID: event.fileID });
    const OcrClient = tencentcloud.ocr.v20181119.Client;
    const client = new OcrClient({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID,
        secretKey: process.env.TENCENT_SECRET_KEY
      },
      region: process.env.TENCENT_REGION || "ap-guangzhou",
      profile: {
        httpProfile: { endpoint: "ocr.tencentcloudapi.com" }
      }
    });
    const response = await client.EnglishOCR({
      ImageBase64: file.fileContent.toString("base64")
    });
    const text = (response.TextDetections || [])
      .map((item) => item.DetectedText)
      .join("\n");
    const lines = text
      .split(/\r?\n/)
      .flatMap((line) => line.match(/[A-Za-z][A-Za-z'-]{1,30}/g) || [])
      .map((word) => word.toLowerCase());
    return { ok: true, lines: [...new Set(lines)] };
  } catch (error) {
    console.error("OCR_FAILED", error);
    return { ok: false, message: "图片文字识别失败，请换一张更清晰的图片" };
  }
};
