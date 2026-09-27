import { NextResponse } from "next/server";

import { AUDIO_PART_BYTES, parseUploadKey, validPartNumber } from "@/lib/podcast-input";
import { isMissingUpload, uploadAudioPart } from "@/lib/storage/podcast-audio";
import { requirePermission } from "@/lib/tahrir/access";

export const runtime = "nodejs";

/** جزء واحد من ملف الحلقة (حتى 8MB) — جسم الطلب بايتات الجزء كما هي. */
export async function PUT(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const params = new URL(request.url).searchParams;
  const key = params.get("key");
  const uploadId = params.get("uploadId");
  const partNumber = validPartNumber(params.get("part"));
  if (!parseUploadKey(key) || !uploadId || !partNumber) {
    return NextResponse.json({ error: "جلسة رفع غير صالحة." }, { status: 400 });
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > AUDIO_PART_BYTES) {
    return NextResponse.json({ error: "الجزء أكبر من المسموح." }, { status: 413 });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > AUDIO_PART_BYTES) {
    return NextResponse.json({ error: "الجزء فارغ أو أكبر من المسموح." }, { status: 400 });
  }
  try {
    await uploadAudioPart({ key: key!, uploadId, partNumber, body, signal: request.signal });
  } catch (error) {
    if (isMissingUpload(error)) return NextResponse.json({ error: "انتهت جلسة الرفع؛ ابدأ من جديد." }, { status: 410 });
    throw error;
  }
  return NextResponse.json({ ok: true });
}
