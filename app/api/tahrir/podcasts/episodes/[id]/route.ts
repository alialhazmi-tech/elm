import { NextResponse } from "next/server";

import { validateEpisodeInput } from "@/lib/podcast-input";
import { requirePermission } from "@/lib/tahrir/access";
import { podcastErrorResponse, type PodcastIdContext } from "@/lib/tahrir/podcast-route";
import { getEpisode, updateEpisode } from "@/lib/tahrir/podcasts";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

/** تعديل حلقة أو إخفاؤها/إظهارها؛ الحقول الغائبة تبقى كما هي، والملف لا يتغير. */
export async function PATCH(request: Request, { params }: PodcastIdContext) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const current = await getEpisode(id).catch(() => null);
  if (!current) return NextResponse.json({ error: "الحلقة غير موجودة." }, { status: 404 });
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const pick = (field: string, fallback: unknown) => (field in body ? body[field] : fallback);
  const input = validateEpisodeInput({
    showId: pick("showId", current.showId),
    title: pick("title", current.title),
    guest: pick("guest", current.guest),
    description: pick("description", current.description),
    publishedAt: pick("publishedAt", current.publishedAt),
    durationSeconds: pick("durationSeconds", current.durationSeconds),
    visible: pick("visible", current.visible === 1),
  }, new Date(Math.max(Date.now(), Date.parse(current.publishedAt) || 0)));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  try {
    await updateEpisode(id, input.value, gate.actor.username);
    revalidatePublicContent();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return podcastErrorResponse(error);
  }
}
