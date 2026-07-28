const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function extractJson(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("AI 未返回有效 JSON");
  return JSON.parse(match[0]);
}

exports.main = async (event) => {
  try {
    const lines = Array.isArray(event.lines) ? event.lines.slice(0, 200) : [];
    if (!lines.length) return { ok: false, message: "没有识别到英文单词" };
    const response = await fetch(
      process.env.HUNYUAN_BASE_URL || "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.HUNYUAN_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.HUNYUAN_MODEL || "hunyuan-turbos-latest",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "你是高中英语词汇老师。只返回 JSON 数组，不要 Markdown。每项字段必须是 word, phonetic, partOfSpeech, meaning, phrase, sentence, translation, segments。释义和例句适合中国高一学生，segments 是用于显示的词根或音节字符串数组。删除明显不是英文单词的内容并去重。"
            },
            {
              role: "user",
              content: `整理这些词：${lines.join(", ")}`
            }
          ]
        })
      }
    );
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const payload = await response.json();
    const words = extractJson(payload.choices?.[0]?.message?.content || "[]");
    return { ok: true, words };
  } catch (error) {
    console.error("ENRICH_FAILED", error);
    return { ok: false, message: "AI 整理单词失败，请稍后重试" };
  }
};
