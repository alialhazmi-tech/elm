import { NextResponse } from "next/server";

import { stripHtmlToText } from "@/lib/content/html";
import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
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

  const [settings, media] = await Promise.all([loadAiSettings(), guardMediaFor(image)]);
  const report = runConfiguredPolicyGuard({
    title,
    body: stripHtmlToText(body),
    surface: format === "jakalelm" ? "design" : undefined,
    media,
  }, settings.governance);
  return NextResponse.json(report);
}
