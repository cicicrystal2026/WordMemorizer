import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emptyStageResults,
  recordStageResult,
  shouldAppendRetry,
  stagesForMastery,
} from "../lib/study-flow.ts";

test("按掌握度收缩学习关卡", () => {
  assert.deepEqual(stagesForMastery("new"), ["recognize", "shadow", "meaning", "spell"]);
  assert.deepEqual(stagesForMastery("learning"), ["meaning", "spell"]);
  assert.deepEqual(stagesForMastery("familiar"), ["spell"]);
  assert.deepEqual(stagesForMastery("mastered"), []);
});

test("分项成绩独立累计", () => {
  let results = emptyStageResults();
  results = recordStageResult(results, "meaning", true);
  results = recordStageResult(results, "meaning", false);
  results = recordStageResult(results, "spell", true);

  assert.deepEqual(results.meaning, { correct: 1, total: 2 });
  assert.deepEqual(results.spell, { correct: 1, total: 1 });
  assert.deepEqual(results.recognize, { correct: 0, total: 0 });
});

test("错词只在组末重现一次", () => {
  assert.equal(shouldAppendRetry(true, false), true);
  assert.equal(shouldAppendRetry(true, true), false);
  assert.equal(shouldAppendRetry(false, false), false);
});
