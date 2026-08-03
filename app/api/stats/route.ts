import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "../../../db";
import { studyLogs, studyStates, words } from "../../../db/schema";
import { guard } from "../../../lib/auth";
import { DEFAULT_USER_ID, MASTERY, type Mastery } from "../../../lib/constants";
import { addDays } from "../../../lib/scheduler";
import { routeError } from "../../../lib/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  try {
    const db = getDb();

    const byMastery = await db
      .select({ mastery: studyStates.mastery, count: sql<number>`count(*)` })
      .from(studyStates)
      .where(eq(studyStates.userId, DEFAULT_USER_ID))
      .groupBy(studyStates.mastery);

    const distribution = Object.fromEntries(MASTERY.map((m) => [m, 0])) as Record<Mastery, number>;
    for (const row of byMastery) {
      if ((MASTERY as readonly string[]).includes(row.mastery)) {
        distribution[row.mastery as Mastery] = Number(row.count);
      }
    }

    const since = addDays(new Date(), -30);
    const daily = await db
      .select({
        day: sql<string>`substr(${studyLogs.answeredAt}, 1, 10)`,
        total: sql<number>`count(*)`,
        correct: sql<number>`sum(case when ${studyLogs.correct} then 1 else 0 end)`,
      })
      .from(studyLogs)
      .where(and(eq(studyLogs.userId, DEFAULT_USER_ID), gte(studyLogs.answeredAt, since)))
      .groupBy(sql`substr(${studyLogs.answeredAt}, 1, 10)`)
      .orderBy(sql`substr(${studyLogs.answeredAt}, 1, 10)`);

    // 错得最多的词，用于「查漏」场景。
    const troublesome = await db
      .select({
        word: words.word,
        meaning: words.meaning,
        misses: sql<number>`count(*)`,
      })
      .from(studyLogs)
      .innerJoin(words, eq(words.id, studyLogs.wordId))
      .where(and(eq(studyLogs.userId, DEFAULT_USER_ID), eq(studyLogs.correct, false)))
      .groupBy(words.id)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return Response.json({
      distribution,
      total: Object.values(distribution).reduce((a, b) => a + b, 0),
      daily: daily.map((d) => ({ ...d, total: Number(d.total), correct: Number(d.correct) })),
      streak: computeStreak(daily.map((d) => d.day)),
      troublesome: troublesome.map((t) => ({ ...t, misses: Number(t.misses) })),
    });
  } catch (error) {
    return routeError(error);
  }
}

/** 连续学习天数：从今天（或昨天）往回数不间断的日子。 */
function computeStreak(days: string[]): number {
  const set = new Set(days);
  const now = new Date();
  // 今天还没学不算断，从昨天起算。
  let cursor = set.has(addDays(now, 0)) ? 0 : -1;
  let streak = 0;
  while (set.has(addDays(now, cursor))) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
