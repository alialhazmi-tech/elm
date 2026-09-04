import { NextResponse } from "next/server";

import { runSlideOp, SLIDE_OPS, type SlideOp } from "@/lib/ai/jak";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { normalizeSlide } from "@/lib/ai/jak";
import { requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

/** عملية ذكاء محددة النطاق على شريحة واحدة — لا تمس بقية عمل المحرر. */
export async function POST(request: Request) {
  const access = await requirePermission("jak.manage");
  if (!access.ok) return access.response;
  const session = access.actor;

  const input = (await request.json().catch(() => null)) as {
    op?: string;
    slide?: Record<string, unknown>;
    source?: string;
  } | null;

  const op = input?.op as SlideOp | undefined;
  if (!op || !SLIDE_OPS.includes(op)) {
    return NextResponse.json({ error: "عملية غير معروفة." }, { status: 400 });
  }

  const slide = input?.slide ? normalizeSlide(input.slide as Parameters<typeof normalizeSlide>[0]) : null;
  if (!slide) return NextResponse.json({ error: "شريحة غير صالحة." }, { status: 400 });

  const settings = await loadAiSettings();
  if (!settings.tools.jak) {
    return NextResponse.json({ error: "أداة جاك العلم معطلة من إعدادات الذكاء." }, { status: 403 });
  }

  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 429 });

  try {
    const result = await runSlideOp(op, slide, (input?.source ?? "").slice(0, 60_000), settings);

    const cents = costCents(result.usage.model, result.usage.inputTokens, result.usage.outputTokens);
    await logUsage({
      reservationId: gate.reservationId,
      tool: `jak_${op}`,
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costCents: cents,
      actor: session.username,
    });
    await audit(session.username, `ai:jak-${op}`, undefined, `${cents}¢`);

    return NextResponse.json({ ok: true, slides: result.slides, dropped: result.dropped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذرت العملية.";
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
