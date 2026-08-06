"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MASTERY, MASTERY_LABEL, type Mastery } from "../../lib/constants";

type WordRow = {
  wordId: number;
  seq: number | null;
  word: string;
  pos: string[];
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  mastery: Mastery;
  reviewCount: number;
  dueAt: string | null;
};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "key", label: "🚩 重点词" },
  { key: "new", label: "生词" },
  { key: "learning", label: "半熟" },
  { key: "familiar", label: "熟悉" },
  { key: "mastered", label: "永久掌握" },
];

const MASTERY_VAR: Record<Mastery, string> = {
  new: "var(--mastery-new)",
  learning: "var(--mastery-learning)",
  familiar: "var(--mastery-familiar)",
  mastered: "var(--mastery-mastered)",
};

type WordsResult = { ok: true; words: WordRow[] } | { ok: false; error: string };

/** 纯取数，不碰组件状态；副作用里因此不会同步调用会 setState 的函数。 */
async function fetchWords(filter: string): Promise<WordsResult> {
  try {
    const res = await fetch(`/api/words?filter=${filter}&limit=500`);
    const data = (await res.json()) as { words?: WordRow[]; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "加载失败" };
    return { ok: true, words: data.words ?? [] };
  } catch {
    return { ok: false, error: "网络异常" };
  }
}

export default function LibraryClient() {
  const [rows, setRows] = useState<WordRow[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const apply = useCallback((result: WordsResult) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows(result.words);
    setError(null);
  }, []);

  const reload = useCallback(
    async (f: string) => {
      apply(await fetchWords(f));
    },
    [apply],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchWords(filter);
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, apply]);

  /** 手动改判：算法判错时用户的逃生阀。 */
  async function override(wordId: number, mastery: Mastery) {
    setRows((prev) => prev?.map((r) => (r.wordId === wordId ? { ...r, mastery } : r)) ?? null);
    setOpen(null);
    await fetch("/api/study/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId, override: mastery }),
    }).catch(() => void reload(filter));
  }

  if (error) return <p className="text-sm text-[var(--red)]">{error}</p>;
  if (!rows) return <p className="text-sm text-[var(--muted)]">加载中…</p>;

  return (
    <>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              filter === f.key
                ? "bg-[var(--purple)] text-white"
                : "border border-[color:var(--purple-soft)] bg-white text-[var(--muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">{rows.length} 词</p>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-5 text-sm text-[var(--muted)]">
          这个筛选下没有词。
          <Link href="/import" className="ml-1 text-[var(--purple)]">
            去导入
          </Link>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.wordId} className="overflow-hidden rounded-2xl bg-white">
              <button
                onClick={() => setOpen(open === r.wordId ? null : r.wordId)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  aria-hidden
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: MASTERY_VAR[r.mastery] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-medium">{r.word}</span>
                    {r.isKey && <span className="text-xs">🚩</span>}
                    <span className="text-xs text-[var(--muted)]">{r.pos.join("/")}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--muted)]">
                    {r.meaning}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs text-[var(--muted)]">
                  {MASTERY_LABEL[r.mastery]}
                  <br />
                  学过 {r.reviewCount} 次
                </span>
              </button>

              {open === r.wordId && (
                <div className="border-t border-[color:var(--purple-soft)] p-3">
                  <p className="text-xs text-[var(--muted)]">改判掌握度</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MASTERY.map((m) => (
                      <button
                        key={m}
                        onClick={() => void override(r.wordId, m)}
                        className={`rounded-full px-3 py-1.5 text-xs ${
                          r.mastery === m
                            ? "bg-[var(--purple)] text-white"
                            : "border border-[color:var(--purple-soft)] text-[var(--muted)]"
                        }`}
                      >
                        {MASTERY_LABEL[m]}
                      </button>
                    ))}
                  </div>
                  {r.dueAt && (
                    <p className="mt-2 text-xs text-[var(--muted)]">下次复习 {r.dueAt}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
