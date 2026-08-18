"use client";

import { useEffect, useState } from "react";

import { MASTERY, MASTERY_LABEL, type Mastery } from "../../lib/constants";

type Stats = {
  distribution: Record<Mastery, number>;
  total: number;
  daily: { day: string; total: number; correct: number }[];
  streak: number;
  troublesome: { word: string; meaning: string; misses: number }[];
};

/** 掌握度是有序进度，用单色相连续色阶；身份由文字标签承载。 */
const MASTERY_VAR: Record<Mastery, string> = {
  new: "var(--mastery-new)",
  learning: "var(--mastery-learning)",
  familiar: "var(--mastery-familiar)",
  mastered: "var(--mastery-mastered)",
};

export default function StatsClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(async (res) => {
        const data = (await res.json()) as Stats & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "加载失败");
        setStats(data);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-[var(--red)]">{error}</p>;
  if (!stats) return <p className="text-sm text-[var(--muted)]">加载中…</p>;

  if (stats.total === 0) {
    return <p className="text-sm text-[var(--muted)]">还没有学习记录，先导入材料开始学习。</p>;
  }

  const todayLog = stats.daily.at(-1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="连续学习" value={`${stats.streak} 天`} />
        <Tile
          label="今日作答"
          value={todayLog ? `${todayLog.correct}/${todayLog.total}` : "—"}
        />
      </div>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-sm font-medium">掌握度分布</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">共 {stats.total} 词</p>

        <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-full">
          {MASTERY.map((m) => {
            const count = stats.distribution[m];
            if (count === 0) return null;
            return (
              <span
                key={m}
                title={`${MASTERY_LABEL[m]} ${count}`}
                style={{
                  width: `${(count / stats.total) * 100}%`,
                  background: MASTERY_VAR[m],
                }}
              />
            );
          })}
        </div>

        <ul className="mt-3 space-y-1.5">
          {MASTERY.map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm">
              <i
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: MASTERY_VAR[m] }}
              />
              <span className="flex-1 text-[var(--muted)]">{MASTERY_LABEL[m]}</span>
              <span className="font-medium">{stats.distribution[m]}</span>
            </li>
          ))}
        </ul>
      </section>

      {stats.troublesome.length > 0 && (
        <section className="rounded-2xl bg-white p-5">
          <h2 className="text-sm font-medium">最容易错的词</h2>
          <ul className="mt-3 space-y-2">
            {stats.troublesome.map((t) => (
              <li key={t.word} className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{t.word}</span>
                <span className="flex-1 truncate text-[var(--muted)]">{t.meaning}</span>
                <span className="shrink-0 text-xs text-[var(--muted)]">错 {t.misses} 次</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
