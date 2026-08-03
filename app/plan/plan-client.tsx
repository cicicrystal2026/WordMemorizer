"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import LoadChart, { type LoadPoint } from "./load-chart";

type Wordbook = { id: number; name: string; totalWords: number };
type Plan = { id: number; wordbookId: number; targetDate: string; dailyNew: number };

type Current = {
  plan: Plan | null;
  wordbook?: Wordbook | null;
  daysLeft?: number;
  minimumDailyNew?: number;
  peakLoad?: number;
  forecast?: LoadPoint[];
};

export default function PlanClient() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [books, setBooks] = useState<Wordbook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [planRes, bookRes] = await Promise.all([
        fetch("/api/plans/current"),
        fetch("/api/wordbooks"),
      ]);
      const planData = (await planRes.json()) as Current & { error?: string };
      const bookData = (await bookRes.json()) as { wordbooks?: Wordbook[]; error?: string };
      if (!planRes.ok) return setError(planData.error ?? "加载失败");
      setCurrent(planData);
      setBooks(bookData.wordbooks ?? []);
      setError(null);
    } catch {
      setError("网络异常");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-[var(--red)]">{error}</p>;
  if (!current) return <p className="text-sm text-[var(--muted)]">加载中…</p>;

  if (editing || !current.plan) {
    return (
      <PlanForm
        books={books}
        onDone={() => {
          setEditing(false);
          void load();
        }}
        onCancel={current.plan ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-white p-5">
        <p className="text-sm text-[var(--muted)]">{current.wordbook?.name}</p>
        <p className="mt-1 text-2xl font-semibold">
          每天 {current.plan.dailyNew} 个新词
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          目标 {current.plan.targetDate} · 还剩 {current.daysLeft} 天 · 共{" "}
          {current.wordbook?.totalWords ?? 0} 词
        </p>
        <button onClick={() => setEditing(true)} className="mt-3 text-sm text-[var(--purple)]">
          调整计划
        </button>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-5">
        <LoadChart data={current.forecast ?? []} />
      </section>
    </>
  );
}

/**
 * 创建计划时问的是「什么时候背完」，每日新词量由系统倒算。
 * 让用户直接填每日新词量会误导——那个数字只是新词，
 * 实际单日负荷还要加上累积的复习。
 */
function PlanForm({
  books,
  onDone,
  onCancel,
}: {
  books: Wordbook[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [wordbookId, setWordbookId] = useState<number | null>(books[0]?.id ?? null);
  const [targetDate, setTargetDate] = useState(defaultTarget());
  const [dailyNew, setDailyNew] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    minimumDailyNew: number;
    peakLoad: number;
    forecast: LoadPoint[];
    warning: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = books.find((b) => b.id === wordbookId);

  async function submit(persist: boolean) {
    if (!book) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wordbookId: book.id,
          targetDate,
          ...(dailyNew ? { dailyNew } : {}),
        }),
      });
      const data = (await res.json()) as {
        minimumDailyNew?: number;
        peakLoad?: number;
        forecast?: LoadPoint[];
        warning?: string | null;
        error?: string;
      };
      if (!res.ok) return setError(data.error ?? "创建失败");
      if (persist) return onDone();
      setPreview({
        minimumDailyNew: data.minimumDailyNew ?? 0,
        peakLoad: data.peakLoad ?? 0,
        forecast: data.forecast ?? [],
        warning: data.warning ?? null,
      });
      if (dailyNew === null) setDailyNew(data.minimumDailyNew ?? null);
    } catch {
      setError("网络异常");
    } finally {
      setBusy(false);
    }
  }

  if (books.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5">
        <p className="text-sm text-[var(--muted)]">还没有词书，先导入一份材料。</p>
        <Link
          href="/import"
          className="mt-3 inline-block rounded-xl bg-[var(--purple)] px-4 py-2 text-white"
        >
          导入材料
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5">
      <label className="block text-sm text-[var(--muted)]">词书</label>
      <select
        value={wordbookId ?? ""}
        onChange={(e) => {
          setWordbookId(Number(e.target.value));
          setPreview(null);
          setDailyNew(null);
        }}
        className="mt-1 w-full rounded-xl border border-[color:var(--purple-soft)] px-3 py-2.5"
      >
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}（{b.totalWords} 词）
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm text-[var(--muted)]">什么时候背完</label>
      <input
        type="date"
        value={targetDate}
        onChange={(e) => {
          setTargetDate(e.target.value);
          setPreview(null);
          setDailyNew(null);
        }}
        className="mt-1 w-full rounded-xl border border-[color:var(--purple-soft)] px-3 py-2.5"
      />

      {preview && (
        <>
          <label className="mt-4 block text-sm text-[var(--muted)]">
            每天新词（系统建议 {preview.minimumDailyNew} 个）
          </label>
          <input
            type="number"
            min={1}
            value={dailyNew ?? preview.minimumDailyNew}
            onChange={(e) => setDailyNew(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-xl border border-[color:var(--purple-soft)] px-3 py-2.5"
          />
          {preview.warning && (
            <p className="mt-2 rounded-xl bg-[color-mix(in_srgb,var(--orange)_14%,white)] p-3 text-xs leading-relaxed text-[var(--ink)]">
              ⚠ {preview.warning}
            </p>
          )}
          <div className="mt-4">
            <LoadChart data={preview.forecast} />
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => void submit(false)}
          disabled={busy || !book}
          className="flex-1 rounded-xl border border-[color:var(--purple-soft)] px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {busy ? "计算中…" : "试算"}
        </button>
        {preview && (
          <button
            onClick={() => void submit(true)}
            disabled={busy}
            className="flex-1 rounded-xl bg-[var(--purple)] px-4 py-2.5 text-sm text-white disabled:opacity-50"
          >
            确定计划
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} className="rounded-xl px-3 text-sm text-[var(--muted)]">
            取消
          </button>
        )}
      </div>
    </div>
  );
}

function defaultTarget(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
}
