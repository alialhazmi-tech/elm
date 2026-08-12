import { NextResponse } from "next/server";

import { generateImages, IMAGE_STYLES } from "@/lib/ai/images";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, logUsage } from "@/lib/ai/usage";
import { putStoredImage } from "@/lib/storage/images";
import { getSession } from "@/lib/tahrir/auth";
import { addMedia, audit } from "@/lib/tahrir/service";

/** كلفة تقديرية لكل صورة بالسنت — تُحتسب ضمن السقوف نفسها. */
const IMAGE_COST_CENTS = 4;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

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
    });

    const saved = [];
    for (const image of images) {
      const id = crypto.randomUUID();
      const ext = image.mime.includes("jpeg") ? "jpg" : "png";
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
      tool: "image",
      model: settings.models.image,
      inputTokens: 0,
      outputTokens: 0,
      costCents: IMAGE_COST_CENTS * saved.length,
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
