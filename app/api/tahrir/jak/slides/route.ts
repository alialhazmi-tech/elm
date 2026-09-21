import { assertCanWrite, writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { normalizeSlide } from "@/lib/ai/jak";
import { getJakSource, listSlides, replaceSlides, type JakSlide } from "@/lib/tahrir/jak";
import { getStory } from "@/lib/tahrir/service";

/** شرائح مادة جاك — جلبها وحفظها (استبدال المجموعة كاملة + مزامنة إسقاط المتن). */
export async function GET(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;

  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return NextResponse.json({ error: "storyId مطلوب." }, { status: 400 });

  const story = await getStory(storyId);
  if (!story) return NextResponse.json({ error: "المادة غير موجودة." }, { status: 404 });
  try { assertCanWrite(gate.actor, story); } catch (error) { return writeError(error); }
  const [slides, source] = await Promise.all([listSlides(storyId), getJakSource(storyId)]);
  return NextResponse.json({ ok: true, slides, source, version: story.version });
}

export async function POST(request: Request) {
  try { return await saveSlides(request); } catch (error) { return writeError(error); }
}
async function saveSlides(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const input = (await request.json().catch(() => null)) as {
    storyId?: string;
    expectedVersion?: number;
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

  const result = await replaceSlides(storyId, slides, session, input?.source?.slice(0, 100_000), input?.expectedVersion);


  return NextResponse.json({ ok: true, count: slides.length, ...result });
}
