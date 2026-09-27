import { NextResponse } from "next/server";

import { validateShowInput } from "@/lib/podcast-input";
import { requirePermission } from "@/lib/tahrir/access";
import { podcastErrorResponse, type PodcastIdContext } from "@/lib/tahrir/podcast-route";
import { updateShow } from "@/lib/tahrir/podcasts";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

/** تعديل برنامج؛ رابطه ثابت لا يتغير بعد الإنشاء. */
export async function PATCH(request: Request, { params }: PodcastIdContext) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const input = validateShowInput(await request.json().catch(() => null), { id });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  try {
    await updateShow(id, input.value, gate.actor.username);
    revalidatePublicContent();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return podcastErrorResponse(error);
  }
}
