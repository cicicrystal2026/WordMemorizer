const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function extractJson(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("AI 未返回有效 JSON");
  return JSON.parse(match[0]);
}

exports.main = async (event) => {
  try {
    const items = Array.isArray(event.items) ? event.items.slice(0, 300) : [];
    const inputWords = items.map((item) => String(item.word || "").toLowerCase()).filter(Boolean);
    if (!inputWords.length) return { ok: false, message: "没有识别到英文单词" };
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
          temperature: 0,
          messages: [
            {
              role: "system",
              content: "你是高中英语词汇数据整理器。只返回 JSON 数组，不要 Markdown。输入有几个单词就必须返回几个，不得增加、删除、替换或纠正 word 字段。每项字段必须是 word, phonetic, partOfSpeech, meaning, phrase, sentence, translation, segments。释义和例句适合中国高一学生。无法确定的字段返回空字符串，不得猜测。"
            },
            { role: "user", content: JSON.stringify(inputWords) }
          ]
        })
      }
    );
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const payload = await response.json();
    const generated = extractJson(payload.choices?.[0]?.message?.content || "[]");
    const generatedByWord = new Map(generated.map((item) => [String(item.word || "").toLowerCase(), item]));
    const words = items.map((source) => {
      const word = String(source.word || "").toLowerCase();
      const generatedItem = generatedByWord.get(word) || {};
      return {
        word,
        phonetic: generatedItem.phonetic || "",
        partOfSpeech: generatedItem.partOfSpeech || "",
        meaning: generatedItem.meaning || "",
        phrase: generatedItem.phrase || "",
        sentence: generatedItem.sentence || "",
        translation: generatedItem.translation || "",
        segments: Array.isArray(generatedItem.segments) ? generatedItem.segments : [],
        confidence: source.confidence || 0,
        needsReview: Boolean(source.needsReview || !generatedByWord.has(word)),
        verified: false
      };
    });
    return { ok: true, words };
  } catch (error) {
    console.error("ENRICH_FAILED", error);
    return { ok: false, message: "AI 整理失败，原始 OCR 结果没有入库，请稍后重试" };
  }
};