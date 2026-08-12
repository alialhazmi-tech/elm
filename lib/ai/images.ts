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

interface InteractionImage {
  data?: string;
  mime_type?: string;
  mimeType?: string;
}

interface InteractionResponse {
  output_image?: InteractionImage;
  steps?: Array<{
    type?: string;
    content?: Array<InteractionImage & { type?: string }>;
  }>;
}

/** يدعم خاصية output_image المختصرة، مع fallback للمخرجات المتداخلة. */
export function parseInteractionImages(data: InteractionResponse): GeneratedImage[] {
  const candidates: InteractionImage[] = [];
  if (data.output_image?.data) candidates.push(data.output_image);
  for (const step of data.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const block of step.content ?? []) {
      if (block.type === "image" && block.data) candidates.push(block);
    }
  }

  const seen = new Set<string>();
  return candidates
    .filter((image) => image.data && !seen.has(image.data) && seen.add(image.data))
    .map((image) => ({ base64: image.data!, mime: image.mime_type ?? image.mimeType ?? "image/png" }));
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
  const count = Math.min(2, Math.max(1, input.count ?? 2));
  const images: GeneratedImage[] = [];

  for (let index = 0; index < count; index += 1) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: input.model,
        input: fullPrompt,
        store: false,
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: SIZE_RATIOS[input.size] ?? "16:9",
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`مزود الصور رفض الطلب (${response.status}): ${detail.slice(0, 200)}`);
    }

    images.push(...parseInteractionImages((await response.json()) as InteractionResponse));
  }

  if (images.length === 0) throw new Error("لم يُعد المزود أي صورة — جرّب وصفًا مختلفًا.");
  return images;
}
