import { NextResponse } from "next/server";

import { generateImages } from "@/lib/ai/images";
import { imageExtension } from "@/lib/ai/openrouter-images";
import { aiProvider } from "@/lib/ai/provider-config";
import { type InfographicData } from "@/lib/ai/infographic-types";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, logUsage } from "@/lib/ai/usage";
import { putStoredImage } from "@/lib/storage/images";
import { requirePermission } from "@/lib/tahrir/access";
import { addMedia, audit } from "@/lib/tahrir/service";

/**
 * توليد الصور الحقيقية للإنفوجرافيك عبر Gemini (Nano Banana) أو OpenAI DALL-E 3
 */
export async function POST(request: Request) {
  const access = await requirePermission("ai.infographic");
  if (!access.ok) return access.response;
  const session = access.actor;

  const input = (await request.json().catch(() => null)) as {
    infographic?: InfographicData;
    provider?: "gemini" | "openai" | "auto";
  } | null;

  if (!input?.infographic) {
    return NextResponse.json({ error: "بيانات الإنفوجرافيك مطلوبة." }, { status: 400 });
  }

  const settings = await loadAiSettings();
  if (!settings.tools.images) return NextResponse.json({ error: "توليد الصور معطل من إعدادات الذكاء." }, { status: 403 });
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 429 });
  }

  const infographic = { ...input.infographic };
  const provider = aiProvider() === "openrouter" ? "openrouter" : input.provider || "auto";
  const model = settings.models.image;

  let attemptedImages = 0;
  let completedImages = 0;
  const warnings: string[] = [];
  try {
    // 1. توليد صورة الخلفية للرأس (Hero Background)
    if (infographic.hero?.bgPrompt && !infographic.hero.bgImageUrl) {
      try {
        attemptedImages++;
        const heroImages = await generateImages({
          prompt: infographic.hero.bgPrompt,
          style: "illustrative",
          size: "cover",
          model,
          provider,
          count: 1,
          signal: request.signal,
        });
        if (heroImages[0]) {
          const id = crypto.randomUUID();
          const ext = imageExtension(heroImages[0].mime);
          const bytes = Buffer.from(heroImages[0].base64, "base64");
          await putStoredImage({ filename: `${id}.${ext}`, body: bytes, contentType: heroImages[0].mime });
          await addMedia(
            {
              id,
              url: `/uploads/${id}.${ext}`,
              filename: `info-hero-${id.slice(0, 6)}.${ext}`,
              mime: heroImages[0].mime,
              bytes: bytes.length,
              width: null,
              height: null,
              flags: "",
              aiGenerated: 1,
              rightsCleared: 1,
              uploadedBy: session.displayName,
            },
            session.username,
          );
          infographic.hero.bgImageUrl = `/uploads/${id}.${ext}`;
          completedImages++;
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : "تعذر توليد خلفية المادة.");
      }
    }

    // 2. توليد صور العناصر العائمة ثلاثية الأبعاد (3D Showcase Assets)
    if (infographic.showcaseSection?.items?.length) {
      const updatedItems = [...infographic.showcaseSection.items];
      for (let i = 0; i < Math.min(updatedItems.length, 4); i += 1) {
        const item = updatedItems[i];
        if (item.imagePrompt && !item.imageUrl) {
          try {
            attemptedImages++;
            const itemImages = await generateImages({
              prompt: item.imagePrompt,
              style: "isolated_3d",
              size: "square",
              model,
              provider,
              count: 1,
              signal: request.signal,
            });
            if (itemImages[0]) {
              const id = crypto.randomUUID();
              const ext = imageExtension(itemImages[0].mime);
              const bytes = Buffer.from(itemImages[0].base64, "base64");
              await putStoredImage({ filename: `${id}.${ext}`, body: bytes, contentType: itemImages[0].mime });
              await addMedia(
                {
                  id,
                  url: `/uploads/${id}.${ext}`,
                  filename: `info-item-${item.id}-${id.slice(0, 6)}.${ext}`,
                  mime: itemImages[0].mime,
                  bytes: bytes.length,
                  width: null,
                  height: null,
                  flags: "",
                  aiGenerated: 1,
                  rightsCleared: 1,
                  uploadedBy: session.displayName,
                },
                session.username,
              );
              updatedItems[i] = { ...item, imageUrl: `/uploads/${id}.${ext}` };
              completedImages++;
            }
          } catch (err) {
            warnings.push(err instanceof Error ? err.message : "تعذر توليد صورة من التصميم.");
          }
        }
      }
      infographic.showcaseSection.items = updatedItems;
    }

    // تسجيل الاستخدام والتدقيق
    await logUsage({
      reservationId: gate.reservationId,
      tool: "infographic-images",
      model: `${provider}:estimated`,
      inputTokens: 0,
      outputTokens: 0,
      costCents: attemptedImages * 100, // تقدير حجز محافظ، لا فاتورة مزود
      actor: session.username,
    });

    await audit(session.username, "ai:infographic-images", undefined, `${infographic.title} · ${provider}`);

    if (attemptedImages > 0 && completedImages === 0) return NextResponse.json({ error: warnings[0] ?? "لم يكتمل توليد أي صورة." }, { status: 502 });
    return NextResponse.json({ ok: true, infographic, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر توليد صور الإنفوجرافيك.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
