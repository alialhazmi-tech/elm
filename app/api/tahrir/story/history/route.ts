import { NextResponse } from "next/server";
import { requireActor } from "@/lib/tahrir/access";
import { appHistory } from "@/lib/tahrir/app-read";
import { getStory } from "@/lib/tahrir/service";
import { restoreStoryVersion } from "@/lib/tahrir/workflow";
import { writeError } from "@/lib/tahrir/write-policy";

/** قائمة النسخ للتطبيق — بصلاحية تحرير المادة نفسها التي تفتح شاشة السجل. */
export async function GET(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 100) return NextResponse.json({ error: "معرف المادة مطلوب." }, { status: 400 });
  try { return NextResponse.json(await appHistory(gate.actor, id), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return writeError(error); }
}

export async function POST(request: Request) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  if (typeof input?.id !== "string" || typeof input?.versionId !== "string" || !Number.isInteger(input.expectedVersion)) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  const story = await getStory(input.id);
  if (!story) return NextResponse.json({ error: "المادة غير متاحة." }, { status: 404 });
  try { return NextResponse.json(await restoreStoryVersion(story, input.versionId, input.expectedVersion, gate.actor)); }
  catch (error) { return writeError(error); }
}
