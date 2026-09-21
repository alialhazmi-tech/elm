import { and, eq, sql } from "drizzle-orm";
import { visitorStoryInteractions } from "@/db/schema";
import { getDb } from "@/lib/db";

export type InteractionInput = { storyId: string } & ({ liked: boolean } | { answer: 0 | 1 });

export function interactionInput(value: unknown): InteractionInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.storyId !== "string" || !/^[\w-]{1,100}$/.test(body.storyId)) return null;
  if (typeof body.liked === "boolean" && body.answer === undefined) return { storyId: body.storyId, liked: body.liked };
  if ((body.answer === 0 || body.answer === 1) && body.liked === undefined) return { storyId: body.storyId, answer: body.answer };
  return null;
}

export async function visitorInteraction(visitorId: string | null, storyId: string) {
  const db = getDb();
  if (!db) throw new Error("INTERACTIONS_UNAVAILABLE");
  if (!visitorId) return { liked: false, closingAnswer: null };
  const [row] = await db.select().from(visitorStoryInteractions).where(and(eq(visitorStoryInteractions.visitorId, visitorId), eq(visitorStoryInteractions.storyId, storyId))).limit(1);
  return { liked: row?.liked === 1, closingAnswer: row?.closingAnswer ?? null };
}

/** Upsert is atomic: retries, simultaneous answers and likes cannot add votes or overwrite one another. */
export async function saveVisitorInteraction(visitorId: string, input: InteractionInput) {
  const db = getDb();
  if (!db) throw new Error("INTERACTIONS_UNAVAILABLE");
  const now = new Date().toISOString();
  const change = "liked" in input
    ? { liked: input.liked ? 1 : 0, likedAt: input.liked ? now : null }
    : { closingAnswer: input.answer, answeredAt: now };
  const [row] = await db.insert(visitorStoryInteractions).values({ visitorId, storyId: input.storyId, ...change }).onConflictDoUpdate({
    target: [visitorStoryInteractions.visitorId, visitorStoryInteractions.storyId],
    set: "liked" in input ? {
      liked: input.liked ? 1 : 0,
      likedAt: input.liked ? sql`coalesce(${visitorStoryInteractions.likedAt}, ${now})` : null,
    } : {
      closingAnswer: input.answer,
      answeredAt: sql`coalesce(${visitorStoryInteractions.answeredAt}, ${now})`,
    },
  }).returning();
  if (!row) throw new Error("INTERACTION_NOT_SAVED");
  return { liked: row.liked === 1, closingAnswer: row.closingAnswer };
}
