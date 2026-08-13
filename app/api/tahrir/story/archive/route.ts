import { NextResponse } from "next/server";

import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { archiveStory, getStory } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "الأرشفة من صلاحية المعتمدين ورئيس التحرير." }, { status: 403 });
  }

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
