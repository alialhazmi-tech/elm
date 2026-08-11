/**
 * «جاك العلم» — طبقة بيانات الشرائح.
 *
 * العقد المركزي: المادة الأم صف في stories بشكل jakalelm، وstories.body
 * يُبنى آليًا كإسقاط نصي من الشرائح مع كل حفظ — فيعمل الحارس والبحث
 * والموجز ودقائق القراءة على جاك بلا أي تخصيص.
 */

// استيرادات نسبية عمدًا — الملف يدخل حزمة اختبارات node:test التي لا تعرف alias ‏@/.
import { asc, eq } from "drizzle-orm";

import { jakSources, stories, storySlides } from "../../db/schema.ts";
import { getDb } from "../db.ts";

export const JAK_FORMAT = "jakalelm";

export const SLIDE_TYPES = [
  "hero", "text", "stat", "comparison", "timeline",
  "quote", "list", "fact", "summary", "end",
] as const;
export type SlideType = (typeof SLIDE_TYPES)[number];

export const SLIDE_TYPE_NAMES: Record<SlideType, string> = {
  hero: "افتتاحية",
  text: "نص وخلفية",
  stat: "رقم متحرك",
  comparison: "مقارنة",
  timeline: "تسلسل زمني",
  quote: "اقتباس",
  list: "قائمة",
  fact: "حقيقة سريعة",
  summary: "خلاصة",
  end: "ختامية",
};

/** تفاصيل النوع داخل عمود data — المعنى لا الشكل. */
export interface SlideData {
  /** مقارنة: طرفان. */
  sides?: Array<{ label: string; value: string }>;
  /** تسلسل: نقاط. */
  points?: Array<{ year: string; title: string; detail: string }>;
  /** قائمة: عناصر. */
  items?: string[];
  /** اقتباس: النسبة. */
  quoteBy?: string;
}

export interface JakSlide {
  id: string;
  type: SlideType;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  image: string | null;
  imageStyle: string | null;
  imagePrompt: string;
  sourceContext: string;
  hidden: boolean;
  data: SlideData | null;
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة — «جاك العلم» يتطلب DATABASE_URL.");
  return db;
}

export async function listSlides(storyId: string): Promise<JakSlide[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(storySlides)
    .where(eq(storySlides.storyId, storyId))
    .orderBy(asc(storySlides.position));

  return rows.map((row) => ({
    id: row.id,
    type: (SLIDE_TYPES as readonly string[]).includes(row.type) ? (row.type as SlideType) : "text",
    title: row.title,
    body: row.body,
    stat: row.stat,
    statLabel: row.statLabel,
    image: row.image,
    imageStyle: row.imageStyle,
    imagePrompt: row.imagePrompt,
    sourceContext: row.sourceContext,
    hidden: row.hidden === 1,
    data: (row.data as SlideData) ?? null,
  }));
}

/** الإسقاط النصي للشرائح — يصير stories.body فيفحصه الحارس ويجده البحث. */
export function projectSlides(slides: JakSlide[]): string {
  const parts: string[] = [];
  for (const slide of slides) {
    if (slide.hidden) continue;
    const chunk = [
      slide.title,
      slide.stat && `${slide.stat} — ${slide.statLabel}`.trim(),
      slide.body,
      slide.data?.quoteBy,
      slide.data?.items?.join("، "),
      slide.data?.sides?.map((side) => `${side.label}: ${side.value}`).join(" مقابل "),
      slide.data?.points?.map((point) => `${point.year} ${point.title} ${point.detail}`).join(". "),
    ]
      .filter(Boolean)
      .join("\n");
    if (chunk.trim()) parts.push(chunk.trim());
  }
  return parts.join("\n\n");
}

/**
 * حفظ مجموعة الشرائح كاملة (استبدال) + مزامنة إسقاط المتن على المادة الأم.
 * الاستبدال الكامل يجعل الترتيب والحذف والإضافة عملية واحدة بلا سباقات مواضع.
 */
export async function replaceSlides(
  storyId: string,
  slides: JakSlide[],
  actor: string,
  source?: string,
): Promise<void> {
  const db = requireDb();
  const now = new Date().toISOString();

  await db.delete(storySlides).where(eq(storySlides.storyId, storyId));
  if (slides.length > 0) {
    await db.insert(storySlides).values(
      slides.map((slide, position) => ({
        id: slide.id || crypto.randomUUID(),
        storyId,
        position,
        type: slide.type,
        title: slide.title,
        body: slide.body,
        stat: slide.stat,
        statLabel: slide.statLabel,
        image: slide.image,
        imageStyle: slide.imageStyle,
        imagePrompt: slide.imagePrompt,
        sourceContext: slide.sourceContext,
        hidden: slide.hidden ? 1 : 0,
        data: slide.data,
      })),
    );
  }

  await db
    .update(stories)
    .set({ body: projectSlides(slides), updatedAt: now })
    .where(eq(stories.id, storyId));

  if (source !== undefined && source.trim()) {
    await db
      .insert(jakSources)
      .values({ storyId, source, updatedAt: now })
      .onConflictDoUpdate({ target: jakSources.storyId, set: { source, updatedAt: now } });
  }

  const { audit } = await import("./service");
  await audit(actor, "jak:slides-save", storyId, `${slides.length} شريحة`);
}

export async function getJakSource(storyId: string): Promise<string> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(jakSources)
    .where(eq(jakSources.storyId, storyId))
    .limit(1);
  return rows[0]?.source ?? "";
}
