import { assertCanWrite, writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { getJakSource, listSlides } from "@/lib/tahrir/jak";
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

export async function POST() {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  return Response.json({ error: "جاك العلم المحدثة متوقفة. التقارير السابقة محفوظة للقراءة." }, { status: 410 });
}
