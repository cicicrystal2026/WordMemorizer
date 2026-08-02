# 部署说明

## 域名

**`beatfable.com`**

待确认（需在本机执行 `Resolve-DnsName beatfable.com -Type NS`）：

- [ ] 注册商是哪家
- [ ] NS 是否已指向 Cloudflare
- [ ] 是否已有其他站点占用该域名
- [ ] 是用根域 `beatfable.com` 还是子域（如 `word.beatfable.com`）

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
