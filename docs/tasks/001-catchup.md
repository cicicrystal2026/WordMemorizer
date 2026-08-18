# 任务 001：落后补救（优先级截断）

**优先级**：P0
**类型**：已上线功能的缺陷修复
**测试**：`tests/prioritize-reviews.test.ts`（已写好，当前全部失败）

## 问题

`lib/repo.ts` 的 `todayQueue` 目前是「到期复习全取 + 新词按配额 + 简单截断」。
没有按紧急程度排序。

后果：孩子请假两天，第三天打开会看到堆积的几百个词条全压在一天。
这正是最容易放弃的时刻——而我们花了整个 M3 做负荷曲线来「建立预期」，
执行时却亲手打破了它。

PRD 5.3.3 的要求是：

> 按「距遗忘临界的远近」排序，当日只做最紧急的 N 条，其余顺延。
> **原则：保证每天的量可完成，优先于保证计划不变。**

## 要实现的函数

在 `lib/scheduler.ts` 中新增：

```ts
export type ReviewCandidate = {
  wordId: number;
  /** ISO 日期 YYYY-MM-DD；null 表示尚未安排复习 */
  dueAt: string | null;
  /** 当前复习间隔（天） */
  interval: number;
  /** 重点词（来自手写圈注或手动标记） */
  isKey: boolean;
};

/**
 * 从到期候选中选出今天要做的复习，按学习顺序返回 wordId。
 */
export function prioritizeReviews(
  candidates: ReviewCandidate[],
  today: string,
  capacity: number,
): number[];
```

### 紧急度定义

```
逾期天数 = today - dueAt（负数表示未到期）
紧急度   = 逾期天数 / max(interval, 1)
```

**用比值而不是绝对天数**：间隔 1 天的词逾期 3 天，比间隔 15 天的词逾期 3 天
更接近遗忘。前者紧急度 3.0，后者 0.2。

### 排序规则（依次比较）

1. 紧急度**降序**
2. 紧急度相同时，**重点词优先**
3. 仍相同时，`wordId` **升序**（保证结果稳定可测）

### 边界

| 情况 | 行为 |
| --- | --- |
| `capacity <= 0` | 返回空数组 |
| 候选数 ≤ capacity | 全部返回，仍按上述规则排序 |
| `dueAt` 为 `null` | **排除**，不参与复习（新词由 `dailyNew` 单独限额） |
| `dueAt` 晚于 `today` | **排除**，尚未到期 |
| `interval` 为 0 或负 | 按 1 计算，避免除零 |

## 接入 `todayQueue`

`lib/repo.ts` 的 `todayQueue` 改为：

1. 取出全部到期复习候选
2. 调 `prioritizeReviews` 截断到容量
3. 新词仍按 `dailyNew` 限额，排在复习之后
4. 容量 = `opts.capacity ?? opts.dailyNew * 5`

> 系数 5 的依据：`docs/study-plan-analysis.md` 实测，稳态时
> 单日总量约为新词量的 5 倍（每天 20 新词 → 稳态 100 条）。
> 这个值应可由调用方覆盖。

## 验收

```bash
npm run typecheck   # 零输出
npm test            # 全绿，含新增的 prioritize-reviews 测试
npm run lint        # 零错误
```

外加一条人工验收：`/api/study/today?dailyNew=27` 在有大量积压时，
返回的 `counts.total` 不应超过 `27 * 5 + 27`。

## 不要做的事

- 不要修改 `tests/prioritize-reviews.test.ts` 让它通过
- 不要改动 `review()` / `overrideMastery()` 等已有调度函数的行为
- 不要引入新依赖
