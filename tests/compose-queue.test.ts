import assert from "node:assert/strict";
import { test } from "node:test";

import { REVIEW_INTERVALS } from "../lib/constants.ts";
import { composeQueue, type QueueRow } from "../lib/repo.ts";

/**
 * 这组用例的目的不是重测 `prioritizeReviews`（那由 prioritize-reviews.test.ts 覆盖），
 * 而是证明**队列真的调用了它**：排序结果、容量截断都要在 composeQueue 的输出里可见。
 * 任务 001 第一次交付时函数写了却没接上，测试全绿——这里补的就是那个缺口。
 */

const TODAY = "2026-08-10";

function row(over: Partial<QueueRow> & { wordId: number }): QueueRow {
  return {
    word: `w${over.wordId}`,
    pos: '["n."]',
    meaning: "释义",
    isKey: false,
    needsReview: false,
    mastery: "learning",
    reviewCount: 1,
    interval: 1,
    dueAt: TODAY,
    ...over,
  };
}

function ids(items: { wordId: number }[]): number[] {
  return items.map((i) => i.wordId);
}

test("复习按紧急度排序，而不是按数据库返回顺序", () => {
  const rows = [
    row({ wordId: 1, dueAt: "2026-08-09", interval: 15 }), // 逾期 1 天 / 间隔 15
    row({ wordId: 2, dueAt: "2026-08-08", interval: 1 }), // 逾期 2 天 / 间隔 1 —— 最紧急
    row({ wordId: 3, dueAt: "2026-08-10", interval: 4 }), // 今天到期
  ];
  assert.deepEqual(ids(composeQueue(rows, { dailyNew: 0, limit: 10 }, TODAY)), [2, 1, 3]);
});

test("复习量超过容量时截断，且截掉的是最不紧急的", () => {
  const rows = [
    row({ wordId: 1, dueAt: "2026-08-01", interval: 1 }),
    row({ wordId: 2, dueAt: "2026-08-09", interval: 15 }),
    row({ wordId: 3, dueAt: "2026-08-05", interval: 2 }),
  ];
  assert.deepEqual(ids(composeQueue(rows, { dailyNew: 0, limit: 10, capacity: 2 }, TODAY)), [1, 3]);
});

test("默认容量为 dailyNew × 复习档位数", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    row({ wordId: i + 1, dueAt: "2026-08-01", interval: i + 1 }),
  );
  const out = composeQueue(rows, { dailyNew: 5, limit: 500 }, TODAY);
  assert.equal(out.length, 5 * REVIEW_INTERVALS.length);
});

test("落后时新词不被复习饿死", () => {
  const rows = [
    ...Array.from({ length: 200 }, (_, i) =>
      row({ wordId: i + 1, dueAt: "2026-07-01", interval: 1 }),
    ),
    row({ wordId: 901, reviewCount: 0, interval: 0, dueAt: null, mastery: "new" }),
    row({ wordId: 902, reviewCount: 0, interval: 0, dueAt: null, mastery: "new" }),
  ];
  const out = composeQueue(rows, { dailyNew: 10, limit: 500 }, TODAY);
  const fresh = out.filter((i) => i.isNew);
  assert.equal(out.filter((i) => !i.isNew).length, 50); // 10 × 5 档
  assert.deepEqual(ids(fresh), [901, 902]);
});

test("dailyNew 为 0 时复习不受容量限制", () => {
  const rows = Array.from({ length: 30 }, (_, i) =>
    row({ wordId: i + 1, dueAt: "2026-08-01", interval: 1 }),
  );
  assert.equal(composeQueue(rows, { dailyNew: 0, limit: 500 }, TODAY).length, 30);
});

test("limit 收紧时复习不会挤占到超出总量", () => {
  const rows = Array.from({ length: 30 }, (_, i) =>
    row({ wordId: i + 1, dueAt: "2026-08-01", interval: 1 }),
  );
  const out = composeQueue(rows, { dailyNew: 20, limit: 12 }, TODAY);
  assert.equal(out.length, 12);
});

test("新词里重点词优先", () => {
  const rows = [
    row({ wordId: 1, reviewCount: 0, interval: 0, dueAt: null }),
    row({ wordId: 2, reviewCount: 0, interval: 0, dueAt: null, isKey: true }),
    row({ wordId: 3, reviewCount: 0, interval: 0, dueAt: null }),
  ];
  assert.equal(ids(composeQueue(rows, { dailyNew: 1, limit: 10 }, TODAY))[0], 2);
});

test("学过但缺 dueAt 的异常数据不会凭空消失", () => {
  const rows = [row({ wordId: 7, dueAt: null, reviewCount: 3, interval: 2 })];
  assert.deepEqual(ids(composeQueue(rows, { dailyNew: 0, limit: 10 }, TODAY)), [7]);
});

test("pos 保持解析为数组，isNew 标记正确", () => {
  const out = composeQueue(
    [row({ wordId: 1, reviewCount: 0, interval: 0, dueAt: null, pos: '["v.","n."]' })],
    { dailyNew: 5, limit: 10 },
    TODAY,
  );
  assert.deepEqual(out[0].pos, ["v.", "n."]);
  assert.equal(out[0].isNew, true);
});
