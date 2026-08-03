import { redirect } from "next/navigation";

import { isAuthenticated } from "../lib/auth";
import Nav from "./nav";
import StudyClient from "./study-client";

/** 依赖每请求的会话 Cookie，必须动态渲染。 */
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <>
      <StudyClient />
      <Nav />
    </>
  );
}
