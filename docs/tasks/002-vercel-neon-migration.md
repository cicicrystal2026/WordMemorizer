# 002：迁移至 Vercel 与 Neon

## 目标

将现有单词应用从 ChatGPT Sites / Cloudflare D1 迁移到用户自己的 Vercel
项目，并以 Neon Postgres 作为持久化数据库。迁移完成前保留现有站点与
`word.beadfable.com` 的 DNS 指向，避免中断学生使用。

## 必须改动的文件

- `package.json`、`package-lock.json`：标准 Next.js 构建命令及 Neon 驱动。
- `db/schema.ts`、`db/index.ts`、`drizzle.config.ts`：Postgres schema 与 Neon
  数据库连接。
- `lib/repo.ts`：移除 D1 专属批量写入限制，保持导入原子性。
- `app/api/stats/route.ts`：替换 SQLite 专属日期截取 SQL。
- `tsconfig.json`、`env.d.ts`：移除 Cloudflare 运行时类型。
- `README.md`：更新本地开发与部署说明。
- `drizzle/*`：生成适用于 Postgres 的初始迁移。

## 验收

1. `npm run build` 在没有 Cloudflare 绑定的环境中成功。
2. 所有 Route Handler 仍通过 `app/api/*` 提供 JSON 接口，不使用 Server
   Actions。
3. `npm run typecheck && npm test && npm run lint` 均通过。
4. Neon 连接串只从 Vercel 环境变量 `DATABASE_URL` 读取，绝不提交到仓库。
