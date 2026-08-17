import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // 保留 drizzle/ 中的 D1 历史迁移，方便在切换完成前导出旧数据。
  out: "./drizzle-pg",
  schema: "./db/schema.ts",
  dialect: "postgresql",
});
