import { NextResponse } from "next/server";

import { keyStatus, loadAiSettings, saveAiSettings, type AiSettingsData } from "@/lib/ai/settings";
import { usageTotals } from "@/lib/ai/usage";
import { requireActor, requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

export async function GET() {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;

  const [settings, totals] = await Promise.all([loadAiSettings(), usageTotals()]);
  return NextResponse.json({ settings, totals, keys: keyStatus() });
}

/** تعديل إعدادات أدوات الذكاء — إعدادات الحوكمة تُدار من شاشة النظام المنفصلة. */
export async function PATCH(request: Request) {
  const gate = await requirePermission("ai.settings", "إعدادات الذكاء قرار رئيس التحرير.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const incoming = (await request.json().catch(() => null)) as Partial<AiSettingsData> | null;
  if (!incoming) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });

  const current = await loadAiSettings();
  const next: AiSettingsData = {
    tools: { ...current.tools, ...incoming.tools },
    models: { ...current.models, ...incoming.models },
    caps: {
      dailyUsd: Math.max(1, Math.min(500, Number(incoming.caps?.dailyUsd ?? current.caps.dailyUsd))),
      monthlyUsd: Math.max(5, Math.min(5000, Number(incoming.caps?.monthlyUsd ?? current.caps.monthlyUsd))),
    },
    governance: current.governance,
    tone: (incoming.tone ?? current.tone).slice(0, 2_000),
  };

  await saveAiSettings(next);
  await audit(session.username, "ai:settings", undefined, "تحديث إعدادات الذكاء");
  return NextResponse.json({ ok: true, settings: next });
}
