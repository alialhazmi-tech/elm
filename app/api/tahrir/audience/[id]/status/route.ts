import { requirePermission } from "@/lib/tahrir/access";
import { setAudienceStatus, AudienceError } from "@/lib/membership/admin";
import { privateJson } from "@/lib/personalization/session";
import { readingOrigin } from "@/lib/personalization/reading-input";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!readingOrigin(request))
    return privateJson({ error: "طلب غير مسموح." }, 403);
  const gate = await requirePermission("users.suspend");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  if (
    !["active", "suspended"].includes(body?.status) ||
    typeof body?.reason !== "string"
  )
    return privateJson({ error: "بيانات الإجراء غير صالحة." }, 400);
  try {
    await setAudienceStatus(
      (await params).id,
      body.status,
      body.reason,
      gate.actor.username,
    );
    return privateJson({ ok: true });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof AudienceError
            ? error.message
            : "تعذر تحديث حالة العضو.",
      },
      error instanceof AudienceError ? error.status : 503,
    );
  }
}
