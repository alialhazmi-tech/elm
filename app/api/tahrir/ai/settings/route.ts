import { NextResponse } from "next/server";

import { DEFAULT_AI_SETTINGS, keyStatus, loadAiSettings, patchAiSettings, type AiSettingsData, type AiSettingsPatch } from "@/lib/ai/settings";
import { usageTotals } from "@/lib/ai/usage";
import { requireActor, requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

export async function GET() {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;

  const [settings, totals] = await Promise.all([loadAiSettings(), usageTotals()]);
  return NextResponse.json({ settings, totals, keys: keyStatus() });
}

const TOOL_KEYS = Object.keys(DEFAULT_AI_SETTINGS.tools) as Array<keyof AiSettingsData["tools"]>;
const MODEL_KEYS = Object.keys(DEFAULT_AI_SETTINGS.models) as Array<keyof AiSettingsData["models"]>;

/**
 * تعديل إعدادات أدوات الذكاء — إعدادات الحوكمة تُدار من شاشة النظام المنفصلة ولا تُمس هنا.
 * المفاتيح المرسلة فقط تُدمج داخل القاعدة (jsonb ||)؛ ما لم يُرسل يبقى كما هو.
 */
export async function PATCH(request: Request) {
  const gate = await requirePermission("ai.settings", "إعدادات الذكاء قرار رئيس التحرير.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const incoming = (await request.json().catch(() => null)) as Partial<AiSettingsData> | null;
  if (!incoming) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });

  const patch: AiSettingsPatch = {};
  if (incoming.tools) {
    patch.tools = Object.fromEntries(TOOL_KEYS.filter((key) => typeof incoming.tools?.[key] === "boolean").map((key) => [key, incoming.tools![key]]));
  }
  if (incoming.models) {
    patch.models = Object.fromEntries(MODEL_KEYS.filter((key) => typeof incoming.models?.[key] === "string").map((key) => [key, incoming.models![key]]));
  }
  if (incoming.caps) {
    patch.caps = {
      ...(incoming.caps.dailyUsd !== undefined ? { dailyUsd: Math.max(1, Math.min(500, Number(incoming.caps.dailyUsd) || 1)) } : {}),
      ...(incoming.caps.monthlyUsd !== undefined ? { monthlyUsd: Math.max(5, Math.min(5000, Number(incoming.caps.monthlyUsd) || 5)) } : {}),
    };
  }
  if (typeof incoming.tone === "string") patch.tone = incoming.tone.slice(0, 2_000);

  const next = await patchAiSettings(patch);
  await audit(session.username, "ai:settings", undefined, "تحديث إعدادات الذكاء");
  return NextResponse.json({ ok: true, settings: next });
}
