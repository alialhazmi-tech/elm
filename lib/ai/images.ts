/**
 * توليد صور العلم — الأنماط الثلاثة المعتمدة فوق مزود التوليد (Gemini/Imagen).
 * كل صورة توسم «مولّدة بالذكاء» وتدخل المكتبة موثقة الحقوق (حقوق داخلية).
 */

const STYLE_PROMPTS: Record<string, string> = {
  real:
    "Photorealistic editorial news photograph, professional press-lens look, natural light, " +
    "shallow depth of field. Absolutely no text, no watermark, no real person's face.",
  illustrative:
    "Editorial illustration, painterly conceptual digital art explaining the idea, " +
    "deep navy and warm gold accents. No text, no watermark, no real person's likeness.",
  graphic:
    "Flat vector infographic style, minimal geometric shapes, brand palette of deep navy, gold and " +
    "spectrum accents, clean negative space. No text, no watermark.",
};

export const IMAGE_STYLES = Object.keys(STYLE_PROMPTS);

const SIZE_RATIOS: Record<string, string> = { cover: "16:9", square: "1:1", portrait: "9:16" };

export interface GeneratedImage {
  base64: string;
  mime: string;
}

export async function generateImages(input: {
  prompt: string;
  style: string;
  size: string;
  model: string;
  count?: number;
}): Promise<GeneratedImage[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("مفتاح مزود الصور غير مضبوط — أضف GEMINI_API_KEY ثم أعد التشغيل.");
  }

  const stylePrompt = STYLE_PROMPTS[input.style] ?? STYLE_PROMPTS.illustrative;
  const fullPrompt = `${input.prompt}\n\nStyle: ${stylePrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${input.model}:predict`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: input.count ?? 2,
          aspectRatio: SIZE_RATIOS[input.size] ?? "16:9",
          personGeneration: "dont_allow",
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`مزود الصور رفض الطلب (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };

  const images = (data.predictions ?? [])
    .filter((prediction) => prediction.bytesBase64Encoded)
    .map((prediction) => ({
      base64: prediction.bytesBase64Encoded!,
      mime: prediction.mimeType ?? "image/png",
    }));

  if (images.length === 0) throw new Error("لم يُعد المزود أي صورة — جرّب وصفًا مختلفًا.");
  return images;
}
