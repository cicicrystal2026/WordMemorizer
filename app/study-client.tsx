"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GROUP_SIZE, MASTERY_LABEL, type Mastery, type Stage } from "../lib/constants";

type QueueItem = {
  wordId: number;
  word: string;
  pos: string[];
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  mastery: string;
  isNew: boolean;
};

type Counts = { total: number; newWords: number; reviews: number };

/** M1 的学习环节。跟读（shadow）在 M5 接入发音评测后插入认读之后。 */
const FLOW: Stage[] = ["recognize", "meaning", "spell"];
const FLOW_LABEL: Record<Stage, string> = {
  recognize: "认读",
  shadow: "跟读",
  meaning: "认义",
  spell: "拼写",
  cloze: "语境",
};

export default function StudyClient() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      // 每日新词量取自当前计划；没有计划时退回一个保守默认值。
      const planRes = await fetch("/api/plans/current");
      const planData = (await planRes.json().catch(() => ({}))) as {
        plan?: { dailyNew: number } | null;
      };
      const dailyNew = planData.plan?.dailyNew ?? 20;
      const res = await fetch(`/api/study/today?limit=200&dailyNew=${dailyNew}`);
      const data = (await res.json()) as { queue?: QueueItem[]; counts?: Counts; error?: string };
      if (!res.ok) {
        setError(data.error ?? "加载失败");
        return;
      }
      setQueue(data.queue ?? []);
      setCounts(data.counts ?? null);
      setError(null);
    } catch {
      setError("网络异常");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-[var(--red)]">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-[var(--purple)]">
          重试
        </button>
      </Shell>
    );
  }

  if (!queue) return <Shell><p className="text-sm text-[var(--muted)]">加载中…</p></Shell>;

  if (queue.length === 0) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">今天没有待学的词</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">先导入一份材料，或等明天的复习到期。</p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/import"
            className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-white"
          >
            导入材料
          </Link>
          <Link
            href="/plan"
            className="rounded-xl border border-[color:var(--purple-soft)] px-5 py-2.5"
          >
            设定计划
          </Link>
        </div>
      </Shell>
    );
  }

  if (running) {
    return (
      <Session
        items={queue.slice(0, GROUP_SIZE)}
        onExit={() => {
          setRunning(false);
          void load();
        }}
      />
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold">今日任务</h1>
      <div className="mt-4 rounded-2xl bg-white p-5">
        <p className="text-3xl font-semibold">
          {counts?.total ?? queue.length}
          <span className="ml-1 text-base font-normal text-[var(--muted)]">个词条</span>
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          新词 {counts?.newWords ?? 0} · 复习 {counts?.reviews ?? 0}
        </p>
        <button
          onClick={() => setRunning(true)}
          className="mt-5 w-full rounded-xl bg-[var(--purple)] px-5 py-3 font-medium text-white"
        >
          开始这一组（{Math.min(GROUP_SIZE, queue.length)} 词）
        </button>
      </div>
      <Link href="/import" className="mt-4 inline-block text-sm text-[var(--purple)]">
        导入更多材料
      </Link>
    </Shell>
  );
}

/**
 * 一组的学习会话。每个词按 认读 → 认义 → 拼写 依次过关，
 * 整组结束后统一上报——错过任何一关都算这个词未通过，
 * 因为「认得出但拼不对」同样不算掌握。
 */
function Session({ items, onExit }: { items: QueueItem[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [done, setDone] = useState(false);

  const current = items[index];
  const stage = FLOW[stageIdx];

  const options = useMemo(() => {
    if (!current) return [];
    const others = items
      .filter((i) => i.wordId !== current.wordId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [current, ...others].sort(() => Math.random() - 0.5);
  }, [current, items]);

  async function report(item: QueueItem, correct: boolean, stageName: Stage) {
    await fetch("/api/study/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: item.wordId, stage: stageName, correct }),
    }).catch(() => undefined);
  }

  function advance(correct: boolean) {
    if (!correct) setWrong((prev) => new Set(prev).add(current.wordId));
    void report(current, correct, stage);

    setFeedback(null);
    setAnswer("");
    if (stageIdx < FLOW.length - 1) {
      setStageIdx(stageIdx + 1);
      return;
    }
    setStageIdx(0);
    if (index < items.length - 1) setIndex(index + 1);
    else setDone(true);
  }

  async function override(mastery: Mastery) {
    await fetch("/api/study/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: current.wordId, override: mastery }),
    }).catch(() => undefined);
    setStageIdx(0);
    setFeedback(null);
    setAnswer("");
    if (index < items.length - 1) setIndex(index + 1);
    else setDone(true);
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">这一组完成</h1>
        <div className="mt-4 rounded-2xl bg-white p-5">
          <p className="text-sm text-[var(--muted)]">
            共 {items.length} 词，待巩固 {wrong.size} 个
          </p>
          <button
            onClick={onExit}
            className="mt-4 w-full rounded-xl bg-[var(--purple)] px-5 py-3 text-white"
          >
            返回今日
          </button>
        </div>
      </Shell>
    );
  }

  const progress = ((index + stageIdx / FLOW.length) / items.length) * 100;

  return (
    <Shell>
      <header className="flex items-center justify-between text-sm">
        <button onClick={onExit} className="text-[var(--muted)]">
          ‹ 退出
        </button>
        <span className="text-[var(--muted)]">
          {FLOW_LABEL[stage]} · {index + 1}/{items.length}
        </span>
      </header>
      <div className="mt-3 h-1 rounded-full bg-[var(--purple-soft)]">
        <div className="h-1 rounded-full bg-[var(--purple)]" style={{ width: `${progress}%` }} />
      </div>

      <section className="mt-6 rounded-2xl bg-white p-6">
        {current.isKey && (
          <span className="mb-3 inline-block rounded-full bg-[var(--purple-soft)] px-2 py-0.5 text-xs text-[var(--purple)]">
            🚩 重点词
          </span>
        )}

        {stage === "recognize" && (
          <>
            <h2 className="text-3xl font-semibold">{current.word}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{current.pos.join(" / ")}</p>
            <p className="mt-3 text-base">{current.meaning}</p>
            <button
              onClick={() => advance(true)}
              className="mt-6 w-full rounded-xl bg-[var(--purple)] px-5 py-3 text-white"
            >
              记住了
            </button>
          </>
        )}

        {stage === "meaning" && (
          <>
            <h2 className="text-2xl font-semibold">{current.word}</h2>
            <div className="mt-4 flex flex-col gap-2">
              {options.map((opt) => (
                <button
                  key={opt.wordId}
                  disabled={feedback !== null}
                  onClick={() => setFeedback(opt.wordId === current.wordId ? "right" : "wrong")}
                  className={`rounded-xl border px-4 py-3 text-left text-sm ${
                    feedback && opt.wordId === current.wordId
                      ? "border-[var(--green)] bg-[color-mix(in_srgb,var(--green)_10%,white)]"
                      : "border-[color:var(--purple-soft)] bg-white"
                  }`}
                >
                  {opt.meaning || "（无释义）"}
                </button>
              ))}
            </div>
          </>
        )}

        {stage === "spell" && (
          <>
            <p className="text-base">{current.meaning}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (feedback || !answer.trim()) return;
                setFeedback(
                  answer.trim().toLowerCase() === current.word.toLowerCase() ? "right" : "wrong",
                );
              }}
              className="mt-4 flex gap-2"
            >
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="输入英文单词"
                autoCapitalize="none"
                autoCorrect="off"
                aria-label="输入英文单词"
                className="flex-1 rounded-xl border border-[color:var(--purple-soft)] px-4 py-3"
              />
              {!feedback && (
                <button type="submit" className="rounded-xl bg-[var(--purple)] px-4 text-white">
                  检查
                </button>
              )}
            </form>
          </>
        )}

        {feedback && (
          <div className="mt-4">
            <p className={feedback === "right" ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {feedback === "right" ? "答对了" : `正确答案：${current.word}`}
            </p>
            <button
              onClick={() => advance(feedback === "right")}
              className="mt-3 w-full rounded-xl bg-[var(--purple)] px-5 py-3 text-white"
            >
              继续
            </button>
          </div>
        )}
      </section>

      {/* 手动改判：算法判错时用户的逃生阀 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(["new", "learning", "familiar", "mastered"] as Mastery[]).map((m) => (
          <button
            key={m}
            onClick={() => void override(m)}
            className="rounded-full border border-[color:var(--purple-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted)]"
          >
            标为{MASTERY_LABEL[m]}
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-md px-5 pt-8 pb-24">{children}</main>;
}
