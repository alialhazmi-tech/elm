import { NextResponse } from "next/server";

import { getSession } from "@/lib/tahrir/auth";
import { normalizeSlide } from "@/lib/ai/jak";
import { getJakSource, listSlides, replaceSlides, type JakSlide } from "@/lib/tahrir/jak";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { getStory } from "@/lib/tahrir/service";

/** شرائح مادة جاك — جلبها وحفظها (استبدال المجموعة كاملة + مزامنة إسقاط المتن). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return NextResponse.json({ error: "storyId مطلوب." }, { status: 400 });

  const [slides, source] = await Promise.all([listSlides(storyId), getJakSource(storyId)]);
  return NextResponse.json({ ok: true, slides, source });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

  const input = (await request.json().catch(() => null)) as {
    storyId?: string;
    source?: string;
    slides?: Array<Record<string, unknown>>;
  } | null;

  const storyId = input?.storyId?.trim();
  if (!storyId) return NextResponse.json({ error: "storyId مطلوب." }, { status: 400 });

  const story = await getStory(storyId);
  if (!story) return NextResponse.json({ error: "المادة غير موجودة — احفظها أولًا." }, { status: 404 });

  // التطبيع نفسه المستخدم لخرج الذكاء — الواجهة ليست مصدر ثقة أيضًا.
  const slides: JakSlide[] = [];
  for (const raw of (input?.slides ?? []).slice(0, 30)) {
    const slide = normalizeSlide(raw as Parameters<typeof normalizeSlide>[0]);
    if (!slide) continue;
    slides.push({
      ...slide,
      id: typeof raw.id === "string" && raw.id ? raw.id : slide.id,
      image: typeof raw.image === "string" && raw.image ? raw.image.slice(0, 500) : null,
      hidden: raw.hidden === true,
    });
  }

  await replaceSlides(storyId, slides, session.username, input?.source?.slice(0, 100_000));

  if (story.status === "published") {
    revalidatePublicStory({ section: story.section, id: story.id, slug: story.slug });
  }

  return NextResponse.json({ ok: true, count: slides.length });
}
