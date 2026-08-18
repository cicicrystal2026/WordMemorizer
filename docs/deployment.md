# 部署说明

## 域名

根域 **`beadfable.com`**，在 Cloudflare 注册并托管 DNS。
本项目使用二级域名 **`word.beadfable.com`**。

> 注意拼写是 bea**d**fable，不是 beatfable。早期记录曾误写为后者。

根域已有其他用途（见下方「账号里已存在的 Worker」），因此走子域，互不影响。

### 备案

Cloudflare Registrar 不是工信部批准的域名注册服务机构，
**`beadfable.com` 无法办理 ICP 备案**。

这不影响第一步的 Web 端，但决定了第二步微信小程序必须换域名——
小程序正式版强制要求后端域名已备案。备案域名需在腾讯云/DNSPod 等
境内注册商注册，且备案流程需要 1～3 周，**宜尽早启动**。

详见 `docs/decisions/001-platform.md`。

## 账号里已存在的 Worker

Cloudflare 账号（Cicicrystal607@gmail.com）下已部署：

| Worker | 说明 |
| --- | --- |
| `beadfable-wordmemorize-proxy` | **名称与本项目相关，用途待确认** |
| `beadfable-web` | 疑似占用根域 `beadfable.com`，待确认 |
| `signup-stats` | 与本项目无关 |

部署本项目前必须先弄清前两个的用途与路由绑定，
**避免新 Worker 的路由与既有服务冲突、把线上站点顶掉**。

## 托管形态（已确定）

**Cloudflare Workers**，不使用 Vercel。

理由：现有代码基于 vinext（Cloudflare 官方的 Next.js on Workers 方案），
构建产物即为 Worker；`.openai/hosting.json` 声明的 D1 与 R2 也是 Cloudflare 独有服务。
改投 Vercel 等于更换整个底座，且 Vercel 在大陆的访问质量并无优势。

## 当前托管形态

项目基于 [vinext](https://github.com/cloudflare/vinext)，构建产物是一个
**Cloudflare Worker**，由 OpenAI Sites 托管。注意仓库里**没有 `wrangler.jsonc`**，
这是 vinext starter 的刻意设计（见 README），绑定关系写在 `.openai/hosting.json`。

`vite.config.ts` 只在本地开发时模拟这些绑定，线上由托管平台注入真实值。

## 代码对域名的依赖

**没有硬编码，不需要为换域名改代码。**

`app/layout.tsx:12` 的 `generateMetadata()` 从请求头动态取 host：

```ts
const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
const imageUrl = `${protocol}://${host}/og.png`;
```

部署到哪个域名，OG 图和 metadata 就用哪个域名。

## 上线前置条件（尚未满足）

`.openai/hosting.json` 当前是：

```json
{ "d1": null, "r2": null }
```

**数据库和对象存储都没有启用**，而产品的核心能力两者都依赖：

| 能力 | 依赖 | 用途 |
| --- | --- | --- |
| 词库、学习进度、复习计划 | **D1** | 结构化数据持久化 |
| 上传的图片 / PDF / Excel、录音 | **R2** | 文件存储 |

把对应字段从 `null` 改成绑定名（如 `"d1": "DB"`）即可声明，
但真实的 database_id 由托管平台注入，不写进仓库。

`db/schema.ts` 目前是空的，表结构待 PRD 定稿后设计。

## 部署流程（待补全）

DNS 现状确认后补写具体步骤。

## 本地开发

要求 Node.js `>=22.13.0`（`package.json` 的 `engines` 有约束）。

```powershell
npm install
npm run dev     # 本地开发
npm run build   # 验证构建产物
npm test        # 构建并校验渲染结果
```
