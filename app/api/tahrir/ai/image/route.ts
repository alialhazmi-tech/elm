import { NextResponse } from "next/server";

import { generateImages, IMAGE_STYLES } from "@/lib/ai/images";
import { imageExtension } from "@/lib/ai/openrouter-images";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, logUsage } from "@/lib/ai/usage";
import { putStoredImage } from "@/lib/storage/images";
import { requirePermission } from "@/lib/tahrir/access";
import { addMedia, audit } from "@/lib/tahrir/service";

/** كلفة تقديرية لكل صورة بالسنت — تُحتسب ضمن السقوف نفسها. */
const IMAGE_COST_CENTS = 100; // تقدير محافظ حتى تتوفر فاتورة المزود.

export async function POST(request: Request) {
  const access = await requirePermission("ai.image");
  if (!access.ok) return access.response;
  const session = access.actor;

  const input = (await request.json().catch(() => null)) as {
    prompt?: string;
    style?: string;
    size?: string;
    count?: number;
  } | null;

  if (!input?.prompt?.trim()) {
    return NextResponse.json({ error: "اكتب وصف الصورة." }, { status: 400 });
  }
  const style = IMAGE_STYLES.includes(input.style ?? "") ? input.style! : "illustrative";

  const settings = await loadAiSettings();
  if (!settings.tools.images) {
    return NextResponse.json({ error: "توليد الصور معطل من إعدادات الذكاء." }, { status: 403 });
  }
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 429 });

  try {
    const images = await generateImages({
      prompt: input.prompt.trim().slice(0, 2_000),
      style,
      size: input.size ?? "cover",
      model: settings.models.image,
      // مكتبة التوليد العامة تبقى بخيارين افتراضيًا؛ جاك يطلب صورة واحدة صراحةً.
      count: input.count === 1 ? 1 : 2,
      signal: request.signal,
    });

    const saved = [];
    for (const image of images) {
      const id = crypto.randomUUID();
      const ext = imageExtension(image.mime);
      const bytes = Buffer.from(image.base64, "base64");
      await putStoredImage({ filename: `${id}.${ext}`, body: bytes, contentType: image.mime });

      await addMedia(
        {
          id,
          url: `/uploads/${id}.${ext}`,
          filename: `مولدة-${style}-${id.slice(0, 6)}.${ext}`,
          mime: image.mime,
          bytes: bytes.length,
          width: null,
          height: null,
          // حقوق داخلية: الصورة إنتاجنا فتوثق تلقائيًا، وتوسم AI بشفافية.
          rightsCleared: 1,
          flags: "",
          uploadedBy: session.displayName,
          aiGenerated: 1,
        },
        session.username,
      );
      saved.push({ id, url: `/uploads/${id}.${ext}` });
    }

    await logUsage({
      reservationId: gate.reservationId,
      tool: "image",
      model: images.every(image => image.costCents !== undefined) ? settings.models.image : `${settings.models.image}:estimated`,
      inputTokens: 0,
      outputTokens: 0,
      costCents: images.every(image => image.costCents !== undefined) ? images.reduce((sum, image) => sum + image.costCents!, 0) : IMAGE_COST_CENTS * (input.count === 1 ? 1 : 2),
      actor: session.username,
    });
    await audit(session.username, "ai:image", undefined, `${style} · ${saved.length} صورة`);

    return NextResponse.json({ ok: true, images: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر التوليد.";
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
