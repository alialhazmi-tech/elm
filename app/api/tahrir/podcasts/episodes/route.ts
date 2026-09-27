import { NextResponse } from "next/server";

import { parseUploadKey, sniffAudio, validateEpisodeInput } from "@/lib/podcast-input";
import { inspectStoredAudio, isMissingUpload } from "@/lib/storage/podcast-audio";
import { requirePermission } from "@/lib/tahrir/access";
import { podcastErrorResponse } from "@/lib/tahrir/podcast-route";
import { createEpisode } from "@/lib/tahrir/podcasts";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

/** نشر حلقة من ملف اكتمل رفعه؛ الحجم والبصمة تُقرأ من المخزن لا من المتصفح. */
export async function POST(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = validateEpisodeInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const upload = parseUploadKey(body?.key);
  if (!upload) return NextResponse.json({ error: "ارفع الملف الصوتي أولًا." }, { status: 400 });
  const key = body!.key as string;

  let stored: Awaited<ReturnType<typeof inspectStoredAudio>>;
  try {
    stored = await inspectStoredAudio(key);
  } catch (error) {
    if (isMissingUpload(error)) return NextResponse.json({ error: "لم يكتمل رفع الملف بعد." }, { status: 409 });
    throw error;
  }
  if (sniffAudio(stored.head) !== upload.kind.ext || !stored.etag) {
    return NextResponse.json({ error: "الملف ليس صوتًا بصيغة MP3 أو M4A سليمة." }, { status: 415 });
  }

  try {
    const episode = await createEpisode(input.value, {
      filename: upload.filename,
      objectKey: key,
      mime: upload.kind.mime,
      byteLength: stored.byteLength,
      etag: stored.etag,
    }, gate.actor.username);
    revalidatePublicContent();
    return NextResponse.json({ ok: true, id: episode.id });
  } catch (error) {
    return podcastErrorResponse(error);
  }
}
