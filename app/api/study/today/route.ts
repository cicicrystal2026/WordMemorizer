import { getDb } from "../../../../db";
import { guard } from "../../../../lib/auth";
import { todayQueue } from "../../../../lib/repo";
import { routeError } from "../../../../lib/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await guard();
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const wordbookId = Number(url.searchParams.get("wordbookId")) || undefined;
    const dailyNew = Number(url.searchParams.get("dailyNew")) || 20;
    const limit = Number(url.searchParams.get("limit")) || 200;
    const queue = await todayQueue(getDb(), { wordbookId, dailyNew, limit });
    return Response.json({ queue, counts: {
      total: queue.length,
      newWords: queue.filter((q) => q.isNew).length,
      reviews: queue.filter((q) => !q.isNew).length,
    } });
  } catch (error) {
    return routeError(error);
  }
}
