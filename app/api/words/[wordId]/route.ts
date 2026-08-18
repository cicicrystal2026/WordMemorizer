import { and, eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { studyStates, wordDetails, words } from "../../../../db/schema";
import { guard } from "../../../../lib/auth";
import { DEFAULT_USER_ID } from "../../../../lib/constants";
import { routeError } from "../../../../lib/route-error";

export const dynamic = "force-dynamic";

/** 可由用户编辑的字段。识别结果与 AI 生成内容都在内——两者都可能错。 */
const WORD_FIELDS = ["word", "meaning", "isKey"] as const;
const DETAIL_FIELDS = ["phonetic", "phrase", "sentence", "translation", "rootHint"] as const;

export async function GET(_request: Request, ctx: { params: Promise<{ wordId: string }> }) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const wordId = Number((await ctx.params).wordId);
    if (!Number.isInteger(wordId)) return Response.json({ error: "词条不存在" }, { status: 404 });

    const db = getDb();
    const [row] = await db
      .select({
        wordId: words.id,
        seq: words.seq,
        word: words.word,
        pos: words.pos,
        meaning: words.meaning,
        isKey: words.isKey,
        needsReview: words.needsReview,
        confidence: words.confidence,
        mastery: studyStates.mastery,
        reviewCount: studyStates.reviewCount,
        dueAt: studyStates.dueAt,
      })
      .from(words)
      .innerJoin(studyStates, eq(studyStates.wordId, words.id))
      .where(and(eq(words.id, wordId), eq(studyStates.userId, DEFAULT_USER_ID)))
      .limit(1);

    if (!row) return Response.json({ error: "词条不存在" }, { status: 404 });

    const [detail] = await db
      .select()
      .from(wordDetails)
      .where(eq(wordDetails.wordId, wordId))
      .limit(1);

    return Response.json({
      word: { ...row, pos: safeParse(row.pos) },
      // M4 尚未接入时这里是 null，界面据此显示「待补全」而不是空白。
      detail: detail ?? null,
    });
  } catch (error) {
    return routeError(error);
  }
}

/**
 * 逐字段修改。用户改过的内容置 `edited_by_user`，M4 重新生成时不覆盖——
 * 对学习产品，能纠错比有免责声明重要得多。
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ wordId: string }> }) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const wordId = Number((await ctx.params).wordId);
    if (!Number.isInteger(wordId)) return Response.json({ error: "词条不存在" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const wordPatch = pick(body, WORD_FIELDS);
    const detailPatch = pick(body, DETAIL_FIELDS);

    if (Object.keys(wordPatch).length === 0 && Object.keys(detailPatch).length === 0) {
      return Response.json({ error: "没有可修改的字段" }, { status: 400 });
    }
    if (typeof wordPatch.word === "string" && wordPatch.word.trim() === "") {
      return Response.json({ error: "单词不能为空" }, { status: 400 });
    }

    const db = getDb();
    const [exists] = await db
      .select({ id: words.id })
      .from(words)
      .where(eq(words.id, wordId))
      .limit(1);
    if (!exists) return Response.json({ error: "词条不存在" }, { status: 404 });

    if (Object.keys(wordPatch).length > 0) {
      // 用户确认过的内容不再需要审核。
      await db
        .update(words)
        .set({ ...wordPatch, needsReview: false })
        .where(eq(words.id, wordId));
    }

    if (Object.keys(detailPatch).length > 0) {
      const now = new Date().toISOString();
      await db
        .insert(wordDetails)
        .values({ wordId, ...detailPatch, editedByUser: true, updatedAt: now })
        .onConflictDoUpdate({
          target: wordDetails.wordId,
          set: { ...detailPatch, editedByUser: true, updatedAt: now },
        });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}

/** 只取白名单内、且确实出现在请求体里的字段，避免把 undefined 写进库。 */
function pick<K extends readonly string[]>(
  body: Record<string, unknown>,
  keys: K,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" || typeof value === "boolean") out[key] = value;
  }
  return out;
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
