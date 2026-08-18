# 上线到 mightybug.cn

域名 `mightybug.cn` 于腾讯云注册。本文只讲这一个域名的上线路径，
历史背景（`beadfable.com` 为何不可备案）见 `docs/deployment.md`。

---

## 先说清楚三件容易踩的事

### 1. `.cn` 必须完成实名认证，否则会被停止解析

这是注册商的强制要求，与备案是两回事。腾讯云通常给 5 个工作日，
逾期未认证域名会进入 `serverHold` 状态——**表现是域名突然解析不了**，
而且排查时很容易误以为是 DNS 或 Worker 的问题。

**去腾讯云控制台确认「实名认证」已通过再往下走。**

### 2. 备案与本次上线的关系

备案的对象是「大陆境内服务器上的服务」。本方案把站点放在 Cloudflare
（境外节点），技术上不需要备案就能访问。

但要如实说明：面向公众提供互联网信息服务本应备案，未备案指向境外属于灰区。
本产品是自家孩子用的私有工具、有口令保护、不对外开放，风险很低。
**要上微信小程序则必须备案**，那条路绕不开——小程序正式版强制校验后端域名的备案状态。

所以建议：**现在用 Cloudflare 先跑起来，备案并行推进**，
备案下来后再决定是否迁到腾讯云。两件事不互相阻塞。

### 3. 大陆访问 Cloudflare 的速度

Cloudflare 免费版在中国大陆没有节点，请求会绕到境外（多为香港/新加坡/日本）。
孩子每天打开、每答一题都要打接口，**这个延迟是会被感知到的**。

这也是 `docs/backlog.md` 里「日常背诵不依赖网络」（功能点 73–75）真正的价值所在：
把词库和进度缓存到本地、后台同步，能把绕路的影响降到最低。
如果实测下来体感明显，这批功能的优先级要往前提。

---

## 一次性准备

以下每步只做一次。**全部在项目根目录执行**：

```powershell
cd D:\codex-project\beidancishenqi
```

### 步骤 1 · 登录 Cloudflare

```powershell
npx wrangler login
```

浏览器会弹出授权页。授权的是你自己的 Cloudflare 账号。

### 步骤 2 · 建数据库和存储桶

```powershell
npx wrangler d1 create mightybug
npx wrangler r2 bucket create mightybug-files
```

第一条会输出一段配置，其中有 `database_id`，**把它复制下来**。

### 步骤 3 · 填进 deploy.json

打开项目根目录的 `deploy.json`，把 `d1DatabaseId` 那一行的占位文字换成刚才的 ID：

```json
"d1DatabaseId": "复制来的那串 uuid"
```

其余字段已经填好，不用动。

### 步骤 4 · 建表

```powershell
npx wrangler d1 execute mightybug --remote --file=./drizzle/0000_loud_tana_nile.sql
```

`--remote` 不能漏，漏了就只建在本地模拟环境里，线上仍然是空库。

### 步骤 5 · 设访问口令

```powershell
npx wrangler secret put APP_PASSCODE
```

会提示输入。设一个孩子记得住、别人猜不到的短口令。
**不设也能部署，但那样站点是完全公开的**——见 `lib/auth.ts:8`，未配置时放行。

### 步骤 6 · 把域名接进 Cloudflare

1. Cloudflare 控制台 → Add a site → 输入 `mightybug.cn` → 选 Free 计划
2. Cloudflare 会给出两个 nameserver 地址，形如 `xxx.ns.cloudflare.com`
3. 到**腾讯云 → 域名管理 → mightybug.cn → 修改 DNS 服务器**，换成这两个
4. 等生效。通常十几分钟到几小时，Cloudflare 那边状态变成 Active 即可

> 这一步是把域名的解析权从腾讯云 DNSPod 交给 Cloudflare。
> 交出去之后，腾讯云控制台里的解析记录就不再生效了——
> 如果这个域名以后还要在腾讯云做别的事，先想清楚。

---

## 部署

准备做完后，每次发版只需要一条命令：

```powershell
.\scripts\deploy.ps1
```

它做四件事：跑三道门 → 构建 → 把真实的 D1/R2/域名写进构建产物 → 部署。

**三道门放在部署前面是有意的**：部署失败可以重来，
部署上去的坏版本孩子会直接撞上。

想先看看会发什么而不真发：

```powershell
.\scripts\deploy.ps1 -DryRun
```

刚跑过检查、只改了配置时可以跳过检查：

```powershell
.\scripts\deploy.ps1 -SkipGates
```

---

## 验证清单

部署完按顺序验：

| 检查 | 期望 |
| --- | --- |
| 打开 `https://mightybug.cn` | 跳转到登录页 |
| 输入口令 | 进入今日任务页 |
| 打开 `/import` 传一份 Excel | 能解析并显示列映射确认 |
| 导入后打开 `/plan` | 能算出每日新词量并画出负荷曲线 |
| 打开 `/library` 点一个词的「查看详情」 | 详情页能打开，改一个字段能存下 |

**第三条最容易出问题**：如果导入报「数据表尚未创建」，
说明步骤 4 漏了 `--remote`，回去重跑。

---

## 常见故障

| 现象 | 原因 |
| --- | --- |
| 部署报 D1 不存在 | `deploy.json` 里还是占位 ID，或步骤 2 建的库名与 `d1DatabaseName` 不一致 |
| 域名打不开、Cloudflare 显示 pending | NS 还没生效，或腾讯云那边没改成功 |
| 域名突然解析不了 | `.cn` 实名认证逾期，域名被 `serverHold` |
| 站点能开但接口全 500 | 表没建，回到步骤 4 |
| 谁都能直接进 | `APP_PASSCODE` 没设，回到步骤 5 |
| 部署提示未登录 | `npx wrangler login` |
