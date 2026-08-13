import { NextResponse } from "next/server";

import { looksLikeHtml, sanitizeBodyHtml } from "@/lib/content/html";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { audit, deleteDraft, saveDraft } from "@/lib/tahrir/service";

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
    format?: string;
    seoTitle?: string;
    seoDescription?: string;
    keywords?: string[];
    pinned?: boolean;
    breakingUntil?: string | null;
  } | null;

  if (!input?.title?.trim()) {
    return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  }

  const id = input.id?.trim() || crypto.randomUUID();
  // متن المحرر الغني يُنقّى عند الحفظ — والعرض ينقّي ثانية (القاعدة ليست مصدر ثقة).
  const rawBody = input.body ?? "";
  const body = looksLikeHtml(rawBody) ? sanitizeBodyHtml(rawBody) : rawBody;
  const keywords = Array.isArray(input.keywords)
    ? input.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((keyword) => keyword.slice(0, 40))
    : undefined;
  const slug =
    input.slug?.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") ||
    `story-${id.slice(0, 8)}`;

  await saveDraft(
    {
      id,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() ?? "",
      body,
      section: input.section?.trim() || "news",
      slug,
      seriesSlug: input.seriesSlug || null,
      image: input.image?.trim() || null,
      format: input.format?.trim() || undefined,
      seoTitle: input.seoTitle?.trim().slice(0, 90) ?? "",
      seoDescription: input.seoDescription?.trim().slice(0, 200) ?? "",
      keywords,
      ...(APPROVER_ROLES.includes(session.role)
        ? { pinned: input.pinned, breakingUntil: input.breakingUntil }
        : {}),
    },
    session.displayName,
  );
  await audit(session.username, "draft:save", id);
  // إبطال فوري — بلا هذا، تعديل مادة منشورة يبقى غائبًا عن الموقع حتى 300 ثانية (كاش ISR).
  revalidatePublicStory({ section: input.section?.trim() || "news", id, slug });

  return NextResponse.json({ ok: true, id, slug });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id?.trim()) return NextResponse.json({ error: "معرف المسودة مطلوب." }, { status: 400 });

  const result = await deleteDraft(id.trim(), session.username);
  if (result === "not-found") {
    return NextResponse.json({ error: "المسودة غير موجودة." }, { status: 404 });
  }
  if (result === "not-draft") {
    return NextResponse.json({ error: "الحذف النهائي متاح للمسودات فقط. المادة المنشورة تُأرشف لتُخفى عن الموقع مع حفظ السبب." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
