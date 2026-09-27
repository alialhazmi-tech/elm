import { NextResponse } from "next/server";

import { putStoredImage } from "@/lib/storage/images";
import { requirePermission } from "@/lib/tahrir/access";
import { readImageMeta } from "@/lib/tahrir/imageMeta";

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** غلاف برنامج — مربع لا يقل عن 600 بكسل، يُحفظ في مخزن الصور نفسه. */
export async function POST(request: Request) {
  const gate = await requirePermission("podcasts.manage");
  if (!gate.ok) return gate.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "أرفق صورة الغلاف." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "الحد الأقصى 8MB." }, { status: 413 });
  const buffer = new Uint8Array(await file.arrayBuffer());
  const meta = readImageMeta(buffer);
  if (!meta || !EXT[meta.mime]) return NextResponse.json({ error: "الصيغ المقبولة: PNG أو JPEG أو WebP." }, { status: 415 });
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 600) {
    return NextResponse.json({ error: "الغلاف صغير؛ الأدنى 600×600 بكسل." }, { status: 400 });
  }
  if (Math.abs(meta.width - meta.height) / Math.max(meta.width, meta.height) > 0.05) {
    return NextResponse.json({ error: "الغلاف يجب أن يكون مربعًا." }, { status: 400 });
  }
  const filename = `${crypto.randomUUID()}.${EXT[meta.mime]}`;
  await putStoredImage({ filename, body: buffer, contentType: meta.mime });
  return NextResponse.json({ ok: true, url: `/uploads/${filename}` });
}
