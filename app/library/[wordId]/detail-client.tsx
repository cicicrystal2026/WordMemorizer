"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MASTERY_LABEL, type Mastery } from "../../../lib/constants";

type WordRow = {
  wordId: number;
  seq: number | null;
  word: string;
  pos: string[];
  meaning: string;
  isKey: boolean;
  needsReview: boolean;
  confidence: number | null;
  mastery: Mastery;
  reviewCount: number;
  dueAt: string | null;
};

type Detail = {
  phonetic: string | null;
  phrase: string | null;
  sentence: string | null;
  translation: string | null;
  rootHint: string | null;
  editedByUser: boolean;
};

type DetailResult =
  | { ok: true; word: WordRow; detail: Detail | null }
  | { ok: false; error: string };

/** 可编辑字段。`word` 与 `meaning` 来自识别，其余来自 M4 生成——两类都可能错。 */
const FIELDS = [
  { key: "word", label: "单词", hint: "识别结果，错了直接改" },
  { key: "meaning", label: "释义", hint: "以材料上的为准" },
  { key: "phonetic", label: "音标", hint: "英式，M4 生成后填入" },
  { key: "phrase", label: "常见搭配", hint: "" },
  { key: "sentence", label: "例句", hint: "" },
  { key: "translation", label: "例句翻译", hint: "" },
  { key: "rootHint", label: "词根助记", hint: "" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** 纯取数，不碰组件状态。 */
async function fetchDetail(wordId: number): Promise<DetailResult> {
  try {
    const res = await fetch(`/api/words/${wordId}`);
    const data = (await res.json()) as {
      word?: WordRow;
      detail?: Detail | null;
      error?: string;
    };
    if (!res.ok || !data.word) return { ok: false, error: data.error ?? "加载失败" };
    return { ok: true, word: data.word, detail: data.detail ?? null };
  } catch {
    return { ok: false, error: "网络异常" };
  }
}

export default function DetailClient({ wordId }: { wordId: number }) {
  const [word, setWord] = useState<WordRow | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = useCallback((result: DetailResult) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWord(result.word);
    setDetail(result.detail);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchDetail(wordId);
      if (!cancelled) apply(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [wordId, apply]);

  function valueOf(key: FieldKey): string {
    if (key === "word") return word?.word ?? "";
    if (key === "meaning") return word?.meaning ?? "";
    return (detail?.[key] as string | null | undefined) ?? "";
  }

  async function save(key: FieldKey) {
    const next = draft.trim();
    if (next === valueOf(key)) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/words/${wordId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setEditing(null);
      apply(await fetchDetail(wordId));
    } catch {
      setError("网络异常");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKey() {
    if (!word) return;
    const next = !word.isKey;
    setWord({ ...word, isKey: next });
    await fetch(`/api/words/${wordId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isKey: next }),
    }).catch(() => apply({ ok: false, error: "网络异常" }));
  }

  if (error && !word) return <p className="text-sm text-[var(--red)]">{error}</p>;
  if (!word) return <p className="text-sm text-[var(--muted)]">加载中…</p>;

  return (
    <>
      <Link href="/library" className="text-sm text-[var(--muted)]">
        ‹ 词库
      </Link>

      <header className="mt-4 rounded-2xl bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold break-words">{word.word}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {word.pos.join(" / ") || "—"}
              {word.seq !== null && ` · 序号 ${word.seq}`}
            </p>
          </div>
          <button
            onClick={() => void toggleKey()}
            aria-pressed={word.isKey}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
              word.isKey
                ? "bg-[var(--purple)] text-white"
                : "border border-[color:var(--purple-soft)] text-[var(--muted)]"
            }`}
          >
            🚩 重点词
          </button>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
          <div>
            <dt className="inline">掌握度 </dt>
            <dd className="inline text-[var(--ink)]">{MASTERY_LABEL[word.mastery]}</dd>
          </div>
          <div>
            <dt className="inline">学过 </dt>
            <dd className="inline text-[var(--ink)]">{word.reviewCount} 次</dd>
          </div>
          {word.dueAt && (
            <div>
              <dt className="inline">下次复习 </dt>
              <dd className="inline text-[var(--ink)]">{word.dueAt}</dd>
            </div>
          )}
        </dl>

        {word.needsReview && (
          <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--orange)_14%,white)] p-3 text-xs leading-relaxed">
            这条识别置信度偏低，确认无误后改一次任意字段即可解除标记。
          </p>
        )}
      </header>

      {error && <p className="mt-3 text-sm text-[var(--red)]">{error}</p>}

      <section className="mt-4 space-y-2">
        {FIELDS.map((f) => {
          const value = valueOf(f.key);
          const isOpen = editing === f.key;
          return (
            <div key={f.key} className="rounded-2xl bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-[var(--muted)]">{f.label}</span>
                {!isOpen && (
                  <button
                    onClick={() => {
                      setEditing(f.key);
                      setDraft(value);
                    }}
                    className="shrink-0 text-xs text-[var(--purple)]"
                  >
                    {value ? "修改" : "填写"}
                  </button>
                )}
              </div>

              {isOpen ? (
                <div className="mt-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={f.key === "sentence" || f.key === "rootHint" ? 3 : 1}
                    aria-label={f.label}
                    className="w-full rounded-xl border border-[color:var(--purple-soft)] px-3 py-2.5 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void save(f.key)}
                      disabled={saving}
                      className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="rounded-xl px-3 text-sm text-[var(--muted)]"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={`mt-1 text-sm ${value ? "" : "text-[var(--muted)]"}`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {value || (f.hint ? `待补全 · ${f.hint}` : "待补全")}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {detail?.editedByUser && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          这条你改过，重新生成内容时不会覆盖。
        </p>
      )}
    </>
  );
}
