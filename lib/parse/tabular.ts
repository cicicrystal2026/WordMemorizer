import type { ParsedEntry } from "./entry";
import { normalizePos, parseEntryLine } from "./entry";

/**
 * 表格解析在浏览器端进行：SheetJS 一类的库体积很大，塞进 Worker 会顶到
 * 体积上限，而表格是纯计算、文件本来就在用户手上，客户端做更快也更省。
 */

export type Column = "seq" | "word" | "pos" | "meaning" | "ignore";
export type ColumnMapping = Column[];

const CJK = /[一-鿿　-〿＀-￯]/;
const ASCII_WORD = /^[A-Za-z][A-Za-z\-'’ ]*$/;
const POS_ONLY = /^(?:n|v|vt|vi|adj|adv|a|ad|prep|pron|conj|int|num|art|aux)[.&,/\s]*$/i;

export async function readCsv(file: File): Promise<string[][]> {
  const text = await file.text();
  return parseCsv(text);
}

/** 支持引号包裹、字段内换行与转义双引号。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export async function readXlsx(file: File): Promise<string[][]> {
  // 该包没有根导出，必须走子路径；浏览器端解析用 /browser。
  // 默认导出返回的是工作表数组，取行要用 readSheet。
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return rows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))),
  );
}

export async function readTable(file: File): Promise<string[][]> {
  return file.name.toLowerCase().endsWith(".csv") ? readCsv(file) : readXlsx(file);
}

/**
 * 表格解析的真正难点不是读取，而是列语义不确定。这里按内容特征给出猜测，
 * 最终仍需用户在界面上确认一次。
 */
export function inferMapping(rows: string[][]): ColumnMapping {
  const sample = rows.slice(0, 20);
  const width = Math.max(...sample.map((r) => r.length), 0);
  const mapping: ColumnMapping = [];

  for (let col = 0; col < width; col += 1) {
    const cells = sample.map((r) => (r[col] ?? "").trim()).filter(Boolean);
    if (cells.length === 0) {
      mapping.push("ignore");
      continue;
    }
    const ratio = (test: (c: string) => boolean) =>
      cells.filter(test).length / cells.length;

    if (ratio((c) => /^\d{1,4}$/.test(c)) > 0.8) mapping.push("seq");
    else if (ratio((c) => POS_ONLY.test(c)) > 0.6) mapping.push("pos");
    else if (ratio((c) => ASCII_WORD.test(c)) > 0.7) mapping.push("word");
    else if (ratio((c) => CJK.test(c)) > 0.7) mapping.push("meaning");
    else mapping.push("ignore");
  }

  // 一列都没认出单词时，退回到「整行当作一条词条文本」的模式。
  if (!mapping.includes("word")) return mapping.map(() => "ignore");
  return mapping;
}

/** 首行若不含可解析的词形，视为表头。 */
export function looksLikeHeader(row: string[], mapping: ColumnMapping): boolean {
  const wordCol = mapping.indexOf("word");
  if (wordCol < 0) return false;
  const cell = (row[wordCol] ?? "").trim();
  return !cell || !ASCII_WORD.test(cell);
}

export function rowsToEntries(rows: string[][], mapping: ColumnMapping): ParsedEntry[] {
  const usable = mapping.includes("word");
  const body = rows.length && looksLikeHeader(rows[0], mapping) ? rows.slice(1) : rows;
  const entries: ParsedEntry[] = [];

  for (const row of body) {
    if (!usable) {
      // 没有可用的列映射时，把整行拼起来按「序号. 单词 词性.释义」解析。
      const parsed = parseEntryLine(row.join(" ").trim());
      if (parsed) entries.push(parsed);
      continue;
    }

    const pick = (kind: Column) => {
      const idx = mapping.indexOf(kind);
      return idx < 0 ? "" : (row[idx] ?? "").trim();
    };

    const word = pick("word");
    if (!word || !ASCII_WORD.test(word)) continue;

    const seqRaw = pick("seq");
    const posRaw = pick("pos");
    const meaningRaw = pick("meaning");

    // 释义列里可能还内嵌着词性，如 `v.积累`。
    const inlined = posRaw ? null : parseEntryLine(`${word} ${meaningRaw}`);

    entries.push({
      seq: /^\d+$/.test(seqRaw) ? Number(seqRaw) : null,
      word,
      pos: posRaw ? normalizePos(posRaw) : (inlined?.pos ?? []),
      meaning: (inlined ? inlined.meaning : meaningRaw).trim(),
      isKey: false,
      confidence: null,
    });
  }

  return entries;
}
