import { NextResponse } from "next/server";

import { putStoredImage } from "@/lib/storage/images";
import { requirePermission } from "@/lib/tahrir/access";
import { readImageMeta } from "@/lib/tahrir/imageMeta";
import { addMedia } from "@/lib/tahrir/service";

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * رفع صورة إلى المكتبة — تحفظ في مخزن S3 المتوافق بمسار UUID قصير.
 * الحقوق تبدأ
 * غير موثقة دائمًا (الدستور §12) حتى يوثقها معتمد.
 */
export async function POST(request: Request) {
  const gate = await requirePermission("media.upload");
  if (!gate.ok) return gate.response;
  const session = gate.actor;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "أرفق ملف صورة." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى 8MB." }, { status: 413 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const meta = readImageMeta(buffer);
  if (!meta || !EXT[meta.mime]) {
    return NextResponse.json({ error: "الصيغ المقبولة: PNG أو JPEG أو WebP." }, { status: 415 });
  }

  const id = crypto.randomUUID();
  const filename = `${id}.${EXT[meta.mime]}`;
  const url = `/uploads/${filename}`;
  await putStoredImage({ filename, body: buffer, contentType: meta.mime });

  await addMedia(
    {
      id,
      url,
      filename: file.name || `صورة-${id.slice(0, 8)}`,
      mime: meta.mime,
      bytes: file.size,
      width: meta.width,
      height: meta.height,
      rightsCleared: 0,
      flags: "",
      uploadedBy: session.displayName,
      aiGenerated: 0,
    },
    session.username,
  );

  return NextResponse.json({ ok: true, id, url });
}
