import { NextResponse } from "next/server";

import { runPolicyGuard } from "@/lib/policy";
import { getSession } from "@/lib/tahrir/auth";

/** فحص حي للمسودة أثناء الكتابة — نفس محرك القواعد الحتمي (39 قاعدة). */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  }

  const { title = "", body = "" } = (await request.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
  };

  const report = runPolicyGuard({ title, body });
  return NextResponse.json(report);
}
