const crypto = require("crypto");
const cloud = require("wx-server-sdk");
const tencentcloud = require("tencentcloud-sdk-nodejs-tts");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
async function synthesizeWithAzure(text, accent, rate) {
  const region = process.env.AZURE_SPEECH_REGION;
  const key = process.env.AZURE_SPEECH_KEY;
  if (!region || !key) throw new Error("Azure Speech 未配置");
  const voice = accent === "uk"
    ? (process.env.AZURE_TTS_UK_VOICE || "en-GB-SoniaNeural")
    : (process.env.AZURE_TTS_US_VOICE || "en-US-JennyNeural");
  const speed = Math.round((rate - 1) * 100);
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
      "User-Agent": "WordMemorizerMiniProgram"
    },
    body: `<speak version="1.0" xml:lang="en-US"><voice name="${voice}"><prosody rate="${speed}%">${escaped}</prosody></voice></speak>`
  });
  if (!response.ok) throw new Error(`Azure TTS HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeWithTencent(text, accent, rate, cacheKey) {
  const TtsClient = tencentcloud.tts.v20190823.Client;
  const client = new TtsClient({
    credential: { secretId: process.env.TENCENT_SECRET_ID, secretKey: process.env.TENCENT_SECRET_KEY },
    region: process.env.TENCENT_REGION || "ap-guangzhou",
    profile: { httpProfile: { endpoint: "tts.tencentcloudapi.com" } }
  });
  const response = await client.TextToVoice({
    Text: text,
    SessionId: cacheKey,
    ModelType: 1,
    VoiceType: accent === "uk" ? Number(process.env.TTS_UK_VOICE_TYPE || 501008) : Number(process.env.TTS_US_VOICE_TYPE || 501009),
    Codec: "mp3",
    SampleRate: 16000,
    Speed: Math.round((rate - 1) * 2),
    Volume: 5,
    PrimaryLanguage: 2
  });
  return Buffer.from(response.Audio, "base64");
}

exports.main = async (event) => {
  try {
    const text = String(event.text || "").trim().slice(0, 80);
    if (!text) return { ok: false, message: "缺少发音文本" };
    const accent = event.accent === "us" ? "us" : "uk";
    const rate = Math.max(0.6, Math.min(1.2, Number(event.rate) || 0.8));
    const cacheKey = crypto
      .createHash("sha1")
      .update(`${text}|${accent}|${rate}`)
      .digest("hex");
    const cloudPath = `word-audio/${cacheKey}.mp3`;
    const audio = process.env.AZURE_SPEECH_KEY
      ? await synthesizeWithAzure(text, accent, rate)
      : await synthesizeWithTencent(text, accent, rate, cacheKey);
    const upload = await cloud.uploadFile({
      cloudPath,
      fileContent: audio
    });
    return { ok: true, fileID: upload.fileID };
  } catch (error) {
    console.error("TTS_FAILED", error);
    return { ok: false, message: "单词发音生成失败" };
  }
};
