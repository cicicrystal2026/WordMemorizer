# 给编码代理的项目约束

任何 AI 编码工具在本仓库工作前**必须先读完本文**。
这里记录的是踩过坑才定下来的规则，违反其中任何一条都会导致返工。

## 工作流

本项目采用**规划与执行分离**：

| 角色 | 产出 |
| --- | --- |
| 规划方 | 任务规格（`docs/tasks/*.md`）+ 测试用例 |
| 执行方 | 让测试通过的实现代码 |
| 裁判 | `npm run typecheck && npm test`，非人工判断 |

**执行方不得修改测试来让它通过。** 测试若确有错误，在任务里说明理由，
不要静默改写。

### 新增函数必须有「被调用」的证据

任务 001 交付时 `prioritizeReviews` 写得完全正确、测试全绿，
但 `lib/repo.ts` 里没有任何一处调用它——功能等于没做，而三道门全过了。

因此：

- 任务规格里必须列出**必须改动的文件清单**，验收先看 `git diff --stat`
- 新增的公开函数，测试里至少有一条是**从调用方入手**的：
  断言调用方的输出体现了新函数的效果，而不是只测新函数本身
- 纯逻辑难以从组件测起时，把调用方的那段逻辑抽成可导出的纯函数再测——
  但必须是调用方**实际使用的那一个**

## 提交前必过的三道门

```bash
npm run typecheck   # 必须零输出
npm test            # 必须全绿
npm run lint        # 必须零错误
```

三者任一不过，就不算完成。

**例外**：三道门在你未触碰的文件上本来就报错时，不要顺手修。
在交付说明里写清楚「哪个文件、什么报错、与本任务无关」，
由规划方决定是否单开任务。混进无关改动会让验收无法判断因果。

## 硬性约束

### 1. 禁用 Server Actions

**所有业务逻辑写在 `app/api/*` 的 Route Handler 里，JSON 进出。**
页面只负责调用 API 和渲染。

原因：第二步要上微信小程序，小程序只能 `wx.request` 调标准 HTTP 接口，
调不了 RSC 私有协议。见 `docs/decisions/001-platform.md`。

```ts
// ✅ app/api/foo/route.ts
export async function POST(request: Request) { return Response.json({ ... }); }

// ❌ 任何 "use server" 指令
```

### 2. D1 批量写入必须按列数反算批大小

D1 单条语句的绑定变量有上限，超出报 `too many SQL variables`。

```ts
const D1_MAX_VARIABLES = 100;
const chunk = Math.floor(D1_MAX_VARIABLES / 列数);   // ✅
for (let i = 0; i < rows.length; i += chunk) { ... }

for (let i = 0; i < rows.length; i += 50) { ... }    // ❌ 9 列时就是 450 个变量
```

已在 `lib/repo.ts` 踩过：400 词导入整体失败。

### 3. 先建空壳、成功后回填计数

创建父记录时不要先写死子记录数量，否则中途失败会留下**声称有 N 条、
实际为空**的孤儿记录。

```ts
// ✅ 建词书时 totalWords: 0 → 词条写入成功 → update 回填真实数量 → 失败则清理
// ❌ 建词书时直接 totalWords: entries.length
```

### 4. 错误响应回传 `cause` 而非 `message`

Drizzle 把整条 SQL 拼进 `error.message`（可达数千字符），
真正的原因在 `error.cause` 里。统一走 `lib/route-error.ts`。

### 5. 发音与音标统一 en-GB

TTS、音标生成、发音评测全部用英式。
`utterance.lang = "en-US"` 一类的写法是错的。见 `docs/decisions/002-pronunciation.md`。

### 6. 图表配色必须过校验脚本

新增任何图表颜色前，跑 dataviz skill 的 `validate_palette.js` 校验，
不要凭感觉取色。已有令牌在 `app/globals.css`：

- `--series-new` / `--series-review`：类别型，负荷曲线用
- `--mastery-*`：掌握度四级，**单色相 light→dark 连续色阶**

**不要把掌握度改回红/橙/绿/黑**——半熟与熟悉在红绿色盲下 ΔE 仅 7.3，
几乎不可分，而这两级恰是最需要区分的。

### 7. 序号是完整性校验的凭据

导入时**必须保留材料上的原始序号** `words.seq`。
断号 = 漏识别、重号 = 重复、越界 = 邻页混入。
不要在识别阶段就把序号剥离丢弃。

### 8. 所有业务表带 `user_id`

当前只有一个使用者（`DEFAULT_USER_ID`），但建表一律带 `user_id`，
为第二步小程序的微信登录预留。不要为了"简化"去掉它。

### 9. AI 生成内容必须可编辑

`word_details` 里 AI 生成的字段全部可由用户修改，
改过的置 `edited_by_user = true`，重新生成时不覆盖。

**不要用免责声明代替纠错能力**——对学习产品，错误内容比缺失内容危害更大。

### 10. 录音用完即弃

发音评测的原始音频不落我方服务器，只存结构化结果
（分数、错音音素）。评测对象是未成年人语音。

## 本地开发

```bash
npm install
npm run dev        # 首次会初始化 miniflare
npm run db:local   # 另开窗口，把迁移应用到本地 D1；不跑则所有接口报「数据表尚未创建」
```

改了 `db/schema.ts` 之后：

```bash
npm run db:generate   # 生成迁移
npm run db:local      # 应用到本地
```

## 代码风格

- 注释写**为什么**，不写**是什么**。解释取舍与踩过的坑，不要复述代码
- 与周围代码保持一致的命名与缩进
- 用户可见文案一律中文
- 不要新增依赖，除非任务规格里明确要求

## 目录约定

```
app/api/*/route.ts   API（业务逻辑都在这）
app/*/page.tsx       页面（服务端校验会话）
app/*-client.tsx     客户端组件
lib/                 纯逻辑，可测试
lib/parse/           三条导入路径的解析器
db/schema.ts         表结构
docs/tasks/          任务规格
tests/               测试；*.test.ts 用 node --experimental-strip-types 跑
```
