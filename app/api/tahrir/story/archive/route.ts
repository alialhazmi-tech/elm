import { writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { archiveStory, getStory } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}
async function transition(request: Request) {
  const gate = await requirePermission("story.archive", "الأرشفة من صلاحية المعتمدين ورئيس التحرير.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const body = (await request.json().catch(() => ({}))) as { id?: string; reason?: string };
  const id = body.id?.trim();
  const reason = body.reason ?? "";
  if (!id) return NextResponse.json({ error: "معرف المادة مطلوب." }, { status: 400 });

  const story = await getStory(id);
  const result = await archiveStory(id, session.username, reason);

  if (result === "short-reason") {
    return NextResponse.json({ error: "اكتب سبب الأرشفة (ثمانية أحرف على الأقل)." }, { status: 400 });
  }
  if (result === "not-found") {
    return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  }
  if (result === "already-archived") {
    return NextResponse.json({ error: "المادة مؤرشفة أصلًا." }, { status: 409 });
  }
  if (result === "is-draft") {
    return NextResponse.json(
      { error: "المسودة تُحذف نهائيًا من قائمة المواد، لا تُأرشف." },
      { status: 409 },
    );
  }

  if (story) revalidatePublicStory({ section: story.section, id: story.id, slug: story.slug });
  return NextResponse.json({ ok: true });
}
