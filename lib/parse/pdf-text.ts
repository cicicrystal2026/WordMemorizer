import type { ParsedEntry } from "./entry";
import { parseEntryLine } from "./entry";

/**
 * PDF 必须先探测文本层：有文本层就直接抽取，零 AI 成本、准确率接近 100%。
 * 把有文本层的 PDF 当图片喂给多模态模型是纯粹的浪费——本项目的 3500 词
 * 底库正是这样处理的，43 页几秒完成。
 *
 * 无文本层（扫描件）才降级为渲染成图片走视觉路径（M2）。
 */

export type PdfExtraction = {
  hasTextLayer: boolean;
  pageCount: number;
  /** 逐页的文本行 */
  pages: string[][];
};

/** 文本层判定阈值：平均每页少于这个字符数就当作扫描件。 */
const MIN_CHARS_PER_PAGE = 40;

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text, totalPages } = await extractText(pdf, { mergePages: false });

  const pages = (Array.isArray(text) ? text : [text]).map(splitLines);
  const totalChars = pages.reduce((sum, lines) => sum + lines.join("").length, 0);

  return {
    hasTextLayer: totalPages > 0 && totalChars / totalPages >= MIN_CHARS_PER_PAGE,
    pageCount: totalPages,
    pages,
  };
}

function splitLines(pageText: string): string[] {
  return pageText
    .split(/\r?\n/)
    .map((l) => l.replace(/​/g, "").trim())
    .filter(Boolean);
}

/**
 * 双栏排版下，PDF 文本层通常已按阅读顺序输出；序号是最终的校验凭据，
 * 顺序错乱会在完整性校验中以断号或非递增的形式暴露出来。
 */
export function pagesToEntries(pages: string[][]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const lines of pages) {
    for (const line of lines) {
      // 跳过页眉页脚：纯数字的页码、以及不含任何字母的装饰行。
      if (/^\d{1,4}$/.test(line)) continue;
      if (!/[A-Za-z]/.test(line)) continue;
      const parsed = parseEntryLine(line);
      if (parsed) entries.push(parsed);
    }
  }
  return entries;
}
