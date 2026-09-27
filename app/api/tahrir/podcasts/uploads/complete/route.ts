import { NextResponse } from "next/server";

import { AUDIO_PART_BYTES, MAX_AUDIO_BYTES, parseUploadKey, sniffAudio } from "@/lib/podcast-input";
import { completeAudioUpload, discardStoredAudio, inspectStoredAudio, isMissingUpload } from "@/lib/storage/podcast-audio";
import { requirePermission } from "@/lib/tahrir/access";

/** ختم الرفع: تجميع الأجزاء كما سجلها المخزن، ثم فحص الحجم والصيغة من الملف نفسه. */
export async function POST(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { key?: unknown; uploadId?: unknown; size?: unknown } | null;
  const parsed = parseUploadKey(body?.key);
  const size = Number(body?.size);
  if (!parsed || typeof body?.uploadId !== "string" || !Number.isSafeInteger(size) || size < 1 || size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "جلسة رفع غير صالحة." }, { status: 400 });
  }
  const key = body.key as string;
  try {
    await completeAudioUpload(key, body.uploadId, Math.ceil(size / AUDIO_PART_BYTES));
  } catch (error) {
    if (error instanceof Error && error.message === "INCOMPLETE_UPLOAD") {
      return NextResponse.json({ error: "لم تصل كل أجزاء الملف؛ أعد المحاولة." }, { status: 409 });
    }
    if (isMissingUpload(error)) return NextResponse.json({ error: "انتهت جلسة الرفع؛ ابدأ من جديد." }, { status: 410 });
    throw error;
  }
  const stored = await inspectStoredAudio(key);
  if (stored.byteLength !== size || sniffAudio(stored.head) !== parsed.kind.ext) {
    await discardStoredAudio(key);
    return NextResponse.json({ error: "الملف ليس صوتًا بصيغة MP3 أو M4A سليمة." }, { status: 415 });
  }
  return NextResponse.json({ ok: true, key, filename: parsed.filename, bytes: stored.byteLength });
}
