export type ImportedWord = {
  word: string;
  meaning: string;
  partOfSpeech: string;
  phonetic: string;
  phrase: string;
  sentence: string;
  translation: string;
};

export type ImportProgress = {
  label: string;
  percent: number;
};

const WORD_PATTERN = /^[a-z][a-z'-]{1,30}$/i;
const HEADER_WORDS = new Set(["word", "words", "english", "单词", "英文"]);

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) {
    return String((value as { text?: unknown }).text ?? "").trim();
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function makeWord(parts: string[]): ImportedWord | null {
  const word = cleanCell(parts[0]).toLowerCase();
  if (!WORD_PATTERN.test(word) || HEADER_WORDS.has(word)) return null;
  const meaning = cleanCell(parts[1]) || "待补充释义";
  const third = cleanCell(parts[2]);
  const thirdIsPartOfSpeech = /^(n|v|vt|vi|adj|adv|prep|pron|conj|num|art|aux|modal|interj)\.?([ /,&]+(n|v|vt|vi|adj|adv)\.?)?$/i.test(third);
  const offset = thirdIsPartOfSpeech ? 1 : 0;
  return {
    word,
    meaning,
    partOfSpeech: thirdIsPartOfSpeech ? third : cleanCell(parts[6]) || "词性待补充",
    phonetic: cleanCell(parts[2 + offset]),
    phrase: cleanCell(parts[3 + offset]),
    sentence: cleanCell(parts[4 + offset]) || `I am learning the word "${word}".`,
    translation: cleanCell(parts[5 + offset]) || `我正在学习单词“${word}”。`,
  };
}

export function parseWordRows(rows: unknown[][]): ImportedWord[] {
  const seen = new Set<string>();
  const result: ImportedWord[] = [];

  for (const row of rows) {
    const item = makeWord(row.map(cleanCell));
    if (item && !seen.has(item.word)) {
      seen.add(item.word);
      result.push(item);
    }
  }
  return result;
}

export function parseWordText(text: string): ImportedWord[] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const separated = line.split(/\s*[,，\t|｜]\s*/).filter(Boolean);
    if (separated.length > 1) {
      rows.push(separated);
      continue;
    }

    const paired = line.match(/^([a-z][a-z'-]{1,30})\s{2,}(.+)$/i);
    if (paired) {
      rows.push([paired[1], paired[2]]);
      continue;
    }

    const tokens = line.match(/\b[a-z][a-z'-]{1,30}\b/gi);
    if (tokens?.length === 1) rows.push([tokens[0]]);
    else if (tokens && tokens.length > 1 && tokens.length <= 8) {
      tokens.forEach((token) => rows.push([token]));
    }
  }
  return parseWordRows(rows);
}

async function readExcel(file: File): Promise<ImportedWord[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const rows: unknown[][] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      rows.push((row.values as unknown[]).slice(1));
    });
  });
  return parseWordRows(rows);
}

async function readWord(file: File): Promise<ImportedWord[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return parseWordText(result.value);
}

async function readImage(
  file: File,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportedWord[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+chi_sim", 1, {
    logger(message) {
      const progress = typeof message.progress === "number" ? message.progress : 0;
      onProgress({
        label: message.status === "recognizing text" ? "正在识别图片文字" : "正在准备识别引擎",
        percent: Math.max(8, Math.round(progress * 100)),
      });
    },
  });
  try {
    const result = await worker.recognize(file);
    return parseWordText(result.data.text);
  } finally {
    await worker.terminate();
  }
}

export async function parseWordFile(
  file: File,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportedWord[]> {
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("文件超过 12MB，请压缩图片或拆分词表后重试。");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  onProgress({ label: "正在读取文件", percent: 5 });

  if (["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return readImage(file, onProgress);
  }
  if (extension === "xlsx") {
    onProgress({ label: "正在解析 Excel", percent: 35 });
    return readExcel(file);
  }
  if (extension === "docx") {
    onProgress({ label: "正在解析 Word", percent: 35 });
    return readWord(file);
  }
  if (extension === "doc" || extension === "xls") {
    throw new Error("旧版 .doc/.xls 暂不支持，请在 Word 或 Excel 中另存为 .docx/.xlsx。");
  }
  if (["txt", "csv", "tsv"].includes(extension)) {
    onProgress({ label: "正在解析文本", percent: 55 });
    return parseWordText(await file.text());
  }
  throw new Error("支持图片、.xlsx、.docx、.txt、.csv 文件。");
}
