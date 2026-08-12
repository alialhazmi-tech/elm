import { eq, inArray } from "drizzle-orm";

import { storyTopics } from "@/db/schema";
import { getDb } from "@/lib/db";
import { MEMBER_INTERESTS } from "@/lib/membership/interests";
import { seedContentProvider } from "@/lib/content/provider";
import { classifyStoryHeuristic, type StoryTopic } from "./math";

const inFlight = new Set<string>();

function mapTopicRows(rows: Array<{ topicKey: string; kind: string; weight: number }>): StoryTopic[] {
  return rows.map((row) => ({
    topicKey: row.topicKey,
    kind: row.kind as StoryTopic["kind"],
    weight: row.weight,
  }));
}

export async function loadStoryTopics(storyId: string): Promise<StoryTopic[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(storyTopics).where(eq(storyTopics.storyId, storyId));
  return mapTopicRows(rows);
}

export async function loadStoryTopicsMany(storyIds: string[]): Promise<Record<string, StoryTopic[]>> {
  const map: Record<string, StoryTopic[]> = {};
  const unique = [...new Set(storyIds)].filter(Boolean);
  if (!unique.length) return map;
  const db = getDb();
  if (!db) return map;
  const rows = await db.select().from(storyTopics).where(inArray(storyTopics.storyId, unique));
  for (const row of rows) {
    (map[row.storyId] ??= []).push({
      topicKey: row.topicKey,
      kind: row.kind as StoryTopic["kind"],
      weight: row.weight,
    });
  }
  return map;
}

export async function saveStoryTopics(
  storyId: string,
  topics: StoryTopic[],
  source: "heuristic" | "haiku",
  nowIso = new Date().toISOString(),
) {
  const db = getDb();
  if (!db || !topics.length) return;
  await db.delete(storyTopics).where(eq(storyTopics.storyId, storyId));
  await db.insert(storyTopics).values(
    topics.map((topic) => ({
      storyId,
      topicKey: topic.topicKey,
      kind: topic.kind,
      weight: topic.weight,
      source,
      updatedAt: nowIso,
    })),
  );
}

/** تصنيف حتمي من القسم/السلسلة/الكلمات — بلا نموذج. يُستدعى خارج مسار فتح المقال. */
export async function ensureStoryTopics(storyId: string): Promise<void> {
  if (inFlight.has(storyId)) return;
  inFlight.add(storyId);
  try {
    const existing = await loadStoryTopics(storyId);
    if (existing.length) return;
    const story = await seedContentProvider.getStory(storyId);
    if (!story) return;
    const topics = classifyStoryHeuristic(story, MEMBER_INTERESTS);
    await saveStoryTopics(storyId, topics, "heuristic");
    void classifyWithHaiku(storyId).catch(() => undefined);
  } finally {
    inFlight.delete(storyId);
  }
}

/**
 * Haiku 4.5 يصنّف المادة إلى اهتمامات القاموس مرة واحدة.
 * لا يُستدعى عند فتح المقال، ولا يكتب نصًا تحريريًا للعرض.
 */
async function classifyWithHaiku(storyId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const { loadAiSettings } = await import("@/lib/ai/settings");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const story = await seedContentProvider.getStory(storyId);
  if (!story) return;

  const settings = await loadAiSettings();
  const { budgetGate, logUsage, costCents } = await import("@/lib/ai/usage");
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return;
  const catalog = MEMBER_INTERESTS.map((item) => `${item.id}:${item.label}`).join("، ");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: settings.models.light,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content:
          `صنّف هذه المادة المنشورة إلى 1-4 اهتمامات من القائمة حصراً. أعد JSON فقط: {"interests":["id"]}.\n` +
          `القائمة: ${catalog}\n\nالعنوان: ${story.title}\nالموجز: ${story.excerpt}\nالقسم: ${story.section}`,
      },
    ],
  });
  const raw = response.content.find((block) => block.type === "text")?.text ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: { interests?: string[] };
  try {
    parsed = JSON.parse(jsonText) as { interests?: string[] };
  } catch {
    return;
  }
  const allowed = new Set(MEMBER_INTERESTS.map((item) => item.id));
  const ids = (parsed.interests ?? []).filter((id) => allowed.has(id)).slice(0, 4);
  await logUsage({
    tool: "story_topics",
    model: settings.models.light,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costCents: costCents(settings.models.light, response.usage.input_tokens, response.usage.output_tokens),
    actor: "system",
  });
  if (!ids.length) return;

  const base = classifyStoryHeuristic(story, MEMBER_INTERESTS);
  const extra: StoryTopic[] = ids.map((id) => ({
    topicKey: `interest:${id}`,
    kind: "interest",
    weight: 850,
  }));
  const merged = [...base];
  for (const topic of extra) {
    if (!merged.some((row) => row.topicKey === topic.topicKey)) merged.push(topic);
  }
  await saveStoryTopics(storyId, merged, "haiku");
}
