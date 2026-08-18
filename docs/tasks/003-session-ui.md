# 任务 003：学习界面接入会话逻辑

**优先级**：P0
**类型**：接线 + 界面
**前置**：任务 002 已合并
**必须改动的文件**：`app/study-client.tsx`、`tests/session-ui.test.ts`（新建）

> **验收会先看 `git diff --stat`。** 如果 `app/study-client.tsx` 没有出现在
> 改动列表里，这个任务就是未完成——无论测试是否全绿。
> 任务 001 就栽在这里：函数写好了、测试全绿，但没有任何地方调用它。

## 要做的事

### 1. 用 `lib/session.ts` 驱动 `Session` 组件

现状（`app/study-client.tsx:166` 起）：`index` 走词、`stageIdx` 走关，
关卡表是写死的常量 `FLOW`。

改为：

- 会话开始时用 `buildRounds(items)` 生成题目数组，存进 `useState`
- 用单一游标 `cursor` 指向当前题目，取代 `index` + `stageIdx` 两个游标
- 答错时调 `requeue`，非 `null` 就把补考题**追加到数组末尾**，
  并把 `wordId` 记进「已补考」集合
- 结算页用 `summarize(results)` 的结果渲染

`items` 传进来时要带上 `mastery` 和 `isNew`——两个字段 `/api/study/today`
已经在返回了，`QueueItem` 类型里也有，直接用。

### 2. 进度条与计数

现在的 `progress` 按「词 + 关卡小数」算。改成按题目数算：
`(cursor / questions.length) * 100`。

补考题追加后分母会变大，进度条会「退回去」一点——这是对的，
孩子确实还有题要做。但**不要让进度条数值倒退**：取
`Math.max(已显示进度, 新算出的进度)` 会说谎，直接用真实值即可。

顶部计数从 `{index + 1}/{items.length}` 改为 `{cursor + 1}/{questions.length}`。

### 3. 结算页分项得分（功能点 #38）

现在只有一行「共 N 词，待巩固 M 个」。改为：

```
这一组完成
共 20 词 · 全对 14 个

认义   18/20
拼写   15/22        ← 分母含补考

待巩固：abandon、accompany、…（点进词库看）
```

- 每一关一行，用 `FLOW_LABEL` 取中文名
- 正确率低于 60% 的关卡，数字用 `var(--orange)` 标出来——
  让孩子知道弱在哪一关，这是这个功能点存在的全部理由
- 待巩固的词列出前 5 个，多余的显示「等 N 个」

### 4. 上报时机不变

`report()` 仍是每答完一关就打一次 `/api/study/answer`。
补考题也照常上报——`review()` 会把它当成一次独立作答，
这与「错了就回到最短间隔」的既有语义一致，不要为补考加特例。

## 测试

新建 `tests/session-ui.test.ts`，**目的是证明界面真的调用了 002 的函数**，
而不是重测那些函数：

1. 造一个 `mastery: "familiar"` 的词，断言渲染出的第一关是拼写而不是认读
   （证明 `stagesFor` 生效）
2. 造一组题，答错第一题后断言题目总数增加了 1
   （证明 `requeue` 被接上了）
3. 断言结算页出现了分关卡的比分文本
   （证明 `summarize` 被消费了）

渲染方式参考 `tests/rendered-html.test.mjs`。如果 `Session` 组件在当前测试
设施下无法直接渲染，就把上述断言改为对**导出的纯函数**做断言，
但必须是 `study-client.tsx` 里实际使用的那一个——
例如把「题目数组 + 答题结果 → 新题目数组」的推进逻辑
抽成 `advanceQuestions()` 从 `study-client.tsx` 导出并测试。
不允许出现「测试通过但组件仍走老路径」的交付。

## 验收

```bash
npm run typecheck   # 零输出
npm test            # 全绿
npm run lint        # 零错误
```

外加人工验收：进入一组含复习词的学习，确认已「熟悉」的词只出一关。

## 不要做的事

- 不要动 `lib/session.ts` 的函数签名——有问题先提出来，不要就地改
- 不要在渲染期使用 `Math.random()`（见 `seededShuffle` 上方注释）
- 不要引入新依赖或新的状态管理库
