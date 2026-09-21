import { and, eq, ne } from "drizzle-orm";

import { memberTopicScores } from "@/db/schema";
import { getDb } from "@/lib/db";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import {
  applySignalToScores,
  classifyStoryHeuristic,
  topicKey,
  type StoryTopic,
  type TopicScore,
  type TopicSource,
  WEIGHTS,
} from "./math";
import { loadStoryTopics } from "./classify";
import { seedContentProvider } from "@/lib/content/provider";

export async function loadMemberScores(memberId: string): Promise<TopicScore[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(memberTopicScores)
    .where(eq(memberTopicScores.memberId, memberId));
  return rows.map((row) => ({
    topicKey: row.topicKey,
    kind: row.kind as TopicScore["kind"],
    source: row.source as TopicScore["source"],
    weight: row.weight,
    updatedAt: row.updatedAt,
  }));
}

export async function syncExplicitInterests(memberId: string, interestIds: string[], nowIso = new Date().toISOString()) {
  const db = getDb();
  if (!db) return;
  await db
    .delete(memberTopicScores)
    .where(and(eq(memberTopicScores.memberId, memberId), eq(memberTopicScores.source, "explicit")));

  const valid = interestIds.filter((id) => MEMBER_INTERESTS.some((item) => item.id === id));
  if (!valid.length) return;
  await db.insert(memberTopicScores).values(
    valid.map((id) => ({
      memberId,
      topicKey: topicKey("interest", id),
      kind: "interest" as const,
      source: "explicit" as const,
      weight: WEIGHTS.explicit,
      updatedAt: nowIso,
    })),
  ).onConflictDoUpdate({
    target: [memberTopicScores.memberId, memberTopicScores.topicKey],
    set: { source: "explicit", weight: WEIGHTS.explicit, kind: "interest", updatedAt: nowIso },
  });
}

export async function applyStorySignal(
  memberId: string,
  storyId: string,
  delta: number,
  source: TopicSource,
  nowIso: string,
) {
  const db = getDb();
  if (!db || !delta) return;

  let topics: StoryTopic[] = await loadStoryTopics(storyId);
  if (!topics.length) {
    const story = await seedContentProvider.getStory(storyId);
    if (story) topics = classifyStoryHeuristic(story, MEMBER_INTERESTS);
  }
  if (!topics.length) return;

  const current = await loadMemberScores(memberId);
  const next = applySignalToScores(current, topics, delta, source, nowIso);

  for (const row of next) {
    const previous = current.find((item) => item.topicKey === row.topicKey);
    if (previous && previous.weight === row.weight && previous.source === row.source) continue;
    await db
      .insert(memberTopicScores)
      .values({
        memberId,
        topicKey: row.topicKey,
        kind: row.kind,
        source: row.source,
        weight: row.weight,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: [memberTopicScores.memberId, memberTopicScores.topicKey],
        set: {
          kind: row.kind,
          source: row.source,
          weight: row.weight,
          updatedAt: row.updatedAt,
        },
      });
  }
}

export async function clearInferredScores(memberId: string) {
  const db = getDb();
  if (!db) return;
  await db
    .delete(memberTopicScores)
    .where(and(eq(memberTopicScores.memberId, memberId), ne(memberTopicScores.source, "explicit")));
}
