import { authDisabled, createSession, destroySession, isAuthenticated, verifyPasscode } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ authenticated: await isAuthenticated(), required: !authDisabled() });
}

export async function POST(request: Request) {
  const { passcode } = (await request.json()) as { passcode?: string };
  if (!(await verifyPasscode(passcode ?? ""))) {
    return Response.json({ error: "口令不正确" }, { status: 401 });
  }
  await createSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
