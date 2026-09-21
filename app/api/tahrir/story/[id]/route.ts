import { requireActor } from "@/lib/tahrir/access";
import { appStoryDetail } from "@/lib/tahrir/app-read";
import { writeError } from "@/lib/tahrir/write-policy";

/** قراءة مادة للتطبيق بصلاحية المحرر نفسها (`canEditStory`)؛ الكتابة تبقى عبر `/api/tahrir/story`. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  if (typeof id !== "string" || !id.trim() || id.length > 100) return Response.json({ error: "معرف المادة غير صحيح." }, { status: 400 });
  try {
    return Response.json(await appStoryDetail(gate.actor, id.trim()), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return writeError(error);
  }
}
