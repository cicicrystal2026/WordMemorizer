"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passcode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "登录失败");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">背单词</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        输入口令后可使用 90 天，无需重复输入。
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="口令"
          autoFocus
          aria-label="口令"
          className="rounded-xl border border-[color:var(--purple-soft)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--purple)]"
        />
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !passcode.trim()}
          className="rounded-xl bg-[var(--purple)] px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "验证中…" : "进入"}
        </button>
      </form>
    </main>
  );
}
