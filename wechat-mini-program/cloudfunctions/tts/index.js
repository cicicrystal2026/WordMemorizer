const crypto = require("crypto");
const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs-tts");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function synthesize(text, rate, cacheKey) {
  const TtsClient = tencentcloud.tts.v20190823.Client;
  const client = new TtsClient({
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY
    },
    region: process.env.TENCENT_REGION || "ap-guangzhou",
    profile: { httpProfile: { endpoint: "tts.tencentcloudapi.com" } }
  });
  const response = await client.TextToVoice({
    Text: text,
    SessionId: cacheKey,
    ModelType: 1,
    VoiceType: Number(process.env.TTS_GAOKAO_VOICE_TYPE || 101050),
    Codec: "mp3",
    SampleRate: 16000,
    Speed: rate <= 0.8 ? -1 : 0,
    Volume: 5,
    PrimaryLanguage: 2
  });
  return Buffer.from(response.Audio, "base64");
}

exports.main = async (event) => {
  try {
    const text = String(event.text || "").trim().slice(0, 80);
    if (!text) return { ok: false, message: "缺少发音文本" };
    const rate = Math.max(0.6, Math.min(1, Number(event.rate) || 0.8));
    const cacheKey = crypto.createHash("sha1").update(`${text}|gaokao|${rate}`).digest("hex");
    const cloudPath = `word-audio/gaokao-${cacheKey}.mp3`;
    const audio = await synthesize(text, rate, cacheKey);
    const upload = await cloud.uploadFile({ cloudPath, fileContent: audio });
    return { ok: true, fileID: upload.fileID, voiceStyle: "gaokao-standard" };
  } catch (error) {
    console.error("TTS_FAILED", error);
    return { ok: false, message: "单词发音生成失败" };
  }
};