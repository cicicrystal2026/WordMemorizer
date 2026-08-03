/**
 * Cloudflare 绑定的类型声明。绑定名与 `.openai/hosting.json` 保持一致：
 * `d1 -> DB`、`r2 -> FILES`。改动那份配置时必须同步这里。
 *
 * `Cloudflare.Env` 由 @cloudflare/workers-types 声明为空接口，
 * 供各项目通过接口合并补全，不能整体覆盖模块声明。
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    /** 访问口令；未设置时放行，便于本地开发 */
    APP_PASSCODE?: string;
  }
}
