import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { storyVersions } from "@/db/schema";
import { stripHtmlToText } from "@/lib/content/html";
import { canEditStory, requireActor } from "@/lib/tahrir/access";
import { getStory } from "@/lib/tahrir/service";
import { workflowDb } from "@/lib/tahrir/workflow";

/** نص نسخة واحدة عند الطلب — بصلاحية تحرير المادة نفسها التي تفتح سجل النسخ. */
export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const gate = await requireActor();
  if (!gate.ok) return gate.response;
  const { versionId } = await params;
  if (typeof versionId !== "string" || versionId.length > 100) return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  const [version] = await workflowDb().select({ storyId: storyVersions.storyId, data: storyVersions.data }).from(storyVersions).where(eq(storyVersions.id, versionId)).limit(1);
  const story = version ? await getStory(version.storyId) : null;
  // نفس الرد للمفقود وغير المصرح به حتى لا تُستكشف معرفات النسخ.
  if (!version || !story || !canEditStory(gate.actor, story)) return NextResponse.json({ error: "النسخة غير متاحة." }, { status: 404 });
  const snapshot = version.data as { story?: { title?: string; body?: string } } | null;
  return NextResponse.json(
    { title: snapshot?.story?.title ?? "", text: stripHtmlToText(snapshot?.story?.body ?? "") },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
