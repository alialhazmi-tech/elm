/**
 * توليد صور العلم — دعم مزودي التوليد (Google Gemini/Imagen و OpenAI DALL-E 3).
 * كل صورة توسم «مولّدة بالذكاء» وتدخل المكتبة موثقة الحقوق.
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
  isolated_3d:
    "Single centered subject isolated on solid pitch black background (#000000), intense cinematic studio rim lighting, pure black void background, zero background clutter, no floor, no shadows, no checkerboard pattern, ultra sharp 8k detail.",
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

/** توليد الصور عبر OpenAI DALL-E 3 / GPT */
async function generateViaOpenAI(input: {
  prompt: string;
  size: string;
  apiKey: string;
}): Promise<GeneratedImage[]> {
  const sizeMap: Record<string, string> = {
    cover: "1792x1024",
    portrait: "1024x1792",
    square: "1024x1024",
  };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: input.prompt,
      n: 1,
      size: sizeMap[input.size] ?? "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`مزود OpenAI DALL-E رفض الطلب (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const items = data.data ?? [];
  return items
    .filter((it) => it.b64_json)
    .map((it) => ({
      base64: it.b64_json!,
      mime: "image/png",
    }));
}

/** توليد الصور عبر Google Gemini / Imagen (Nano Banana Pro / Gemini Image) */
async function generateViaGemini(input: {
  prompt: string;
  size: string;
  model: string;
  count: number;
  apiKey: string;
}): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = [];

  for (let index = 0; index < input.count; index += 1) {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey },
      body: JSON.stringify({
        model: input.model || "gemini-3.1-flash-image",
        input: input.prompt,
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
      throw new Error(`مزود الصور Gemini رفض الطلب (${response.status}): ${detail.slice(0, 200)}`);
    }

    images.push(...parseInteractionImages((await response.json()) as InteractionResponse));
  }

  return images;
}

export async function generateImages(input: {
  prompt: string;
  style: string;
  size: string;
  model: string;
  provider?: "gemini" | "openai" | "auto";
  count?: number;
}): Promise<GeneratedImage[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  const stylePrompt = STYLE_PROMPTS[input.style] ?? STYLE_PROMPTS.illustrative;
  const fullPrompt = `${input.prompt}\n\nStyle: ${stylePrompt}`;
  const count = Math.min(2, Math.max(1, input.count ?? 1));

  // إذا طلب OpenAI أو كان مفتاح OpenAI متوفراً بمفرده
  if ((input.provider === "openai" || (!geminiKey && openAiKey)) && openAiKey) {
    return generateViaOpenAI({
      prompt: fullPrompt,
      size: input.size,
      apiKey: openAiKey,
    });
  }

  // استخدام Gemini / Imagen افتراضياً
  if (geminiKey) {
    try {
      return await generateViaGemini({
        prompt: fullPrompt,
        size: input.size,
        model: input.model,
        count,
        apiKey: geminiKey,
      });
    } catch (err) {
      // إذا فشل Gemini وكان مفتاح OpenAI متوفراً، يتم التراجع تلقائياً إلى DALL-E 3
      if (openAiKey) {
        return generateViaOpenAI({
          prompt: fullPrompt,
          size: input.size,
          apiKey: openAiKey,
        });
      }
      throw err;
    }
  }

  if (openAiKey) {
    return generateViaOpenAI({
      prompt: fullPrompt,
      size: input.size,
      apiKey: openAiKey,
    });
  }

  throw new Error("لا يوجد مفتاح مزود صور متاح — أضف GEMINI_API_KEY أو OPENAI_API_KEY في .env.local.");
}
