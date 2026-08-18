import assert from "node:assert/strict";
import { test } from "node:test";

import { checkIntegrity, dedupe, parseEntryLine, splitSenses } from "../lib/parse/entry.ts";

test("解析单词性词条", () => {
  const e = parseEntryLine("1. accumulate v.积累");
  assert.deepEqual(e, {
    seq: 1,
    word: "accumulate",
    pos: ["v"],
    meaning: "积累",
    isKey: false,
    confidence: null,
  });
});

test("解析并列词性 v./n.", () => {
  const e = parseEntryLine("32. collapse v./n.崩溃");
  assert.deepEqual(e?.pos, ["v", "n"]);
  assert.equal(e?.meaning, "崩溃");
});

test("词形后紧跟词性时不吞掉词性", () => {
  // 早期实现允许词形跨空格取第二个 token，会把 `v.` 一并当成词形。
  const e = parseEntryLine("353. sufficient adj.足够的");
  assert.equal(e?.word, "sufficient");
  assert.deepEqual(e?.pos, ["adj"]);
});

test("保留连字符词形，且不把释义首字母并入词形", () => {
  const e = parseEntryLine("X-ray n.X 射线");
  assert.equal(e?.word, "X-ray");
  assert.equal(e?.seq, null);
  assert.equal(e?.meaning, "X 射线");
});

test("拆分多词性义项并让首项继承主词性", () => {
  const e = parseEntryLine("176. individual n.个人 adj.个体的");
  assert.ok(e);
  assert.deepEqual(splitSenses(e.meaning, e.pos), [
    { pos: ["n"], text: "个人" },
    { pos: ["adj"], text: "个体的" },
  ]);
});

test("单义项不被误拆", () => {
  const e = parseEntryLine("3. acknowledge v.承认；致谢");
  assert.ok(e);
  assert.deepEqual(splitSenses(e.meaning, e.pos), [{ pos: ["v"], text: "承认；致谢" }]);
});

test("无法识别词形时返回 null", () => {
  assert.equal(parseEntryLine("   "), null);
  assert.equal(parseEntryLine("123. 纯中文行"), null);
});

test("完整性校验能同时报出断号与重号", () => {
  const entries = [1, 2, 4, 4, 5].map((seq) => ({
    seq,
    word: "x",
    pos: [],
    meaning: "",
    isKey: false,
    confidence: null,
  }));
  const report = checkIntegrity(entries);
  assert.deepEqual(report.gaps, [3]);
  assert.deepEqual(report.duplicates, [4]);
  assert.equal(report.min, 1);
  assert.equal(report.max, 5);
  assert.equal(report.hasSeq, true);
});

test("无序号材料降级为条数统计", () => {
  const entries = [null, null].map((seq) => ({
    seq,
    word: "x",
    pos: [],
    meaning: "",
    isKey: false,
    confidence: null,
  }));
  const report = checkIntegrity(entries);
  assert.equal(report.hasSeq, false);
  assert.equal(report.total, 2);
  assert.deepEqual(report.gaps, []);
});

test("同序号去重时保留置信度更高的一条", () => {
  const entries = [
    { seq: 1, word: "low", pos: [], meaning: "", isKey: false, confidence: 0.4 },
    { seq: 1, word: "high", pos: [], meaning: "", isKey: false, confidence: 0.9 },
    { seq: 2, word: "b", pos: [], meaning: "", isKey: false, confidence: null },
  ];
  const result = dedupe(entries);
  assert.equal(result.length, 2);
  assert.equal(result[0].word, "high");
});
