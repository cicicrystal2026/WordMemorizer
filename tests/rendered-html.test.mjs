import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://beadfable.com${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("serves the H5 app only at the configured subdirectory", async () => {
  const root = await render("/");
  assert.equal(root.status, 404);

  const response = await render("/cc/wordmemorize/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /高考单词过关器/);
  assert.match(html, /我的待背词表/);
  assert.match(html, /\/cc\/wordmemorize\/assets\//);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("includes custom planning and file-import controls", async () => {
  const page = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/page.tsx", import.meta.url), "utf8"));
  assert.match(page, /每天背多少个/);
  assert.match(page, /accept="\.png,\.jpg,\.jpeg,\.webp,\.xlsx,\.docx,\.txt,\.csv,\.tsv"/);
  assert.match(page, /确认导入并生成学习计划/);
  assert.match(page, /预计 \{planDays/);
  assert.match(page, /localStorage/);
  assert.match(page, /词根 \/ 音节分色/);
  assert.match(page, /word-detail-card/);
  assert.match(page, /partOfSpeech/);
  assert.match(page, /utterance\.lang = "en-GB"/);
  assert.match(page, /activeUtterance = utterance/);
  assert.match(page, /speak\(firstGroup\[0\]\.word/);
  assert.match(page, /speak\(queue\[nextIndex\]\.word/);
});