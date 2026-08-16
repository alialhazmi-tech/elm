import { NextResponse } from "next/server";

import { generateImages } from "@/lib/ai/images";
import { type InfographicData } from "@/lib/ai/infographic-types";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, logUsage } from "@/lib/ai/usage";
import { putStoredImage } from "@/lib/storage/images";
import { getSession } from "@/lib/tahrir/auth";
import { addMedia, audit } from "@/lib/tahrir/service";

/**
 * توليد الصور الحقيقية للإنفوجرافيك عبر Gemini (Nano Banana) أو OpenAI DALL-E 3
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "الجلسة منتهية، يرجى تسجيل الدخول." }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as {
    infographic?: InfographicData;
    provider?: "gemini" | "openai" | "auto";
  } | null;

  if (!input?.infographic) {
    return NextResponse.json({ error: "بيانات الإنفوجرافيك مطلوبة." }, { status: 400 });
  }

  const settings = await loadAiSettings();
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 429 });
  }

  const infographic = { ...input.infographic };
  const provider = input.provider || "auto";
  const model = settings.models.image;

  try {
    // 1. توليد صورة الخلفية للرأس (Hero Background)
    if (infographic.hero?.bgPrompt && !infographic.hero.bgImageUrl) {
      try {
        const heroImages = await generateImages({
          prompt: infographic.hero.bgPrompt,
          style: "illustrative",
          size: "cover",
          model,
          provider,
          count: 1,
        });
        if (heroImages[0]) {
          const id = crypto.randomUUID();
          const ext = heroImages[0].mime.includes("jpeg") ? "jpg" : "png";
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
        }
      } catch (err) {
        console.error("Failed to generate hero image:", err);
      }
    }

    // 2. توليد صور العناصر العائمة ثلاثية الأبعاد (3D Showcase Assets)
    if (infographic.showcaseSection?.items?.length) {
      const updatedItems = [...infographic.showcaseSection.items];
      for (let i = 0; i < Math.min(updatedItems.length, 4); i += 1) {
        const item = updatedItems[i];
        if (item.imagePrompt && !item.imageUrl) {
          try {
            const itemImages = await generateImages({
              prompt: item.imagePrompt,
              style: "isolated_3d",
              size: "square",
              model,
              provider,
              count: 1,
            });
            if (itemImages[0]) {
              const id = crypto.randomUUID();
              const ext = itemImages[0].mime.includes("jpeg") ? "jpg" : "png";
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
            }
          } catch (err) {
            console.error(`Failed to generate image for ${item.name}:`, err);
          }
        }
      }
      infographic.showcaseSection.items = updatedItems;
    }

    // تسجيل الاستخدام والتدقيق
    await logUsage({
      tool: "infographic-images",
      model: provider,
      inputTokens: 0,
      outputTokens: 0,
      costCents: 15,
      actor: session.username,
    });

    await audit(session.username, "ai:infographic-images", undefined, `${infographic.title} · ${provider}`);

    return NextResponse.json({ ok: true, infographic });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر توليد صور الإنفوجرافيك.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
