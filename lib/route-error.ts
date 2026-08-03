/**
 * D1 表不存在是最常见的部署遗漏：本地改完 schema 后忘了跑 db:generate、
 * 或迁移还没被平台应用到真实数据库。单独给一条可操作的提示。
 */
export function routeError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "未知错误";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${cause}`;

  if (combined.includes("no such table")) {
    return Response.json(
      {
        error:
          "数据表尚未创建。本地执行 `npm run db:generate` 生成迁移后部署，让平台把 SQL 应用到 D1。",
      },
      { status: 500 },
    );
  }
  if (combined.includes("D1 binding") || combined.includes("unavailable")) {
    return Response.json(
      { error: "D1 绑定不可用。确认 .openai/hosting.json 中 d1 已设为 \"DB\" 并重新部署。" },
      { status: 500 },
    );
  }
  return Response.json({ error: message }, { status: 500 });
}
