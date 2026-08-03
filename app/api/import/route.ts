import { getDb } from "../../../db";
import { guard } from "../../../lib/auth";
import { checkIntegrity, dedupe, type ParsedEntry } from "../../../lib/parse/entry";
import { createWordbook } from "../../../lib/repo";
import { routeError } from "../../../lib/route-error";

export const dynamic = "force-dynamic";

/**
 * 表格与含文本层的 PDF 在浏览器端解析后，把结构化结果 POST 到这里。
 * 图片识别（M2）会走服务端异步任务，但落库仍复用本接口的逻辑。
 */
type ImportPayload = {
  name?: string;
  sourceType?: string;
  entries?: ParsedEntry[];
};

const ALLOWED_SOURCES = new Set(["xlsx", "csv", "pdf_text", "pdf_scan", "image"]);

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const payload = (await request.json()) as ImportPayload;
    const name = payload.name?.trim();
    const sourceType = payload.sourceType?.trim() ?? "";
    const raw = Array.isArray(payload.entries) ? payload.entries : [];

    if (!name) return Response.json({ error: "缺少词书名称" }, { status: 400 });
    if (!ALLOWED_SOURCES.has(sourceType)) {
      return Response.json({ error: `不支持的来源类型：${sourceType}` }, { status: 400 });
    }

    const entries = dedupe(raw.filter((e) => e && typeof e.word === "string" && e.word.trim()));
    if (entries.length === 0) {
      return Response.json({ error: "没有解析出任何词条" }, { status: 400 });
    }

    // 序号是完整性校验的凭据：断号即漏识别、重号即重复、越界即邻页混入。
    const report = checkIntegrity(entries);
    const { wordbookId, inserted } = await createWordbook(getDb(), {
      name,
      sourceType,
      entries,
    });

    return Response.json({ wordbookId, inserted, report }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
