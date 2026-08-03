"use client";

import Link from "next/link";
import { useState } from "react";

import type { IntegrityReport, ParsedEntry } from "../../lib/parse/entry";
import { checkIntegrity, dedupe } from "../../lib/parse/entry";
import { extractPdfText, pagesToEntries } from "../../lib/parse/pdf-text";
import {
  inferMapping,
  readTable,
  rowsToEntries,
  type Column,
  type ColumnMapping,
} from "../../lib/parse/tabular";

const COLUMN_LABEL: Record<Column, string> = {
  seq: "序号",
  word: "单词",
  pos: "词性",
  meaning: "中文释义",
  ignore: "忽略",
};

type Stage =
  | { kind: "idle" }
  | { kind: "parsing"; note: string }
  | { kind: "mapping"; rows: string[][]; mapping: ColumnMapping; sourceType: string }
  | { kind: "preview"; entries: ParsedEntry[]; report: IntegrityReport; sourceType: string }
  | { kind: "done"; wordbookId: number; inserted: number }
  | { kind: "error"; message: string };

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [name, setName] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    if (!name) setName(list[0].name.replace(/\.[^.]+$/, ""));

    try {
      const first = list[0];
      const lower = first.name.toLowerCase();

      if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
        setStage({ kind: "parsing", note: "正在解析表格…" });
        const rows = await readTable(first);
        setStage({
          kind: "mapping",
          rows,
          mapping: inferMapping(rows),
          sourceType: lower.endsWith(".csv") ? "csv" : "xlsx",
        });
        return;
      }

      if (lower.endsWith(".pdf")) {
        setStage({ kind: "parsing", note: "正在探测 PDF 文本层…" });
        const all: ParsedEntry[] = [];
        for (const file of list) {
          const extraction = await extractPdfText(file);
          if (!extraction.hasTextLayer) {
            setStage({
              kind: "error",
              message: `${file.name} 是扫描件（无文本层），需要走图片识别，该能力在 M2 提供。`,
            });
            return;
          }
          all.push(...pagesToEntries(extraction.pages));
        }
        finishParse(all, "pdf_text");
        return;
      }

      setStage({
        kind: "error",
        message: "图片识别将在 M2 提供。当前支持 .xlsx / .csv / 含文本层的 .pdf。",
      });
    } catch (error) {
      setStage({ kind: "error", message: error instanceof Error ? error.message : "解析失败" });
    }
  }

  function finishParse(raw: ParsedEntry[], sourceType: string) {
    const entries = dedupe(raw);
    if (entries.length === 0) {
      setStage({ kind: "error", message: "没有解析出任何词条，请检查文件内容。" });
      return;
    }
    setStage({ kind: "preview", entries, report: checkIntegrity(entries), sourceType });
  }

  async function save() {
    if (stage.kind !== "preview") return;
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "未命名词书",
          sourceType: stage.sourceType,
          entries: stage.entries,
        }),
      });
      const data = (await res.json()) as {
        wordbookId?: number;
        inserted?: number;
        error?: string;
      };
      if (!res.ok) {
        setStage({ kind: "error", message: data.error ?? "保存失败" });
        return;
      }
      setStage({ kind: "done", wordbookId: data.wordbookId!, inserted: data.inserted! });
    } catch (error) {
      setStage({ kind: "error", message: error instanceof Error ? error.message : "保存失败" });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">导入材料</h1>
        <Link href="/" className="text-sm text-[var(--purple)]">
          返回
        </Link>
      </header>

      {stage.kind === "idle" && (
        <section className="mt-6">
          <label className="block rounded-2xl border-2 border-dashed border-[color:var(--purple-soft)] bg-white p-10 text-center">
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <span className="block text-base font-medium text-[var(--purple)]">
              选择文件
            </span>
            <span className="mt-2 block text-sm text-[var(--muted)]">
              支持 Excel、CSV，以及含文本层的 PDF
            </span>
          </label>
          <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
            Excel 与含文本层的 PDF 直接解析，不消耗 AI 额度、准确率接近 100%。
            拍照与扫描件走图片识别，在 M2 提供。
          </p>
        </section>
      )}

      {stage.kind === "parsing" && (
        <p className="mt-8 text-sm text-[var(--muted)]">{stage.note}</p>
      )}

      {stage.kind === "mapping" && (
        <MappingStep
          rows={stage.rows}
          mapping={stage.mapping}
          onChange={(mapping) => setStage({ ...stage, mapping })}
          onConfirm={() => finishParse(rowsToEntries(stage.rows, stage.mapping), stage.sourceType)}
        />
      )}

      {stage.kind === "preview" && (
        <PreviewStep
          entries={stage.entries}
          report={stage.report}
          name={name}
          onName={setName}
          onSave={save}
        />
      )}

      {stage.kind === "done" && (
        <section className="mt-8 rounded-2xl bg-white p-6">
          <p className="text-base font-medium">已导入 {stage.inserted} 个词条</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-[var(--purple)] px-5 py-2.5 text-white"
          >
            开始学习
          </Link>
        </section>
      )}

      {stage.kind === "error" && (
        <section className="mt-8 rounded-2xl bg-white p-6">
          <p className="text-sm text-[var(--red)]">{stage.message}</p>
          <button
            onClick={() => setStage({ kind: "idle" })}
            className="mt-4 rounded-xl border border-[color:var(--purple-soft)] px-4 py-2 text-sm"
          >
            重新选择
          </button>
        </section>
      )}
    </main>
  );
}

/** 表格解析的真正难点是列语义不确定，因此必须让用户确认一次。 */
function MappingStep({
  rows,
  mapping,
  onChange,
  onConfirm,
}: {
  rows: string[][];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onConfirm: () => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-medium">确认每列的含义</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">下面是文件的前几行，请核对列的归类。</p>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {mapping.map((col, i) => (
                <th key={i} className="p-1 text-left">
                  <select
                    value={col}
                    aria-label={`第 ${i + 1} 列`}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[i] = e.target.value as Column;
                      onChange(next);
                    }}
                    className="rounded-lg border border-[color:var(--purple-soft)] px-2 py-1"
                  >
                    {(Object.keys(COLUMN_LABEL) as Column[]).map((k) => (
                      <option key={k} value={k}>
                        {COLUMN_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, r) => (
              <tr key={r} className="border-t border-[color:var(--purple-soft)]">
                {mapping.map((_, c) => (
                  <td key={c} className="p-2 text-[var(--muted)]">
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onConfirm}
        className="mt-4 rounded-xl bg-[var(--purple)] px-5 py-2.5 text-white"
      >
        确认，继续
      </button>
    </section>
  );
}

/** 先出完整性校验报告，再让用户决定是否入库。 */
function PreviewStep({
  entries,
  report,
  name,
  onName,
  onSave,
}: {
  entries: ParsedEntry[];
  report: IntegrityReport;
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
}) {
  const keyCount = entries.filter((e) => e.isKey).length;
  return (
    <section className="mt-6">
      <label className="block text-sm text-[var(--muted)]">词书名称</label>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        className="mt-1 w-full rounded-xl border border-[color:var(--purple-soft)] bg-white px-4 py-2.5"
      />

      <div className="mt-5 space-y-2 rounded-2xl bg-white p-5 text-sm">
        <p>
          <span className="text-[var(--green)]">✓</span> 已解析 {report.total} 个词条
          {report.hasSeq && `，编号 ${report.min}–${report.max}`}
        </p>
        {report.hasSeq && report.gaps.length > 0 && (
          <p className="text-[var(--orange)]">
            ⚠ 缺 {report.gaps.length} 条（编号 {report.gaps.slice(0, 12).join("、")}
            {report.gaps.length > 12 && " 等"}）
          </p>
        )}
        {report.duplicates.length > 0 && (
          <p className="text-[var(--orange)]">
            ⚠ 有 {report.duplicates.length} 个重复序号，已保留置信度较高的一条
          </p>
        )}
        {report.hasSeq && report.gaps.length === 0 && report.duplicates.length === 0 && (
          <p className="text-[var(--green)]">✓ 编号连续无缺</p>
        )}
        {!report.hasSeq && (
          <p className="text-[var(--muted)]">材料无序号，已降级为条数统计</p>
        )}
        {keyCount > 0 && <p>🚩 识别到 {keyCount} 个重点词</p>}
      </div>

      <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl bg-white p-4">
        {entries.slice(0, 40).map((e, i) => (
          <div key={i} className="flex gap-3 border-b border-[color:var(--purple-soft)] py-1.5 text-sm last:border-0">
            <span className="w-10 shrink-0 text-right text-[var(--muted)]">{e.seq ?? "—"}</span>
            <span className="w-36 shrink-0 font-medium">{e.word}</span>
            <span className="w-14 shrink-0 text-[var(--muted)]">{e.pos.join("/")}</span>
            <span className="text-[var(--muted)]">{e.meaning}</span>
          </div>
        ))}
        {entries.length > 40 && (
          <p className="pt-2 text-center text-xs text-[var(--muted)]">
            仅显示前 40 条，共 {entries.length} 条
          </p>
        )}
      </div>

      <button onClick={onSave} className="mt-4 rounded-xl bg-[var(--purple)] px-5 py-2.5 text-white">
        导入 {entries.length} 个词条
      </button>
    </section>
  );
}
