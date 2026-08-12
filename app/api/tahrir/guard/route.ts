import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { getSession } from "@/lib/tahrir/auth";
import { guardMediaFor } from "@/lib/tahrir/service";

/** فحص حي للمسودة أثناء الكتابة — نفس محرك القواعد الحتمي (39 قاعدة). */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  }

  const { title = "", body = "", image = null, format = "news" } = (await request.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    image?: string | null;
    format?: string;
  };

  const report = runPolicyGuard({
    title,
    body: stripHtmlToText(body),
    surface: format === "jakalelm" ? "design" : undefined,
    media: await guardMediaFor(image),
  });
  return NextResponse.json(report);
}
