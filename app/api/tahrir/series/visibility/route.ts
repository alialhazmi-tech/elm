import { NextResponse } from "next/server";

import { ARCHIVED_SERIES } from "@/lib/content/series";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { setSeriesHidden } from "@/lib/tahrir/service";

const ARCHIVED_SLUGS = new Set(ARCHIVED_SERIES.map((series) => series.slug));

/** إظهار/إخفاء سلسلة متقاعدة من فهارس الاستكشاف — للمعتمدين؛ الصفحة تبقى حية دائمًا. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });
  if (!APPROVER_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "إظهار السلاسل من صلاحية المعتمدين." }, { status: 403 });
  }

  const { slug, hidden } = (await request.json().catch(() => ({}))) as {
    slug?: string;
    hidden?: boolean;
  };
  if (!slug || !ARCHIVED_SLUGS.has(slug as never) || typeof hidden !== "boolean") {
    return NextResponse.json(
      { error: "المفتاح يخص السلاسل المتقاعدة فقط — النشطة هوية موقع محكومة بالعقود." },
      { status: 400 },
    );
  }

  await setSeriesHidden(slug, hidden, session.username);
  return NextResponse.json({ ok: true });
}
