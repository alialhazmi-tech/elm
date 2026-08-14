/** إعدادات نظام الذكاء — صف jsonb واحد بقيم افتراضية آمنة، يديره رئيس التحرير. */

import { eq } from "drizzle-orm";

import { aiSettings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { DEFAULT_IMAGE_MODEL, normalizeImageModel } from "@/lib/ai/image-model";

export interface AiSettingsData {
  tools: {
    headlines: boolean;
    excerpt: boolean;
    improve: boolean;
    proofread: boolean;
    classify: boolean;
    seo: boolean;
    full_edit: boolean;
    jak: boolean;
    images: boolean;
  };
  models: { editorial: string; light: string; image: string; fast: string };
  caps: { dailyUsd: number; monthlyUsd: number };
  tone: string;
}

export const DEFAULT_AI_SETTINGS: AiSettingsData = {
  tools: {
    headlines: true,
    excerpt: true,
    improve: true,
    proofread: true,
    classify: true,
    seo: true,
    full_edit: true,
    jak: true,
    images: true,
  },
  models: {
    editorial: "claude-opus-5",
    light: "claude-haiku-4-5",
    fast: "claude-sonnet-5",
    image: DEFAULT_IMAGE_MODEL,
  },
  caps: { dailyUsd: 10, monthlyUsd: 150 },
  tone:
    "اكتب بعربية صحفية مباشرة بلا تهويل. العنوان حتى 10 كلمات بلا «شاهد» أو «صادم». " +
    "الأرقام لاتينية. المصدر يُنسب دائمًا. اتبع دستور العلم التحريري نصًا.",
};

export async function loadAiSettings(): Promise<AiSettingsData> {
  const db = getDb();
  if (!db) return DEFAULT_AI_SETTINGS;

  try {
    const rows = await db.select().from(aiSettings).where(eq(aiSettings.id, "main")).limit(1);
    const stored = (rows[0]?.data ?? {}) as Partial<AiSettingsData>;
    return {
      tools: { ...DEFAULT_AI_SETTINGS.tools, ...stored.tools },
      models: {
        ...DEFAULT_AI_SETTINGS.models,
        ...stored.models,
        fast: stored.models?.fast ?? DEFAULT_AI_SETTINGS.models.fast,
        image: normalizeImageModel(stored.models?.image),
      },
      caps: { ...DEFAULT_AI_SETTINGS.caps, ...stored.caps },
      tone: stored.tone ?? DEFAULT_AI_SETTINGS.tone,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export async function saveAiSettings(data: AiSettingsData): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة.");

  await db
    .insert(aiSettings)
    .values({ id: "main", data, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: aiSettings.id,
      set: { data, updatedAt: new Date().toISOString() },
    });
}

/** حالة المفاتيح — تُعرض في الإعدادات ولا تُكشف قيمها أبدًا. */
export function keyStatus() {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    image: Boolean(process.env.GEMINI_API_KEY),
  };
}
