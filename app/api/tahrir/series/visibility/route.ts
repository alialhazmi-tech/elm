import { NextResponse } from "next/server";

import { ARCHIVED_SERIES } from "@/lib/content/series";
import { requirePermission } from "@/lib/tahrir/access";
import { setSeriesHidden } from "@/lib/tahrir/service";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

const ARCHIVED_SLUGS = new Set(ARCHIVED_SERIES.map((series) => series.slug));

/** إظهار/إخفاء سلسلة متقاعدة من فهارس الاستكشاف — للمعتمدين؛ الصفحة تبقى حية دائمًا. */
export async function PATCH(request: Request) {
  const gate = await requirePermission("series.visibility", "إظهار السلاسل من صلاحية المعتمدين.");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

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
  revalidatePublicContent();
  return NextResponse.json({ ok: true });
}
