import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "./constants";

/**
 * 只给自家孩子用，但部署在公网域名上——上传识别与发音评测都是按次计费的
 * 外部调用，裸奔等于让任何人花我们的钱。因此仍需一道口令。
 *
 * 口令通过环境变量 APP_PASSCODE 配置。未配置时放行，便于本地开发。
 */
function passcode(): string | undefined {
  return process.env.APP_PASSCODE?.trim() || undefined;
}

export function authDisabled(): boolean {
  return passcode() === undefined;
}

/**
 * 会话令牌 = 口令的 SHA-256。口令本身不进 Cookie，改口令后旧会话自动失效。
 */
async function tokenFor(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`wm:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPasscode(input: string): Promise<boolean> {
  const expected = passcode();
  if (!expected) return true;
  // 长度不同直接失败；长度相同时逐字符异或累加，避免按位置提前返回。
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < input.length; i += 1) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function isAuthenticated(): Promise<boolean> {
  const expected = passcode();
  if (!expected) return true;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return Boolean(token) && token === (await tokenFor(expected));
}

export async function createSession(): Promise<void> {
  const expected = passcode();
  if (!expected) return;
  const store = await cookies();
  store.set(SESSION_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** API 路由的守卫：未通过时返回 401，通过时返回 null。 */
export async function guard(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return Response.json({ error: "未授权" }, { status: 401 });
}
