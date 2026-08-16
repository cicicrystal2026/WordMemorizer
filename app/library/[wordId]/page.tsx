import { redirect } from "next/navigation";

import { isAuthenticated } from "../../../lib/auth";
import DetailClient from "./detail-client";

export const dynamic = "force-dynamic";

export default async function WordDetailPage({
  params,
}: {
  params: Promise<{ wordId: string }>;
}) {
  if (!(await isAuthenticated())) redirect("/login");
  const { wordId } = await params;
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-24">
      <DetailClient wordId={Number(wordId)} />
    </main>
  );
}
