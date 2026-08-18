/**
 * 词条的中间结构。三条导入路径（表格 / PDF 文本层 / 图片识别）都汇聚到这里，
 * 后续入库与校验流程共用。
 */
export type ParsedEntry = {
  /** 材料上的原始序号。保留它才能做断号、重号、越界的完整性校验。 */
  seq: number | null;
  word: string;
  /** 归一化词性，如 ["v","n"] */
  pos: string[];
  meaning: string;
  /** 手写圈注识别结果；表格与 PDF 文本层没有这个信号 */
  isKey: boolean;
  confidence: number | null;
};

const POS_ALIAS: Record<string, string> = {
  n: "n", v: "v", vt: "vt", vi: "vi",
  adj: "adj", a: "adj",
  adv: "adv", ad: "adv",
  prep: "prep", pron: "pron", conj: "conj",
  int: "int", num: "num", art: "art",
  aux: "aux", modal: "aux", abbr: "abbr",
};

const POS_TOKEN = "(?:modal|prep|pron|conj|abbr|adj|adv|art|aux|num|int|vt|vi|ad|n|v|a)";
/** 词性串，如 `v.` `n./v.` `adj.&n.`，允许多个连写。 */
const POS_RUN = new RegExp(`^\\s*(?:${POS_TOKEN}[.&,/\\s]*)+`, "i");
/** 释义中途重新标注词性，如 `个人 adj.个体的` */
const SENSE_SPLIT = new RegExp(`(${POS_TOKEN}(?:\\s*[&/]\\s*${POS_TOKEN})*\\.)`, "gi");
const LEADING_SEQ = /^\s*(\d{1,4})\s*[.、)]\s*/;
/**
 * 只取单个 token。允许跨空格取第二个词会把紧随其后的词性一并吞掉
 * （`accumulate v.` 会整个被当成词形），而这份材料没有多词条目。
 */
const HEADWORD = /^[A-Za-z][A-Za-z\-'’]*/;

export function normalizePos(raw: string): string[] {
  const found = raw.toLowerCase().match(new RegExp(POS_TOKEN, "g")) ?? [];
  const mapped = found.map((t) => POS_ALIAS[t]).filter(Boolean);
  return [...new Set(mapped)];
}

/**
 * 解析一行词条，如 `176. individual n.个人 adj.个体的`。
 * 无法识别出词形时返回 null，由调用方决定丢弃还是送人工审核。
 */
export function parseEntryLine(line: string): ParsedEntry | null {
  let rest = line.replace(/\s+/g, " ").trim();
  if (!rest) return null;

  let seq: number | null = null;
  const seqMatch = rest.match(LEADING_SEQ);
  if (seqMatch) {
    seq = Number(seqMatch[1]);
    rest = rest.slice(seqMatch[0].length);
  }

  const headMatch = rest.match(HEADWORD);
  if (!headMatch) return null;
  const word = headMatch[0].trim();
  rest = rest.slice(headMatch[0].length).trim();

  const posMatch = rest.match(POS_RUN);
  const posRun = posMatch ? posMatch[0] : "";
  const meaning = (posMatch ? rest.slice(posMatch[0].length) : rest).trim();

  return {
    seq,
    word,
    pos: normalizePos(posRun),
    meaning: meaning.replace(/^[.、,，;；]+/, "").trim(),
    isKey: false,
    confidence: null,
  };
}

/** 把 `个人 adj.个体的` 拆成带词性的义项，供出题时使用。 */
export function splitSenses(
  meaning: string,
  entryPos: string[],
): { pos: string[]; text: string }[] {
  const parts = meaning.split(SENSE_SPLIT).filter((p) => p !== undefined);
  const senses: { pos: string[]; text: string }[] = [];
  let pending: string[] = [];

  for (const chunk of parts) {
    if (new RegExp(`^${POS_TOKEN}(?:\\s*[&/]\\s*${POS_TOKEN})*\\.$`, "i").test(chunk.trim())) {
      pending = normalizePos(chunk);
      continue;
    }
    const text = chunk.replace(/^[\s.、,，;；]+|[\s、,，;；]+$/g, "");
    if (!text) continue;
    // 首个义项不带自己的标记时，继承词条的主词性。
    senses.push({ pos: pending.length ? pending : senses.length === 0 ? entryPos.slice(0, 1) : [], text });
    pending = [];
  }
  return senses;
}

/** 完整性校验报告。序号连续是这份材料的特性，缺失时降级为条数统计。 */
export type IntegrityReport = {
  total: number;
  duplicates: number[];
  gaps: number[];
  hasSeq: boolean;
  min: number | null;
  max: number | null;
};

export function checkIntegrity(entries: ParsedEntry[]): IntegrityReport {
  const seqs = entries.map((e) => e.seq).filter((s): s is number => s !== null);
  if (seqs.length === 0) {
    return { total: entries.length, duplicates: [], gaps: [], hasSeq: false, min: null, max: null };
  }

  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const s of seqs) {
    if (seen.has(s)) duplicates.add(s);
    seen.add(s);
  }

  const min = Math.min(...seqs);
  const max = Math.max(...seqs);
  const gaps: number[] = [];
  for (let i = min; i <= max; i += 1) {
    if (!seen.has(i)) gaps.push(i);
  }

  return {
    total: entries.length,
    duplicates: [...duplicates].sort((a, b) => a - b),
    gaps,
    hasSeq: true,
    min,
    max,
  };
}

/** 去重：同序号保留置信度更高的一条。 */
export function dedupe(entries: ParsedEntry[]): ParsedEntry[] {
  const bySeq = new Map<number, ParsedEntry>();
  const withoutSeq: ParsedEntry[] = [];

  for (const entry of entries) {
    if (entry.seq === null) {
      withoutSeq.push(entry);
      continue;
    }
    const prev = bySeq.get(entry.seq);
    if (!prev || (entry.confidence ?? 0) > (prev.confidence ?? 0)) {
      bySeq.set(entry.seq, entry);
    }
  }

  const ordered = [...bySeq.values()].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  return [...ordered, ...withoutSeq];
}
