import { NextResponse } from "next/server";

import { runJakPlan } from "@/lib/ai/jak";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";
import type { JakCanvas } from "@/lib/tahrir/jak";

/**
 * تحليل «جاك العلم»: نص خام → خطة شرائح منظمة.
 * الخطة اقتراح يُعاد للواجهة فقط — لا يُحفظ ولا يُنشر شيء من هنا.
 */
export async function POST(request: Request) {
  const access = await requirePermission("jak.manage");
  if (!access.ok) return access.response;
  const session = access.actor;

  const input = (await request.json().catch(() => null)) as {
    title?: string;
    source?: string;
    canvas?: JakCanvas;
  } | null;

  const source = (input?.source ?? "").trim();
  if (source.split(/\s+/).filter(Boolean).length < 40) {
    return NextResponse.json(
      { error: "المصدر قصير جدًا — الصق التقرير الكامل (40 كلمة على الأقل)." },
      { status: 400 },
    );
  }

  const settings = await loadAiSettings();
  if (!settings.tools.jak) {
    return NextResponse.json({ error: "أداة جاك العلم معطلة من إعدادات الذكاء." }, { status: 403 });
  }

  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 429 });

  try {
    const { plan, usage } = await runJakPlan(
      {
        title: (input?.title ?? "").slice(0, 200),
        source: source.slice(0, 60_000),
        canvas: input?.canvas === "landscape" ? "landscape" : "vertical",
      },
      settings,
    );

    const cents = costCents(usage.model, usage.inputTokens, usage.outputTokens);
    await logUsage({
      reservationId: gate.reservationId,
      tool: "jak_plan",
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costCents: cents,
      actor: session.username,
    });
    await audit(session.username, "ai:jak-plan", undefined, `${plan.slides.length} شريحة · ${cents}¢`);

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر التحليل.";
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
