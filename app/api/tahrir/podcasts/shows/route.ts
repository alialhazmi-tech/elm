import { NextResponse } from "next/server";

import { validateShowInput } from "@/lib/podcast-input";
import { requirePermission } from "@/lib/tahrir/access";
import { podcastErrorResponse } from "@/lib/tahrir/podcast-route";
import { createShow } from "@/lib/tahrir/podcasts";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

/** برنامج جديد — كيان مستقل صفحته /podcasts/<id>. */
export async function POST(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const input = validateShowInput(await request.json().catch(() => null));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  try {
    const show = await createShow(input.value, gate.actor.username);
    revalidatePublicContent();
    return NextResponse.json({ ok: true, id: show.id });
  } catch (error) {
    return podcastErrorResponse(error);
  }
}
