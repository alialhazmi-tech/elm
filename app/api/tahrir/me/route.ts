import { loadAiSettings } from "@/lib/ai/settings";
import { requireActor } from "@/lib/tahrir/access";
import { appMe } from "@/lib/tahrir/app-read";

/** هوية الفاعل وصلاحياته للتطبيق — مفتوحة أيضًا لمن عليه تغيير كلمة المرور أو تفعيل التحقق بخطوتين. */
export async function GET() {
  const gate = await requireActor({ allowTemporaryPassword: true, allowMissingMfa: true });
  if (!gate.ok) return gate.response;
  return Response.json(appMe(gate.actor, await loadAiSettings()), { headers: { "Cache-Control": "private, no-store" } });
}
