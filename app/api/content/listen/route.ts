import { seedContentProvider } from "@/lib/content/provider";
import { stripHtmlToText } from "@/lib/content/html";
import { readingOrigin } from "@/lib/personalization/reading-input";
import { consumeLimit } from "@/lib/tahrir/rate-limit";
import { getStoredVoice, putStoredVoice } from "@/lib/storage/voice";
import { audioKey, speechChunks, synthesizeSummary, voiceConfig } from "@/lib/voice/humain";

export const runtime = "nodejs";
const json = (error: string, status: number, retry?: number) => Response.json({ error }, { status,
  headers: { "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) } });
export async function POST(request: Request) {
  if (!readingOrigin(request)) return json("طلب الاستماع غير مسموح.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json("طلب غير صالح.", 415);
  // Only public identifiers are accepted; the endpoint cannot synthesize arbitrary visitor text.
  const reader = request.body?.getReader();
  if (!reader) return json("طلب غير صالح.", 400);
  let body = "", size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; if (size > 512) { await reader.cancel(); return json("طلب طويل جدًا.", 413); }
      body += decoder.decode(chunk.value, { stream: true }); }
    body += decoder.decode();
  } catch { return json("طلب غير صالح.", 400); } finally { reader.releaseLock(); }
  const input = await Promise.resolve().then(() => JSON.parse(body)).catch(() => null);
  if (!input || typeof input !== "object" || Object.keys(input).some(key => !["kind", "storyId"].includes(key)) ||
    !(input.kind === "home" || (input.kind === "story" && typeof input.storyId === "string" && /^[\w-]{1,100}$/.test(input.storyId)))) return json("طلب غير صالح.", 400);
  try {
    const config = voiceConfig();
    const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!await consumeLimit("voice-requests", network, 60, 60)) return json("طلبات كثيرة؛ حاول بعد قليل.", 429, 60);
    let text: string;
    if (input.kind === "home") {
      const home = await seedContentProvider.getHome();
      text = home.brief.map(item => item.title).join(". ");
    } else {
      const story = await seedContentProvider.getStory(input.storyId);
      if (!story) return json("المادة غير متاحة.", 404);
      text = story.excerpt;
    }
    text = stripHtmlToText(text).replace(/\s+/gu, " ").trim();
    if (!text) return json("لا يوجد موجز متاح للاستماع.", 404);
    speechChunks(text);
    const hash = audioKey(text, config);
    let audio = await getStoredVoice(hash);
    if (!audio) {
      // Shared atomic lease prevents concurrent replicas from generating the same audio.
      if (!await consumeLimit("voice-generation-lock", hash, 1, 120)) return json("يجري تجهيز هذا الموجز؛ حاول بعد قليل.", 409, 5);
      const hourly = Number(process.env.HUMAIN_VOICE_HOURLY_LIMIT || 100);
      if (!Number.isInteger(hourly) || hourly < 1 || hourly > 1000) throw new Error("VOICE_CONFIG_INVALID");
      if (!await consumeLimit("voice-generation-hour", "global", hourly, 3600)) return json("الاستماع غير متاح مؤقتًا؛ حاول لاحقًا.", 429, 60);
      audio = await synthesizeSummary(text, config);
      await putStoredVoice(hash, audio);
    }
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/wav", "Content-Length": String(audio.byteLength),
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message) ? error.message : "VOICE_UNAVAILABLE";
    console.error("[voice]", code);
    return json("تعذر تجهيز الصوت الآن. حاول مرة أخرى بعد قليل.", 503);
  }
}
