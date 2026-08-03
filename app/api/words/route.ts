import { and, asc, eq, type SQL } from "drizzle-orm";

import { getDb } from "../../../db";
import { studyStates, words } from "../../../db/schema";
import { guard } from "../../../lib/auth";
import { DEFAULT_USER_ID, MASTERY, type Mastery } from "../../../lib/constants";
import { routeError } from "../../../lib/route-error";

export const dynamic = "force-dynamic";

/** 词库列表，支持按重点词、学习状态、掌握度筛选。 */
export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const wordbookId = Number(url.searchParams.get("wordbookId")) || undefined;
    const filter = url.searchParams.get("filter") ?? "all";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);

    const conditions: SQL[] = [eq(studyStates.userId, DEFAULT_USER_ID)];
    if (wordbookId) conditions.push(eq(words.wordbookId, wordbookId));
    if (filter === "key") conditions.push(eq(words.isKey, true));
    else if (filter === "review") conditions.push(eq(words.needsReview, true));
    else if ((MASTERY as readonly string[]).includes(filter)) {
      conditions.push(eq(studyStates.mastery, filter as Mastery));
    }

    const rows = await getDb()
      .select({
        wordId: words.id,
        seq: words.seq,
        word: words.word,
        pos: words.pos,
        meaning: words.meaning,
        isKey: words.isKey,
        needsReview: words.needsReview,
        mastery: studyStates.mastery,
        reviewCount: studyStates.reviewCount,
        dueAt: studyStates.dueAt,
      })
      .from(words)
      .innerJoin(studyStates, eq(studyStates.wordId, words.id))
      .where(and(...conditions))
      .orderBy(asc(words.seq), asc(words.id))
      .limit(limit);

    return Response.json({
      words: rows.map((r) => ({ ...r, pos: safeParse(r.pos) })),
    });
  } catch (error) {
    return routeError(error);
  }
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
