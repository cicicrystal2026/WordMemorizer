import assert from "node:assert/strict";
import { test } from "node:test";

import { prioritizeReviews, type ReviewCandidate } from "../lib/scheduler.ts";

const TODAY = "2026-08-10";

function candidate(
  wordId: number,
  dueAt: string | null,
  interval: number,
  isKey = false,
): ReviewCandidate {
  return { wordId, dueAt, interval, isKey };
}

test("容量为 0 或负数时返回空", () => {
  const list = [candidate(1, "2026-08-01", 1)];
  assert.deepEqual(prioritizeReviews(list, TODAY, 0), []);
  assert.deepEqual(prioritizeReviews(list, TODAY, -3), []);
});

test("候选数不超过容量时全部返回", () => {
  const list = [candidate(1, "2026-08-09", 2), candidate(2, "2026-08-08", 4)];
  assert.equal(prioritizeReviews(list, TODAY, 10).length, 2);
});

test("排除未到期的词", () => {
  const list = [
    candidate(1, "2026-08-11", 2), // 明天才到期
    candidate(2, "2026-08-10", 2), // 今天到期
  ];
  assert.deepEqual(prioritizeReviews(list, TODAY, 10), [2]);
});

test("排除尚未安排复习的词", () => {
  const list = [candidate(1, null, 0), candidate(2, "2026-08-09", 1)];
  assert.deepEqual(prioritizeReviews(list, TODAY, 10), [2]);
});

test("按紧急度截断：短间隔的逾期词优先于长间隔的", () => {
  // 都逾期 3 天，但间隔不同 → 紧急度 3.0 vs 0.2
  const shortInterval = candidate(1, "2026-08-07", 1);
  const longInterval = candidate(2, "2026-08-07", 15);
  assert.deepEqual(prioritizeReviews([longInterval, shortInterval], TODAY, 1), [1]);
});

test("逾期越久越优先（同间隔）", () => {
  const list = [
    candidate(1, "2026-08-09", 2), // 逾期 1 天 → 0.5
    candidate(2, "2026-08-05", 2), // 逾期 5 天 → 2.5
    candidate(3, "2026-08-08", 2), // 逾期 2 天 → 1.0
  ];
  assert.deepEqual(prioritizeReviews(list, TODAY, 3), [2, 3, 1]);
});

test("紧急度相同时重点词优先", () => {
  const normal = candidate(1, "2026-08-08", 2);
  const key = candidate(2, "2026-08-08", 2, true);
  assert.deepEqual(prioritizeReviews([normal, key], TODAY, 2), [2, 1]);
});

test("紧急度与重点词都相同时按 wordId 升序，结果稳定", () => {
  const list = [
    candidate(30, "2026-08-08", 2),
    candidate(10, "2026-08-08", 2),
    candidate(20, "2026-08-08", 2),
  ];
  assert.deepEqual(prioritizeReviews(list, TODAY, 3), [10, 20, 30]);
  // 输入顺序不影响结果
  assert.deepEqual(prioritizeReviews([...list].reverse(), TODAY, 3), [10, 20, 30]);
});

test("interval 为 0 时按 1 计算，不产生除零", () => {
  const zero = candidate(1, "2026-08-08", 0); // 逾期 2 天 / 1 → 2.0
  const one = candidate(2, "2026-08-09", 1); // 逾期 1 天 / 1 → 1.0
  const result = prioritizeReviews([one, zero], TODAY, 2);
  assert.deepEqual(result, [1, 2]);
  assert.ok(result.every((id) => Number.isFinite(id)));
});

test("积压场景：只放行容量内最紧急的部分", () => {
  // 模拟请假三天后堆积 50 个复习，容量 10
  const backlog: ReviewCandidate[] = [];
  for (let i = 1; i <= 50; i += 1) {
    // 间隔在 1..5 之间循环，逾期天数固定 3 天
    backlog.push(candidate(i, "2026-08-07", (i % 5) + 1));
  }
  const picked = prioritizeReviews(backlog, TODAY, 10);
  assert.equal(picked.length, 10);
  // 间隔为 1 的词紧急度最高（3/1=3.0），应全部入选
  const intervalOne = backlog.filter((c) => c.interval === 1).map((c) => c.wordId);
  for (const id of intervalOne.slice(0, 10)) {
    assert.ok(picked.includes(id), `间隔最短的 ${id} 应当入选`);
  }
});
