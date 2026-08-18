/**
 * 构建产物会 import "cloudflare:workers"，普通 Node 无法解析这个 scheme。
 * 冒烟测试只渲染页面、不触碰数据库，因此把它解析到一个空绑定的桩上即可。
 */
import { register } from "node:module";

register("./cloudflare-stub-hooks.mjs", import.meta.url);
