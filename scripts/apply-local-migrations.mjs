/**
 * 把 drizzle/ 下的迁移应用到本地 miniflare 的 D1 库。
 *
 * 线上由托管平台负责应用迁移；本地开发时 miniflare 不会自动执行，
 * 因此需要这个脚本，否则所有接口都会返回「数据表尚未创建」。
 *
 * 用法：npm run db:local
 */
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

if (!existsSync(D1_DIR)) {
  console.error(`找不到 ${D1_DIR}，请先运行一次 npm run dev 让 miniflare 初始化。`);
  process.exit(1);
}

const dbFile = (await readdir(D1_DIR)).find(
  (f) => f.endsWith(".sqlite") && f !== "metadata.sqlite",
);
if (!dbFile) {
  console.error("未找到本地 D1 数据库文件。");
  process.exit(1);
}

const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(path.join(D1_DIR, dbFile));

const files = (await readdir("drizzle")).filter((f) => f.endsWith(".sql")).sort();
let applied = 0;

for (const file of files) {
  const sql = await readFile(path.join("drizzle", file), "utf8");
  // drizzle 用这个标记分隔语句
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    try {
      db.exec(trimmed);
      applied += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 重复执行时表已存在，视为幂等跳过
      if (message.includes("already exists")) continue;
      throw error;
    }
  }
  console.log(`已应用 ${file}`);
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

db.close();
console.log(`执行 ${applied} 条语句，现有表：${tables.join("、")}`);
