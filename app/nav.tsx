"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "今日" },
  { href: "/library", label: "词库" },
  { href: "/plan", label: "计划" },
  { href: "/stats", label: "战报" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[color:var(--purple-soft)] bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 py-3 text-center text-sm ${
                active ? "font-medium text-[var(--purple)]" : "text-[var(--muted)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
