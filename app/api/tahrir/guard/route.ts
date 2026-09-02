import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { runPolicyGuard } from "@/lib/policy";
import { requireActor } from "@/lib/tahrir/access";
import { guardMediaFor } from "@/lib/tahrir/service";

/** فحص حي للمسودة أثناء الكتابة — نفس محرك القواعد الحتمي (39 قاعدة). */
export async function POST(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;

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
