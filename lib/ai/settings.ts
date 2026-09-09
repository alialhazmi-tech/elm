/** إعدادات نظام الذكاء — صف jsonb واحد بقيم افتراضية آمنة، يديره رئيس التحرير. */

import { eq, sql, type SQL } from "drizzle-orm";

import { aiSettings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { DEFAULT_IMAGE_MODEL, normalizeImageModel } from "@/lib/ai/image-model";
import { aiProvider, effectiveModels, openRouterKey } from "./provider-config";

export interface AiSettingsData {
  tools: {
    headlines: boolean;
    excerpt: boolean;
    improve: boolean;
    proofread: boolean;
    classify: boolean;
    seo: boolean;
    full_edit: boolean;
    metadata: boolean;
    jak: boolean;
    images: boolean;
  };
  models: { editorial: string; light: string; image: string; fast: string };
  caps: { dailyUsd: number; monthlyUsd: number };
  tone: string;
  governance: {
    /** قواعد السياسة التحريرية النصية وبوابة الاعتماد. */
    editorialGuard: boolean;
    /** منع نشر صورة غير موثقة الحقوق — مستقل عن بقية قواعد الحارس. */
    requireImageRights: boolean;
  };
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
    metadata: true,
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
  governance: {
    editorialGuard: true,
    requireImageRights: true,
  },
  tone:
    "اكتب بعربية صحفية مباشرة بلا تهويل. العنوان حتى 10 كلمات بلا «شاهد» أو «صادم». " +
    "الأرقام لاتينية. المصدر يُنسب دائمًا. اتبع دستور العلم التحريري نصًا.",
};

/** تعديل جزئي: كل مفتاح اختياري ويُدمج فوق المخزّن داخل القاعدة نفسها (jsonb ||) بلا قراءة ثم كتابة. */
export interface AiSettingsPatch {
  tools?: Partial<AiSettingsData["tools"]>;
  models?: Partial<AiSettingsData["models"]>;
  caps?: Partial<AiSettingsData["caps"]>;
  governance?: Partial<AiSettingsData["governance"]>;
  tone?: string;
}

const NESTED_KEYS = ["tools", "models", "caps", "governance"] as const;

/**
 * كاش داخل العملية لـ30 ثانية: كل صفحة ومسار حارس يقرأ الإعدادات، وتغييرها نادر.
 * الحالة على globalThis لأن Next يحزم الصفحات ومسارات API بحزم منفصلة داخل العملية نفسها.
 */
export const AI_SETTINGS_TTL_MS = 30_000;
const holder = globalThis as typeof globalThis & { __alelmAiSettings?: { value: AiSettingsData; expiresAt: number } | null };

export function invalidateAiSettingsCache() {
  holder.__alelmAiSettings = null;
}

function defaults(): AiSettingsData {
  return { ...DEFAULT_AI_SETTINGS, models: effectiveModels(DEFAULT_AI_SETTINGS.models) };
}

function normalizeStored(data: unknown): AiSettingsData {
  const stored = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Partial<AiSettingsData>;
  return {
    tools: { ...DEFAULT_AI_SETTINGS.tools, ...stored.tools },
    models: effectiveModels({
      ...DEFAULT_AI_SETTINGS.models,
      ...stored.models,
      fast: stored.models?.fast ?? DEFAULT_AI_SETTINGS.models.fast,
      image: normalizeImageModel(stored.models?.image),
    }),
    caps: { ...DEFAULT_AI_SETTINGS.caps, ...stored.caps },
    governance: { ...DEFAULT_AI_SETTINGS.governance, ...stored.governance },
    tone: stored.tone ?? DEFAULT_AI_SETTINGS.tone,
  };
}

export async function loadAiSettings(): Promise<AiSettingsData> {
  const db = getDb();
  if (!db) return defaults();
  const cached = holder.__alelmAiSettings;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const rows = await db.select().from(aiSettings).where(eq(aiSettings.id, "main")).limit(1);
    const value = normalizeStored(rows[0]?.data);
    holder.__alelmAiSettings = { value, expiresAt: Date.now() + AI_SETTINGS_TTL_MS };
    return value;
  } catch {
    return defaults();
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
  invalidateAiSettingsCache();
}

/** دمج جزئي ذرّي في القاعدة؛ تعديلان متزامنان لمفاتيح مختلفة لا يُسقط أحدهما الآخر. يعيد الإعدادات الفعلية بعد الدمج. */
export async function patchAiSettings(patch: AiSettingsPatch): Promise<AiSettingsData> {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة.");
  const now = new Date().toISOString();
  const parts: SQL[] = [];
  const stored: Record<string, unknown> = {};
  for (const key of NESTED_KEYS) {
    const value = patch[key];
    if (!value || Object.keys(value).length === 0) continue;
    stored[key] = value;
    const literal = sql.raw(`'${key}'`);
    parts.push(sql`jsonb_build_object(${literal}, coalesce(${aiSettings.data}->${literal}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb)`);
  }
  if (patch.tone !== undefined) {
    stored.tone = patch.tone;
    parts.push(sql`jsonb_build_object('tone', ${patch.tone}::text)`);
  }
  const merge = parts.length ? sql.join(parts, sql` || `) : sql`'{}'::jsonb`;
  const result = await db.execute<{ data: unknown }>(sql`
    insert into ai_settings (id, data, updated_at) values ('main', ${JSON.stringify(stored)}::jsonb, ${now})
    on conflict (id) do update set data = coalesce(ai_settings.data, '{}'::jsonb) || ${merge}, updated_at = ${now}
    returning data`);
  invalidateAiSettingsCache();
  return normalizeStored(result.rows[0]?.data);
}

/** حالة المفاتيح — تُعرض في الإعدادات ولا تُكشف قيمها أبدًا. */
export function keyStatus() {
  return {
    provider: aiProvider(),
    openrouter: Boolean(openRouterKey()),
    editorial: aiProvider() === "openrouter" ? Boolean(openRouterKey()) : Boolean(process.env.ANTHROPIC_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    image: aiProvider() === "openrouter" ? Boolean(openRouterKey()) : Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
  };
}
