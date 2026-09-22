import { writeError } from "@/lib/tahrir/write-policy";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import { revalidatePublicStory } from "@/lib/tahrir/revalidatePublic";
import { pulseStory } from "@/lib/tahrir/service";

/** رفع مادة منشورة إلى صدارة الرئيسية والقسم والسلسلة دون تغيير تاريخ نشرها. */
export async function POST(request: Request) {
  try { return await transition(request); } catch (error) { return writeError(error); }
}

async function transition(request: Request) {
  const gate = await requirePermission("story.publish", "النبض من صلاحية من يملك النشر.");
  if (!gate.ok) return gate.response;

  const body = (await request.json().catch(() => ({}))) as { id?: string; expectedVersion?: number };
  const id = body.id?.trim();
  if (!id || typeof body.expectedVersion !== "number") {
    return NextResponse.json({ error: "معرف المادة وإصدارها مطلوبان." }, { status: 400 });
  }

  const result = await pulseStory(id, body.expectedVersion, gate.actor.username);
  revalidatePublicStory(result);
  return NextResponse.json({ ok: true, ...result });
}
