import { redirect } from "next/navigation";

import { isAuthenticated } from "../../lib/auth";
import Nav from "../nav";
import LibraryClient from "./library-client";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <>
      <main className="mx-auto max-w-md px-5 pt-8 pb-24">
        <h1 className="text-xl font-semibold">词库</h1>
        <div className="mt-5">
          <LibraryClient />
        </div>
      </main>
      <Nav />
    </>
  );
}
