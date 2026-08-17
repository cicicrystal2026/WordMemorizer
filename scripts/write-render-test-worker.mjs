import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "server", "index.js");

// 保留旧测试的 Worker 入口形状，但请求的是刚完成生产构建的 Next.js 服务器。
// 这样冒烟测试覆盖真实 Vercel 运行时，而不是留着过期的 Cloudflare 产物。
const source = `import next from "next";
import { createServer } from "node:http";

let serverPromise;

async function getServer() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const app = next({ dev: false, dir: process.cwd() });
      await app.prepare();
      const handle = app.getRequestHandler();
      const server = createServer((request, response) => handle(request, response));
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      server.unref();
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("测试服务器未能启动");
      return \`http://127.0.0.1:\${address.port}\`;
    })();
  }
  return serverPromise;
}

export default {
  async fetch(request) {
    const origin = await getServer();
    const url = new URL(request.url);
    const response = await fetch(\`\${origin}\${url.pathname}\${url.search}\`, {
      headers: request.headers,
      redirect: "manual",
    });
    return new Response(response.body, { status: response.status, headers: response.headers });
  },
};
`;

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, source, "utf8");
