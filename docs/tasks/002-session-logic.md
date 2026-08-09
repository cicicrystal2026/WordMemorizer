# 任务 002：学习会话的纯逻辑层

**优先级**：P0（批次 A 的地基，003 依赖它）
**类型**：新增模块
**必须改动的文件**：`lib/session.ts`（新建）、`tests/session.test.ts`（新建）
**不得改动**：`app/study-client.tsx`（由任务 003 负责接线）

## 背景

`app/study-client.tsx` 的 `Session` 组件里塞着三件事：出哪些关、错词怎么办、
结算怎么算。全部写在组件内部的 `useState` 流程里，没有一行可以单独测试。
批次 A 的四个功能点（#34/#35/#37/#38）都要改这段逻辑，
继续堆在组件里会越改越不敢动。

这个任务只做一件事：把「一组学习该怎么走」抽成纯函数。
**不改任何界面**——界面由任务 003 接。

## 要实现的模块

新建 `lib/session.ts`：

```ts
import type { Mastery, Stage } from "./constants";

export type SessionItem = {
  wordId: number;
  mastery: Mastery;
  isNew: boolean;
};

/** 一道题 = 一个词 × 一关。 */
export type Question = { wordId: number; stage: Stage };

export type StageResult = { wordId: number; stage: Stage; correct: boolean };
```

### 1. `stagesFor`（功能点 #35：按掌握度分级出题）

```ts
export function stagesFor(item: SessionItem): Stage[];
```

现状是所有词都走完整三关。复习量大时，一个已经「熟悉」的词还要再认读一遍，
纯属浪费——而浪费的时间本可以用来多背几个新词。

| 条件 | 出题 | 理由 |
| --- | --- | --- |
| `isNew === true`（本次首学） | `recognize` → `meaning` → `spell` | 首学必须完整走一遍 |
| `mastery === "new"` | `recognize` → `meaning` → `spell` | 上次答错被打回，同首学 |
| `mastery === "learning"` | `meaning` → `spell` | 认读已过，直接考产出 |
| `mastery === "familiar"` | `spell` | 只考最难的一关：认得出但拼不对不算掌握 |
| `mastery === "mastered"` | `meaning` | 轻量确认，不折腾 |

`isNew` 优先于 `mastery`：新词的 `mastery` 也是 `"new"`，两条规则结果相同，
但顺序要写死，避免以后改动时产生歧义。

### 2. `buildRounds`（功能点 #34：答错的词当轮末尾重现）

```ts
export function buildRounds(items: SessionItem[]): Question[];

/**
 * 某道题答错后，返回要追加到队尾的补考题。
 * 已经补考过一次的词不再追加——一轮之内最多重现一次，
 * 否则一个卡住的词会把整组学习变成死循环。
 */
export function requeue(
  question: Question,
  alreadyRequeued: ReadonlySet<number>,
): Question | null;
```

- `buildRounds` 按 `items` 顺序，为每个词展开 `stagesFor` 的关卡，串成一维题目数组。
  词与词之间不交叉：第一个词的三关走完，才轮到第二个词。
- `requeue` 只在答错时调用；返回的补考题是**同一个词的同一关**，
  由调用方追加到题目数组末尾。
- 判重的粒度是**词**（`wordId`），不是题。一个词在认义关错过并补考后，
  拼写关再错就不再追加。

### 3. `summarize`（功能点 #38：结算页分项得分）

```ts
export type Summary = {
  total: number;
  /** 全程未错的词数 */
  perfect: number;
  /** 至少错过一关的词，按首次出错的先后排列 */
  needsWork: number[];
  /** 每一关的对错统计，只含本组实际出过的关卡 */
  byStage: { stage: Stage; correct: number; total: number }[];
};

export function summarize(results: StageResult[]): Summary;
```

- `byStage` 的顺序固定为 `recognize` → `shadow` → `meaning` → `spell` → `cloze`，
  与 `Stage` 类型的声明顺序一致；本组没出现过的关卡不出现在数组里。
- 补考题也计入 `total`：孩子应该看到「拼写 5/7」这样的真实数字，
  而不是被补考粉饰成 5/5。
- `needsWork` 去重，按首次出错顺序。

## 测试

新建 `tests/session.test.ts`，至少覆盖：

1. 四档掌握度各自的关卡序列
2. `isNew` 为真时即使 `mastery` 是 `familiar` 也走完整三关
3. `buildRounds` 对混合队列的展开顺序
4. `requeue` 首次答错返回补考题、同一词第二次答错返回 `null`
5. `summarize` 的 `byStage` 顺序与「补考计入分母」
6. 空输入：`buildRounds([])` 为 `[]`，`summarize([])` 的 `total` 为 0

参考 `tests/prioritize-reviews.test.ts` 的写法（`node:test` + `assert/strict`，
中文用例名）。

## 验收

```bash
npm run typecheck   # 零输出
npm test            # 全绿
npm run lint        # 零错误
```

## 不要做的事

- 不要改 `app/study-client.tsx`——这个任务交付的是一个还没人调用的模块，
  这是有意的，接线在任务 003
- 不要改 `lib/scheduler.ts` 的任何已有行为
- 不要引入新依赖
- 不要修改已有测试让它们通过
