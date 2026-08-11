import { NextResponse } from "next/server";

import { getSession } from "@/lib/tahrir/auth";
import { audit, saveDraft } from "@/lib/tahrir/service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

  const input = (await request.json().catch(() => null)) as {
    id?: string;
    title?: string;
    excerpt?: string;
    body?: string;
    section?: string;
    slug?: string;
    seriesSlug?: string | null;
    image?: string | null;
  } | null;

  if (!input?.title?.trim()) {
    return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  }

  const id = input.id?.trim() || crypto.randomUUID();
  const slug =
    input.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    `story-${id.slice(0, 8)}`;

  await saveDraft(
    {
      id,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() ?? "",
      body: input.body ?? "",
      section: input.section?.trim() || "news",
      slug,
      seriesSlug: input.seriesSlug || null,
      image: input.image?.trim() || null,
    },
    session.displayName,
  );
  await audit(session.username, "draft:save", id);

  return NextResponse.json({ ok: true, id, slug });
}
