import { NextResponse } from "next/server";

import { loadAiSettings } from "@/lib/ai/settings";
import { runConfiguredPolicyGuard } from "@/lib/policy";
import { requireActor } from "@/lib/tahrir/access";
import { buildGuardDraft, loadGuardContext } from "@/lib/tahrir/guard-draft";
import { guardMediaFor } from "@/lib/tahrir/service";

/** سقف الجسم كما في مسار الحفظ: العنوان 500 حرف والمتن 200 ألف؛ وما فوق ذلك لا يُحلَّل أصلًا. */
const MAX_RAW_CHARS = 250_000;
const MAX_BODY_CHARS = 200_000;
const MAX_TITLE_CHARS = 500;

/** فحص حي للمسودة أثناء الكتابة — نفس محرك القواعد الحتمي ونفس مسودة الحارس التي يفحصها الخادم عند الاعتماد. */
export async function POST(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_RAW_CHARS) return NextResponse.json({ error: "تجاوز النص الحد المسموح." }, { status: 413 });
  let input: { title?: unknown; body?: unknown; image?: unknown; format?: unknown; breakingUntil?: unknown } = {};
  try { input = JSON.parse(raw); } catch { input = {}; }
  const title = typeof input.title === "string" ? input.title : "";
  const body = typeof input.body === "string" ? input.body : "";
  const image = typeof input.image === "string" && input.image.trim() ? input.image : null;
  const format = typeof input.format === "string" ? input.format : "news";
  const breakingUntil = typeof input.breakingUntil === "string" ? input.breakingUntil : null;
  if (title.length > MAX_TITLE_CHARS || body.length > MAX_BODY_CHARS) return NextResponse.json({ error: "تجاوز النص الحد المسموح." }, { status: 413 });

  const settingsPromise = loadAiSettings();
  const [settings, media, context] = await Promise.all([settingsPromise, guardMediaFor(image), loadGuardContext(settingsPromise, gate.actor.userId)]);
  const report = runConfiguredPolicyGuard(
    buildGuardDraft({ title, body, format, image, breakingUntil, media }),
    settings.governance,
    context,
  );
  return NextResponse.json(report);
}
