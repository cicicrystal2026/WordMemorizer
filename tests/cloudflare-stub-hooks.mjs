import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const STUB = "data:text/javascript,export const env = {};export default {};";

/**
 * 测试环境的模块解析补丁，解决两件事：
 *
 * 1. 构建产物会 `import "cloudflare:workers"`，普通 Node 不认这个 scheme。
 *    冒烟测试只渲染页面、不碰数据库，解析到空绑定的桩即可。
 *
 * 2. 应用代码里的相对导入不带扩展名（`import "./constants"`），
 *    打包器能处理，但 Node 的 ESM 解析要求显式扩展名。这里补上 `.ts`，
 *    使 lib/ 下的纯逻辑可以被 node --test 直接测试，
 *    不必为了可测性去改动应用代码的导入风格。
 */
export function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") {
    return { url: STUB, shortCircuit: true };
  }

  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const target = path.resolve(base, specifier);
    for (const candidate of [`${target}.ts`, path.join(target, "index.ts")]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }

  return next(specifier, context);
}
