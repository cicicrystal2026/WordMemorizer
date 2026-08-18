# 背单词

面向学生的单词学习应用，使用标准 Next.js 部署在 Vercel，学习数据保存在
Neon Postgres。

## 本地开发

```bash
npm install
vercel env pull .env.development.local
npm run dev
```

`DATABASE_URL` 只保存在本地环境文件和 Vercel 环境变量中，不能提交到仓库。

## 数据库与部署

修改 `db/schema.ts` 后运行 `npm run db:generate`，将新生成的
`drizzle-pg/` 迁移应用到 Neon。Vercel 项目连接 Neon 后会自动注入
`DATABASE_URL`；生产分支的每次推送都会触发构建。

切换 `word.beadfable.com` 前，应先确认 Vercel Preview 的功能与数据均可用。

## 常用命令

```bash
npm run typecheck
npm test
npm run lint
```
