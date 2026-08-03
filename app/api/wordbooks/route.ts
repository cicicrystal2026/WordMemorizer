import { getDb } from "../../../db";
import { guard } from "../../../lib/auth";
import { listWordbooks } from "../../../lib/repo";
import { routeError } from "../../../lib/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return Response.json({ wordbooks: await listWordbooks(getDb()) });
  } catch (error) {
    return routeError(error);
  }
}
