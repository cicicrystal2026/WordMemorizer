"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GROUP_SIZE, MASTERY_LABEL, type Mastery, type Stage } from "../lib/constants";
import {
  emptyStageResults,
  recordStageResult,
  shouldAppendRetry,
  shouldSpeakMeaning,
  stagesForMastery,
  type StageResult,
} from "../lib/study-flow";

type QueueItem = {
  wordId: number;
  word: string;
  pos: string[];
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  mastery: Mastery;
  isNew: boolean;
};

type Counts = { total: number; newWords: number; reviews: number };

const FLOW_LABEL: Record<Stage, string> = {
  recognize: "认读",
  shadow: "跟读",
  meaning: "认义",
  spell: "拼写",
  cloze: "语境",
};

type TodayResult =
  | { ok: true; queue: QueueItem[]; counts: Counts | null }
  | { ok: false; error: string };

/**
 * 纯取数，不碰组件状态——由调用方决定如何处理结果。
 * 这样副作用里就不会出现「同步调用一个会 setState 的函数」，
 * 也让重试与首次加载共用同一段逻辑。
 */
async function fetchToday(): Promise<TodayResult> {
  try {
    // 每日新词量取自当前计划；没有计划时退回一个保守默认值。
    const planRes = await fetch("/api/plans/current");
    const planData = (await planRes.json().catch(() => ({}))) as {
      plan?: { dailyNew: number } | null;
    };
    const dailyNew = planData.plan?.dailyNew ?? 20;
    const res = await fetch(`/api/study/today?limit=200&dailyNew=${dailyNew}`);
    const data = (await res.json()) as { queue?: QueueItem[]; counts?: Counts; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "加载失败" };
    return { ok: true, queue: data.queue ?? [], counts: data.counts ?? null };
  } catch {
    return { ok: false, error: "网络异常" };
  }
}

export default function StudyClient() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const apply = useCallback((result: TodayResult) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQueue(result.queue);
    setCounts(result.counts);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    apply(await fetchToday());
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchToday();
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-[var(--red)]">{error}</p>
        <button onClick={() => void reload()} className="mt-3 text-sm text-[var(--purple)]">
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
          void reload();
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
  const [sessionItems, setSessionItems] = useState(() =>
    items.filter((item) => stagesForMastery(item.mastery).length > 0),
  );
  const [index, setIndex] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [retried, setRetried] = useState<Set<number>>(new Set());
  const [hadMistake, setHadMistake] = useState(false);
  const [results, setResults] = useState<StageResult>(emptyStageResults);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [done, setDone] = useState(false);

  const current = sessionItems[index];
  const flow = current ? stagesForMastery(current.mastery) : [];
  const stage = flow[stageIdx];

  const options = useMemo(() => {
    if (!current) return [];
    const others = seededShuffle(
      items.filter((i) => i.wordId !== current.wordId),
      current.wordId,
    ).slice(0, 3);
    return seededShuffle([current, ...others], current.wordId + 1);
  }, [current, items]);

  useEffect(() => {
    if (!current || (stage !== "recognize" && stage !== "shadow")) return;
    speakBritish(current.word);
  }, [current, stage]);

  async function report(item: QueueItem, correct: boolean, stageName: Stage) {
    await fetch("/api/study/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: item.wordId, stage: stageName, correct }),
    }).catch(() => undefined);
  }

  function advance(correct: boolean) {
    if (!current || !stage) return;
    if (!correct) {
      setWrong((prev) => new Set(prev).add(current.wordId));
      setHadMistake(true);
    }
    setResults((prev) => recordStageResult(prev, stage, correct));
    void report(current, correct, stage);

    setFeedback(null);
    setAnswer("");
    if (stageIdx < flow.length - 1) {
      setStageIdx(stageIdx + 1);
      return;
    }

    const retry = shouldAppendRetry(hadMistake || !correct, retried.has(current.wordId));
    if (retry) {
      setSessionItems((prev) => [...prev, current]);
      setRetried((prev) => new Set(prev).add(current.wordId));
    }
    setHadMistake(false);
    setStageIdx(0);
    if (index < sessionItems.length - 1 || retry) setIndex(index + 1);
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
    if (index < sessionItems.length - 1) setIndex(index + 1);
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
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Score label="认读" score={results.recognize} />
            <Score label="跟读" score={results.shadow} />
            <Score label="认义" score={results.meaning} />
            <Score label="拼写" score={results.spell} />
          </dl>
          <p className="mt-3 text-xs text-[var(--muted)]">发音评分将在后续版本接入。</p>
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

  if (!current || !stage) return null;

  const progress = ((index + stageIdx / flow.length) / sessionItems.length) * 100;

  return (
    <Shell>
      <header className="flex items-center justify-between text-sm">
        <button onClick={onExit} className="text-[var(--muted)]">
          ‹ 退出
        </button>
        <span className="text-[var(--muted)]">
          {FLOW_LABEL[stage]} · {index + 1}/{sessionItems.length}
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
              onClick={() => speakBritish(current.word)}
              className="mt-5 rounded-xl border border-[color:var(--purple-soft)] px-4 py-2 text-sm text-[var(--purple)]"
            >
              🔊 再听一遍（英式发音）
            </button>
            <button
              onClick={() => advance(true)}
              className="mt-3 w-full rounded-xl bg-[var(--purple)] px-5 py-3 text-white"
            >
              听完了，开始跟读
            </button>
          </>
        )}

        {stage === "shadow" && (
          <>
            <h2 className="text-3xl font-semibold">{current.word}</h2>
            <p className="mt-3 text-base">听一遍，然后大声跟读一遍。</p>
            <button
              onClick={() => speakBritish(current.word)}
              className="mt-5 rounded-xl border border-[color:var(--purple-soft)] px-4 py-2 text-sm text-[var(--purple)]"
            >
              🔊 再听一遍（英式发音）
            </button>
            <button
              onClick={() => advance(true)}
              className="mt-3 w-full rounded-xl bg-[var(--purple)] px-5 py-3 text-white"
            >
              我读好了
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
                  onClick={() => {
                    const correct = opt.wordId === current.wordId;
                    setFeedback(correct ? "right" : "wrong");
                    if (shouldSpeakMeaning(stage, correct)) {
                      speakWordThenMeaning(current.word, current.meaning);
                    }
                  }}
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
            {feedback === "right" && stage === "meaning" && (
              <button
                onClick={() => speakWordThenMeaning(current.word, current.meaning)}
                className="mt-3 rounded-xl border border-[color:var(--purple-soft)] px-4 py-2 text-sm text-[var(--purple)]"
              >
                🔊 再听一遍英文和中文
              </button>
            )}
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

function Score({ label, score }: { label: string; score: { correct: number; total: number } }) {
  return (
    <div className="rounded-xl bg-[var(--purple-soft)] p-3">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{score.total > 0 ? `${score.correct}/${score.total}` : "—"}</dd>
    </div>
  );
}

/** 浏览器原生语音足够覆盖首学跟读；后续音素评分不会复用或保存录音。 */
function speakBritish(word: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-GB";
  utterance.rate = 0.78;
  window.speechSynthesis.speak(utterance);
}

function speakMandarin(meaning: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(meaning);
  utterance.lang = "zh-CN";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

/** 选对后按「英式单词 → 普通话释义」连读，建立词形、语音和含义的联结。 */
function speakWordThenMeaning(word: string, meaning: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const english = new SpeechSynthesisUtterance(word);
  english.lang = "en-GB";
  english.rate = 0.78;
  english.onend = () => speakMandarin(meaning);
  window.speechSynthesis.speak(english);
}

/**
 * 以词条 id 为种子的确定性洗牌。
 *
 * 选项顺序必须是纯计算：用 Math.random() 时 React 一旦丢弃并重算这个 memo，
 * 选项就会在孩子看题的过程中重新排列——那是实打实的 bug，不只是 lint 噪音。
 */
function seededShuffle<T>(list: T[], seed: number): T[] {
  const result = [...list];
  // 线性同余；保证种子为 0 时状态非零，否则会退化成不洗牌。
  let state = ((seed + 1) * 2654435761) % 2147483647 || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-md px-5 pt-8 pb-24">{children}</main>;
}
