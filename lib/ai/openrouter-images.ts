import { openRouterKey, openRouterModel } from "./provider-config.ts";
import type { GeneratedImage } from "./images.ts";

export function imageExtension(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  throw new Error("صيغة الصورة غير مدعومة.");
}

export function parseOpenRouterImages(value: unknown): GeneratedImage[] {
  const result = value as { data?: Array<{ b64_json?: unknown; media_type?: unknown }>; usage?: { cost?: unknown } } | null;
  if (!result || !Array.isArray(result.data) || !result.data.length) throw new Error("لم يُرجع OpenRouter صورة مكتملة.");
  const cost = result.usage?.cost;
  const measured = typeof cost === "number" && Number.isFinite(cost) && cost >= 0;
  return result.data.map((item, index) => {
    const base64 = item?.b64_json;
    const mime = typeof item?.media_type === "string" ? item.media_type : "image/png";
    imageExtension(mime);
    if (typeof base64 !== "string" || !base64.length || base64.length > 40_000_000 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("بيانات الصورة من OpenRouter غير صالحة.");
    const bytes = Buffer.from(base64, "base64");
    const valid = mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid) throw new Error("صيغة الصورة لا تطابق بياناتها.");
    return { base64, mime, ...(measured ? { costCents: index === 0 ? Math.ceil(cost * 100) : 0 } : {}) };
  });
}

export async function generateViaOpenRouter(input: { prompt: string; size: string; model: string; count: number; signal?: AbortSignal }): Promise<GeneratedImage[]> {
  const apiKey = openRouterKey();
  if (!apiKey) throw new Error("مفتاح OpenRouter غير مضبوط — أضف OPENROUTER_API_KEY في أسرار التشغيل.");
  const timeout = AbortSignal.timeout(120_000);
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://alelm.net", "X-OpenRouter-Title": "Al Elm" },
    signal: input.signal ? AbortSignal.any([input.signal, timeout]) : timeout,
    body: JSON.stringify({ model: openRouterModel(input.model, true), prompt: input.prompt, n: input.count, aspect_ratio: ({ cover: "16:9", square: "1:1", portrait: "9:16" } as Record<string, string>)[input.size] ?? "16:9" }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`OpenRouter رفض توليد الصورة (${response.status}). راجع الرصيد والمفتاح والنموذج.`);
  }
  return parseOpenRouterImages(await response.json());
}
