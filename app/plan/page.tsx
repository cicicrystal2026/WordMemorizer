import { redirect } from "next/navigation";

import { isAuthenticated } from "../../lib/auth";
import Nav from "../nav";
import PlanClient from "./plan-client";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <>
      <main className="mx-auto max-w-md px-5 pt-8 pb-24">
        <h1 className="text-xl font-semibold">学习计划</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          告诉我什么时候背完，每天背多少由系统倒算。
        </p>
        <div className="mt-5">
          <PlanClient />
        </div>
      </main>
      <Nav />
    </>
  );
}
