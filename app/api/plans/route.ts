import { getDb } from "../../../db";
import { plans } from "../../../db/schema";
import { guard } from "../../../lib/auth";
import { DEFAULT_USER_ID, MAX_INTERVAL } from "../../../lib/constants";
import { forecastLoad, requiredDailyNew, today } from "../../../lib/scheduler";
import { ensureUser } from "../../../lib/repo";
import { routeError } from "../../../lib/route-error";

export const dynamic = "force-dynamic";

/**
 * 用户输入的是「什么时候背完」，每日新词量由系统倒算——而不是让用户填
 * 每日新词量，因为那个数字只是新词，实际单日负荷还要加上累积的复习。
 */
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const { wordbookId, targetDate, totalWords, dailyNew } = (await request.json()) as {
      wordbookId?: number;
      targetDate?: string;
      totalWords?: number;
      dailyNew?: number;
    };
    if (!wordbookId || !targetDate || !totalWords) {
      return Response.json({ error: "缺少 wordbookId / targetDate / totalWords" }, { status: 400 });
    }

    const days = Math.round(
      (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000,
    );
    if (!Number.isFinite(days) || days < 1) {
      return Response.json({ error: "目标日期必须晚于今天" }, { status: 400 });
    }

    const minimum = requiredDailyNew(totalWords, days);
    const chosen = Math.max(dailyNew ?? minimum, 1);
    const forecast = forecastLoad(totalWords, chosen, days);
    const spillover = chosen < minimum;

    await ensureUser(getDb());
    const [plan] = await getDb()
      .insert(plans)
      .values({ userId: DEFAULT_USER_ID, wordbookId, targetDate, dailyNew: chosen })
      .returning();

    return Response.json(
      {
        plan,
        minimumDailyNew: minimum,
        peakLoad: Math.max(...forecast.map((p) => p.newWords + p.reviews)),
        forecast,
        warning: spillover
          ? `按每天 ${chosen} 个，到 ${targetDate} 会有复习做不完。最长复习间隔为 ${MAX_INTERVAL} 天，建议每天至少 ${minimum} 个。`
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
