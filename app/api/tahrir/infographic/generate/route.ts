import { NextResponse } from "next/server";

import { buildDynamicInfographic, generateInfographicPlan } from "@/lib/ai/infographic";
import { type InfographicThemeId } from "@/lib/ai/infographic-types";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { getSession } from "@/lib/tahrir/auth";
import { audit } from "@/lib/tahrir/service";

/** توليد مخطط إنفوجرافيك تفاعلي ذكي من نص أو موضوع */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "الجلسة منتهية، يرجى تسجيل الدخول." }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as {
    text?: string;
    topic?: string;
    preferredTheme?: InfographicThemeId;
  } | null;

  const rawText = input?.text?.trim() ?? "";
  const topic = input?.topic?.trim() ?? "";

  if (!rawText && !topic) {
    return NextResponse.json({ error: "يرجى كتابة نص التقرير أو اختيار موضوع لتوليده." }, { status: 400 });
  }

  const settings = await loadAiSettings();
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 429 });
  }

  try {
    const result = await generateInfographicPlan(
      {
        text: rawText || topic,
        topic,
        preferredTheme: input?.preferredTheme,
      },
      settings,
    );

    const cents = costCents(result.usage.model, result.usage.inputTokens, result.usage.outputTokens);

    try {
      await logUsage({
        tool: "infographic-generator",
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costCents: cents,
        actor: session.username,
      });

      await audit(
        session.username,
        "ai:infographic-generate",
        undefined,
        `${result.infographic.title} · ${result.infographic.themeId} · ${cents}¢`,
      );
    } catch (auditErr) {
      console.error("Audit / usage logging warning:", auditErr);
    }

    return NextResponse.json({
      ok: true,
      infographic: result.infographic,
      guardFindings: result.guardFindings,
      costCents: cents,
    });
  } catch (error) {
    console.error("Infographic generate error:", error);
    // استرجاع مرن فوري يضمن عدم تعطل الواجهة للمحرر
    const fallbackInfographic = buildDynamicInfographic({
      text: rawText || topic,
      topic,
      preferredTheme: input?.preferredTheme,
    });

    return NextResponse.json({
      ok: true,
      infographic: fallbackInfographic,
      guardFindings: [],
      costCents: 0,
      warning: "تم استخدام التوليد الهيكلي المباشر بسبب بطء أو انقطاع استجابة نموذج الذكاء.",
    });
  }
}
