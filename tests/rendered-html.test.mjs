import assert from "node:assert/strict";
import test from "node:test";

/**
 * 启动构建产物中的 Worker，验证首页确实服务端渲染出应用外壳。
 *
 * 本文件此前断言的是 vinext 脚手架的加载骨架（app/_sites-preview/），
 * 那个目录在首个业务提交里就已删除，测试自那时起一直失败。
 */
async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("首页服务端渲染出应用外壳", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*单词[^<]*<\/title>/i);
  assert.match(html, /lang="zh-CN"/);
  // 未配置 APP_PASSCODE 时放行，首页直接渲染学习界面的加载态。
  assert.match(html, /加载中|今日任务|今天没有待学的词/);
});

test("登录页可独立渲染", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /口令/);
});
