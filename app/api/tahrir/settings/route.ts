import { NextResponse } from "next/server";

import { loadAiSettings, saveAiSettings } from "@/lib/ai/settings";
import { requireActor, requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

export async function GET() {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const settings = await loadAiSettings();
  return NextResponse.json({ governance: settings.governance });
}

/** إعدادات نظام حساسة — تُحفظ في صف الإعدادات نفسه وتُطبّق في مسارات النشر على الخادم. */
export async function PATCH(request: Request) {
  const gate = await requirePermission("ai.settings", "إعدادات النظام من صلاحية رئيس التحرير.");
  if (!gate.ok) return gate.response;

  const incoming = (await request.json().catch(() => null)) as {
    governance?: { editorialGuard?: unknown; requireImageRights?: unknown };
  } | null;
  if (!incoming?.governance) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });

  const current = await loadAiSettings();
  const governance = { ...current.governance };
  if (incoming.governance.editorialGuard !== undefined) {
    if (typeof incoming.governance.editorialGuard !== "boolean") {
      return NextResponse.json({ error: "قيمة حارس السياسة غير صالحة." }, { status: 400 });
    }
    governance.editorialGuard = incoming.governance.editorialGuard;
  }
  if (incoming.governance.requireImageRights !== undefined) {
    if (typeof incoming.governance.requireImageRights !== "boolean") {
      return NextResponse.json({ error: "قيمة حقوق الصورة غير صالحة." }, { status: 400 });
    }
    governance.requireImageRights = incoming.governance.requireImageRights;
  }

  await saveAiSettings({ ...current, governance });
  await audit(
    gate.actor.username,
    "system:settings",
    undefined,
    `الحارس: ${governance.editorialGuard ? "مفعّل" : "معطّل"}، حقوق الصور: ${governance.requireImageRights ? "مفعّلة" : "معطّلة"}`,
  );
  return NextResponse.json({ ok: true, governance });
}
