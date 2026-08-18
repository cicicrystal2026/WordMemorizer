import { and, desc, eq } from "drizzle-orm";

import { getDb } from "../../../../db";
import { plans, wordbooks } from "../../../../db/schema";
import { guard } from "../../../../lib/auth";
import { DEFAULT_USER_ID } from "../../../../lib/constants";
import { forecastLoad, requiredDailyNew, today } from "../../../../lib/scheduler";
import { routeError } from "../../../../lib/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  try {
    const db = getDb();
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, DEFAULT_USER_ID), eq(plans.status, "active")))
      .orderBy(desc(plans.createdAt))
      .limit(1);

    if (!plan) return Response.json({ plan: null });

    const [book] = await db.select().from(wordbooks).where(eq(wordbooks.id, plan.wordbookId));
    const total = book?.totalWords ?? 0;
    const days = Math.max(
      Math.round(
        (Date.parse(`${plan.targetDate}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000,
      ),
      1,
    );
    const forecast = forecastLoad(total, plan.dailyNew, Math.min(days, 60));

    return Response.json({
      plan,
      wordbook: book ?? null,
      daysLeft: days,
      minimumDailyNew: requiredDailyNew(total, days),
      peakLoad: forecast.length ? Math.max(...forecast.map((p) => p.newWords + p.reviews)) : 0,
      forecast,
    });
  } catch (error) {
    return routeError(error);
  }
}
