/**
 * 数据库表或连接缺失是部署最常见的遗漏。单独给一条可操作的提示，避免把
 * Drizzle 的整段 SQL 回传给用户。
 */
export function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "未知错误";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${cause}`;

  if (combined.includes("no such table") || (combined.includes("relation") && combined.includes("does not exist"))) {
    return Response.json(
      {
        error:
          "数据表尚未创建。请先将 drizzle-pg 中的迁移应用到 Neon 数据库。",
      },
      { status: 500 },
    );
  }
  if (combined.includes("DATABASE_URL") || combined.includes("unavailable")) {
    return Response.json(
      { error: "数据库连接不可用。确认 Neon 已连接到此 Vercel 项目并重新部署。" },
      { status: 500 },
    );
  }
  // Drizzle 把整条 SQL 拼进 message，真正的原因在 cause 里。
  return Response.json({ error: cause || message }, { status: 500 });
}
