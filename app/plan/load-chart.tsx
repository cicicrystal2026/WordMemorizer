"use client";

import { useState } from "react";

export type LoadPoint = { day: number; newWords: number; reviews: number };

/**
 * 每日负荷曲线：堆叠柱状图，新词在下、复习在上。
 *
 * 这张图的目的不是好看，是**建立预期**——孩子设「每天 20 个」时不知道
 * 第 8 天起实际要过 100 条，那正是放弃率最高的时点。提前看到坡度，
 * 比事后解释有效得多。
 *
 * 配色经 scripts/validate_palette.js 校验：品牌橙 #ff9f43 对白底对比仅
 * 2.04:1 不合格，改用 #c2660b。身份由图例与标签承载，不靠颜色单独区分。
 */
export default function LoadChart({ data }: { data: LoadPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) return null;

  const peak = Math.max(...data.map((d) => d.newWords + d.reviews), 1);
  const steady = findSteadyDay(data);
  const lastNewDay = data.filter((d) => d.newWords > 0).length;

  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">每日负荷预测</span>
        <span className="text-xs text-[var(--muted)]">峰值 {peak} 条/天</span>
      </figcaption>

      <div className="mt-2 flex gap-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--series-new)]" aria-hidden />
          新词
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--series-review)]" aria-hidden />
          复习
        </span>
      </div>

      <div className="mt-3 flex h-40 items-end gap-[2px]" role="img" aria-label={summary(data, peak)}>
        {data.map((d) => {
          const total = d.newWords + d.reviews;
          const isHover = hover === d.day;
          return (
            <button
              key={d.day}
              type="button"
              onMouseEnter={() => setHover(d.day)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.day)}
              onBlur={() => setHover(null)}
              aria-label={`第 ${d.day} 天：新词 ${d.newWords}，复习 ${d.reviews}`}
              className="relative flex h-full flex-1 cursor-default flex-col justify-end"
            >
              {/* 复习在上，新词在下；两段之间留 2px 表面间隙 */}
              {d.reviews > 0 && (
                <span
                  className="w-full rounded-t bg-[var(--series-review)]"
                  style={{
                    height: `${(d.reviews / peak) * 100}%`,
                    opacity: isHover || hover === null ? 1 : 0.45,
                    marginBottom: d.newWords > 0 ? 2 : 0,
                  }}
                />
              )}
              {d.newWords > 0 && (
                <span
                  className={`w-full bg-[var(--series-new)] ${d.reviews > 0 ? "" : "rounded-t"}`}
                  style={{
                    height: `${(d.newWords / peak) * 100}%`,
                    opacity: isHover || hover === null ? 1 : 0.45,
                  }}
                />
              )}
              {isHover && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-lg bg-[var(--ink)] px-2 py-1 text-[11px] leading-tight text-white">
                  第 {d.day} 天 · 共 {total}
                  <br />
                  新词 {d.newWords} · 复习 {d.reviews}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
        <span>第 1 天</span>
        <span>第 {data.length} 天</span>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-[var(--muted)]">
        {steady && (
          <li>
            第 {steady.day} 天起进入稳态，约 {steady.total} 条/天
          </li>
        )}
        <li>第 {lastNewDay} 天学完全部新词，之后只剩复习</li>
      </ul>

      <button
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-xs text-[var(--purple)]"
      >
        {showTable ? "收起数据表" : "查看数据表"}
      </button>

      {showTable && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[color:var(--purple-soft)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white text-[var(--muted)]">
              <tr>
                <th className="p-1.5 text-left font-normal">天</th>
                <th className="p-1.5 text-right font-normal">新词</th>
                <th className="p-1.5 text-right font-normal">复习</th>
                <th className="p-1.5 text-right font-normal">合计</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-[color:var(--purple-soft)]">
                  <td className="p-1.5">{d.day}</td>
                  <td className="p-1.5 text-right">{d.newWords}</td>
                  <td className="p-1.5 text-right">{d.reviews}</td>
                  <td className="p-1.5 text-right font-medium">{d.newWords + d.reviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

/** 找到负荷首次趋于平稳的那天，用于给孩子一个具体的心理预期。 */
function findSteadyDay(data: LoadPoint[]): { day: number; total: number } | null {
  const totals = data.map((d) => d.newWords + d.reviews);
  const peak = Math.max(...totals);
  const idx = totals.findIndex((t) => t >= peak * 0.9);
  return idx < 0 ? null : { day: data[idx].day, total: totals[idx] };
}

function summary(data: LoadPoint[], peak: number): string {
  return `未来 ${data.length} 天的每日负荷，新词与复习堆叠显示，峰值 ${peak} 条`;
}
