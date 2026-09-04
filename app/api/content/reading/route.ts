import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { memberProfiles, storyReadingSessions } from "@/db/schema";
import { getDb } from "@/lib/db";
import { seedContentProvider } from "@/lib/content/provider";
import { getSessionMemberId, privateJson } from "@/lib/personalization/session";
import { readingInput, readingOrigin, READING_COOKIE, UUID } from "@/lib/personalization/reading-input";
import { consumeLimit } from "@/lib/tahrir/rate-limit";

export async function POST(request: Request) {
  const origin = readingOrigin(request);
  if (!origin) return privateJson({ error: "ORIGIN_REJECTED" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return privateJson({ error: "JSON_REQUIRED" }, 415);
  const reader = request.body?.getReader();
  let text = "";
  let size = 0;
  if (reader) {
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) { await reader.cancel(); break; }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } catch { return privateJson({ error: "INVALID_BODY" }, 400); }
    finally { reader.releaseLock(); }
  }
  if (size > 1024) return privateJson({ error: "BODY_TOO_LARGE" }, 413);
  const input = readingInput(await Promise.resolve().then(() => JSON.parse(text)).catch(() => null));
  if (!input) return privateJson({ error: "INVALID_READING" }, 400);
  const db = getDb();
  if (!db) return privateJson({ error: "READING_UNAVAILABLE" }, 503);
  try {
    const jar = await cookies();
    const current = jar.get(READING_COOKIE)?.value;
    const visitorId = current && UUID.test(current) ? current : crypto.randomUUID();
    if (current !== visitorId) {
      const network = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (!await consumeLimit("public-reading-new", network, 120, 60)) return privateJson({ error: "RATE_LIMITED" }, 429);
    }
    if (!await consumeLimit("public-reading", visitorId, 30, 60)) return privateJson({ error: "RATE_LIMITED" }, 429);
    if (!await seedContentProvider.getStory(input.storyId)) return privateJson({ error: "STORY_NOT_FOUND" }, 404);
    const memberId = await getSessionMemberId();
    if (memberId) {
      const [profile] = await db.select({ enabled: memberProfiles.personalizationEnabled }).from(memberProfiles).where(eq(memberProfiles.authUserId, memberId)).limit(1);
      if (profile?.enabled === 0) return privateJson({ accepted: false });
    }
    const now = new Date().toISOString();
    await db.insert(storyReadingSessions).values({ visitorId, storyId: input.storyId, sessionId: input.sessionId, memberId, activeMs: 0, maxProgress: input.progress, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [storyReadingSessions.visitorId, storyReadingSessions.storyId, storyReadingSessions.sessionId],
        set: {
          // تكرار النبضة أو وصولها بترتيب مختلف لا يضاعف الوقت ولا يخفض التقدم.
          activeMs: sql`greatest(${storyReadingSessions.activeMs}, least(${input.activeMs}, least(7200000, greatest(0, floor(extract(epoch from (${now}::timestamptz - ${storyReadingSessions.createdAt}::timestamptz)) * 1000)))::int))`,
          maxProgress: sql`greatest(${storyReadingSessions.maxProgress}, ${input.progress})`,
          memberId: sql`coalesce(${memberId}, ${storyReadingSessions.memberId})`, updatedAt: now,
        },
      });
    const response = privateJson({ accepted: true });
    if (current !== visitorId) response.headers.append("Set-Cookie", `${READING_COOKIE}=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(origin).protocol === "https:" ? "; Secure" : ""}`);
    return response;
  } catch {
    return privateJson({ error: "READING_UNAVAILABLE" }, 503);
  }
}
