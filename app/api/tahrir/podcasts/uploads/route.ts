import { NextResponse } from "next/server";

import { AUDIO_PART_BYTES, parseUploadKey, uploadObjectKey, validateAudioUpload } from "@/lib/podcast-input";
import { abortAudioUpload, isMissingUpload, startAudioUpload } from "@/lib/storage/podcast-audio";
import { requirePermission } from "@/lib/tahrir/access";

/**
 * بدء رفع ملف حلقة: مفتاح بمعرّف عشوائي تحت podcasts/episodes/ وجلسة multipart في المخزن.
 * المتصفح يرسل الأجزاء بعدها إلى /uploads/part ثم يختم بـ /uploads/complete.
 */
export async function POST(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const input = validateAudioUpload(await request.json().catch(() => null));
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const key = uploadObjectKey(crypto.randomUUID(), input.value.kind);
  const uploadId = await startAudioUpload(key, input.value.kind.mime);
  return NextResponse.json({
    ok: true,
    key,
    uploadId,
    partSize: AUDIO_PART_BYTES,
    parts: Math.ceil(input.value.size / AUDIO_PART_BYTES),
  });
}

/** إلغاء رفع لم يكتمل — يحرر الأجزاء المحفوظة في المخزن. */
export async function DELETE(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => null)) as { key?: unknown; uploadId?: unknown } | null;
  if (!parseUploadKey(body?.key) || typeof body?.uploadId !== "string" || !body.uploadId) {
    return NextResponse.json({ error: "جلسة رفع غير صالحة." }, { status: 400 });
  }
  try {
    await abortAudioUpload(body.key as string, body.uploadId);
  } catch (error) {
    if (!isMissingUpload(error)) throw error;
  }
  return NextResponse.json({ ok: true });
}
