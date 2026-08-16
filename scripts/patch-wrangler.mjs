/**
 * 把 deploy.json 的真实资源标识写进构建产物的 wrangler 配置。
 *
 * vinext 构建时会生成 dist/server/wrangler.json，其中 D1 的 database_id 是
 * 占位值 00000000-0000-4000-8000-000000000000，bucket 名也是 site-creator-r2。
 * 直接 deploy 会连到不存在的库，且报错信息不会明说是占位 ID 的问题。
 *
 * 不在仓库里手写一份 wrangler.jsonc，是因为构建产物的模块布局
 * （no_bundle + rules glob + assets 相对路径）由 vinext 决定，
 * 手写一份等于把它的内部细节抄一遍，vinext 升级就会失配。
 * 改产物只改必须改的四项，其余原样保留。
 */
import { readFileSync, writeFileSync } from "node:fs";

const CONFIG = "deploy.json";
const TARGET = "dist/server/wrangler.json";
const PLACEHOLDER_D1 = "00000000-0000-4000-8000-000000000000";

const deploy = JSON.parse(readFileSync(CONFIG, "utf8"));

const missing = ["workerName", "d1DatabaseName", "d1DatabaseId", "r2BucketName"].filter(
  (k) => !deploy[k] || String(deploy[k]).includes("在此填入"),
);
if (missing.length > 0) {
  console.error(`deploy.json 还没填好：${missing.join("、")}`);
  console.error("先运行 npx wrangler d1 create <名称>，把返回的 database_id 填进去。");
  process.exit(1);
}
if (deploy.d1DatabaseId === PLACEHOLDER_D1) {
  console.error("d1DatabaseId 仍是占位值，请填入真实的 database_id。");
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(TARGET, "utf8"));
} catch {
  console.error(`读不到 ${TARGET}，先运行 npm run build。`);
  process.exit(1);
}

config.name = deploy.workerName;
config.d1_databases = [
  {
    binding: "DB",
    database_name: deploy.d1DatabaseName,
    database_id: deploy.d1DatabaseId,
  },
];
config.r2_buckets = [{ binding: "FILES", bucket_name: deploy.r2BucketName }];

// custom_domain 让 Cloudflare 自动建 DNS 记录并签发证书，
// 比手写 routes + 自己加 CNAME 少一步、也不会漏配证书。
if (Array.isArray(deploy.customDomains) && deploy.customDomains.length > 0) {
  config.routes = deploy.customDomains.map((pattern) => ({ pattern, custom_domain: true }));
}

writeFileSync(TARGET, JSON.stringify(config, null, 2));

console.log(`已写入 ${TARGET}`);
console.log(`  Worker      ${config.name}`);
console.log(`  D1          ${deploy.d1DatabaseName} (${deploy.d1DatabaseId.slice(0, 8)}…)`);
console.log(`  R2          ${deploy.r2BucketName}`);
console.log(`  自定义域名  ${(deploy.customDomains ?? []).join("、") || "无"}`);
