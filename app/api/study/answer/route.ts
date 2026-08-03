import { and, eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { studyLogs, studyStates } from "../../../../db/schema";
import { guard } from "../../../../lib/auth";
import { DEFAULT_USER_ID, MASTERY, type Mastery, type Stage } from "../../../../lib/constants";
import { addDays, overrideMastery, review } from "../../../../lib/scheduler";
import { routeError } from "../../../../lib/route-error";

export const dynamic = "force-dynamic";

const STAGES = new Set<Stage>(["recognize", "shadow", "meaning", "spell", "cloze"]);

type AnswerPayload = {
  wordId?: number;
  stage?: Stage;
  correct?: boolean;
  /** 手动改判掌握度——算法判错时用户的逃生阀 */
  override?: Mastery;
};

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const { wordId, stage, correct, override } = (await request.json()) as AnswerPayload;
    if (!wordId) return Response.json({ error: "缺少 wordId" }, { status: 400 });

    const db = getDb();
    const [state] = await db
      .select()
      .from(studyStates)
      .where(and(eq(studyStates.userId, DEFAULT_USER_ID), eq(studyStates.wordId, wordId)));
    if (!state) return Response.json({ error: "词条不存在" }, { status: 404 });

    const current = {
      mastery: state.mastery as Mastery,
      ease: state.ease,
      interval: state.interval,
      reviewCount: state.reviewCount,
    };

    let next;
    if (override) {
      if (!MASTERY.includes(override)) {
        return Response.json({ error: `无效的掌握度：${override}` }, { status: 400 });
      }
      next = overrideMastery(current, override);
    } else {
      if (!stage || !STAGES.has(stage)) {
        return Response.json({ error: "缺少有效的 stage" }, { status: 400 });
      }
      next = review(current, correct === true);
      await db.insert(studyLogs).values({
        userId: DEFAULT_USER_ID,
        wordId,
        stage,
        correct: correct === true,
      });
    }

    const now = new Date();
    await db
      .update(studyStates)
      .set({
        mastery: next.mastery,
        ease: next.ease,
        interval: next.interval,
        reviewCount: next.reviewCount,
        dueAt: addDays(now, next.interval),
        lastStudiedAt: now.toISOString(),
      })
      .where(and(eq(studyStates.userId, DEFAULT_USER_ID), eq(studyStates.wordId, wordId)));

    return Response.json({ state: next, dueAt: addDays(now, next.interval) });
  } catch (error) {
    return routeError(error);
  }
}
