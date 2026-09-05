import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { seedContentProvider } from "@/lib/content/provider";
import { getSessionMemberId, privateJson } from "@/lib/personalization/session";
import { getLiked, loadStats, setLiked } from "@/lib/personalization/likes";
import { persistStatsAndSignal } from "@/lib/personalization/events";
import { closingAnswerCounts } from "@/lib/personalization/poll";
import { interactionInput, saveVisitorInteraction, visitorInteraction } from "@/lib/personalization/public-interactions";
import { readingOrigin, READING_COOKIE, UUID } from "@/lib/personalization/reading-input";
import { consumeLimit } from "@/lib/tahrir/rate-limit";

async function identity() {
  const value = (await cookies()).get(READING_COOKIE)?.value;
  return { visitorId: value && UUID.test(value) ? value : null, memberId: await getSessionMemberId() };
}

async function memberInteraction(memberId: string, storyId: string) {
  const [liked, stats] = await Promise.all([getLiked(memberId, storyId), loadStats(memberId, storyId)]);
  return { liked, closingAnswer: stats?.closingAnswer ?? null };
}

export async function GET(request: Request) {
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!/^[\w-]{1,100}$/.test(storyId)) return privateJson({ error: "INVALID_STORY" }, 400);
  try {
    if (!getDb()) throw new Error("NO_DATABASE");
    if (!await seedContentProvider.getStory(storyId)) return privateJson({ error: "STORY_NOT_FOUND" }, 404);
    const { visitorId, memberId } = await identity();
    const [state, counts] = await Promise.all([
      memberId ? memberInteraction(memberId, storyId) : visitorInteraction(visitorId, storyId),
      closingAnswerCounts(storyId),
    ]);
    const response = privateJson({ ...state, counts });
    if (!visitorId) {
      const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (!await consumeLimit("public-interaction-session", network, 120, 60)) return privateJson({ error: "RATE_LIMITED" }, 429);
      const secure = new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
      response.headers.append("Set-Cookie", `${READING_COOKIE}=${crypto.randomUUID()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure ? "; Secure" : ""}`);
    }
    return response;
  } catch { return privateJson({ error: "INTERACTIONS_UNAVAILABLE" }, 503); }
}

export async function POST(request: Request) {
  const origin = readingOrigin(request);
  if (!origin) return privateJson({ error: "ORIGIN_REJECTED" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return privateJson({ error: "JSON_REQUIRED" }, 415);
  const reader = request.body?.getReader();
  let text = "", size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) { await reader.cancel(); return privateJson({ error: "BODY_TOO_LARGE" }, 413); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch { return privateJson({ error: "INVALID_BODY" }, 400); }
    finally { reader.releaseLock(); }
  }
  const input = interactionInput(await Promise.resolve().then(() => JSON.parse(text)).catch(() => null));
  if (!input) return privateJson({ error: "INVALID_INTERACTION" }, 400);
  try {
    if (!getDb()) throw new Error("NO_DATABASE");
    const current = await identity();
    const visitorId = current.visitorId ?? crypto.randomUUID();
    const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!await consumeLimit("public-interaction-network", network, 120, 60) || !await consumeLimit("public-interaction", current.memberId ?? visitorId, 30, 60)) return privateJson({ error: "RATE_LIMITED" }, 429);
    if (!await seedContentProvider.getStory(input.storyId)) return privateJson({ error: "STORY_NOT_FOUND" }, 404);
    let state;
    if (current.memberId) {
      if ("liked" in input) await setLiked(current.memberId, input.storyId, input.liked);
      else {
        const saved = await persistStatsAndSignal(current.memberId, input.storyId, "closing_answer", new Date().toISOString(), { value: input.answer });
        if (!saved) throw new Error("NOT_SAVED");
      }
      state = await memberInteraction(current.memberId, input.storyId);
    } else state = await saveVisitorInteraction(visitorId, input);
    const counts = await closingAnswerCounts(input.storyId);
    const response = privateJson({ ...state, counts });
    if (!current.visitorId) response.headers.append("Set-Cookie", `${READING_COOKIE}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(origin).protocol === "https:" ? "; Secure" : ""}`);
    return response;
  } catch { return privateJson({ error: "INTERACTIONS_UNAVAILABLE" }, 503); }
}
