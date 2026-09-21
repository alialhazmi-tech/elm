import { eq, sql } from "drizzle-orm";
import { aiSettings } from "@/db/schema";
import { getDb } from "@/lib/db";
import { cachedPublicQuery } from "./cache";
import { TAXONOMY_SECTIONS, TAXONOMY_SERIES, taxonomyKey, visibleTaxonomy, type TaxonomyKind, type TaxonomyVisibility } from "./taxonomy";

// صف مستقل داخل مخزن إعدادات المنصة الحالي؛ لا يمس نماذج الذكاء أو سقوفه.
const SETTINGS_ID = "taxonomy-visibility";

export async function loadTaxonomyVisibility(): Promise<TaxonomyVisibility> {
  const db = getDb();
  if (!db) return {};
  const [row] = await db.select({ data: aiSettings.data }).from(aiSettings).where(eq(aiSettings.id, SETTINGS_ID)).limit(1);
  if (!row?.data || typeof row.data !== "object" || Array.isArray(row.data)) return {};
  return Object.fromEntries(Object.entries(row.data).filter(([, value]) => typeof value === "boolean"));
}

export async function loadEditorialTaxonomy() {
  return visibleTaxonomy(await loadTaxonomyVisibility());
}

export function loadPublicTaxonomy() {
  return cachedPublicQuery("taxonomy:visibility", 300_000, loadEditorialTaxonomy)
    .catch(() => ({ sections: [], series: [] }));
}

export async function setTaxonomyHidden(kind: TaxonomyKind, slug: string, hidden: boolean) {
  const catalog = kind === "section" ? TAXONOMY_SECTIONS : TAXONOMY_SERIES;
  if (!catalog.some(item => item.slug === slug)) throw new Error("التصنيف غير معروف.");
  // يبقى قسم عام صالح للمسودات الجديدة وللمواد التي لا تناسب قسمًا متخصصًا.
  if (kind === "section" && slug === "news" && hidden) throw new Error("قسم أخبار هو القسم العام؛ يجب إبقاؤه ظاهرًا.");
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة.");
  const key = taxonomyKey(kind, slug);
  await db.insert(aiSettings).values({ id: SETTINGS_ID, data: { [key]: hidden }, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: aiSettings.id, set: {
      data: sql`coalesce(${aiSettings.data}, '{}'::jsonb) || ${JSON.stringify({ [key]: hidden })}::jsonb`,
      updatedAt: new Date().toISOString(),
    } });
}
