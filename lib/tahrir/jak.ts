import { assertCanWrite, assertExpectedVersion, StoryWriteError, type WriteActor } from "./write-policy.ts";
import { invalidateStatusCounts } from "./status-counts.ts";
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

export const JAK_CANVASES = ["vertical", "landscape"] as const;
export type JakCanvas = (typeof JAK_CANVASES)[number];

export const REPORT_TEMPLATES = ["cover", "image-text", "stats", "grid"] as const;
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];

export const REPORT_TEMPLATE_NAMES: Record<ReportTemplate, string> = {
  cover: "غلاف سينمائي",
  "image-text": "صورة مع نص",
  stats: "لوحة أرقام",
  grid: "شبكة أفكار",
};

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
  /** نمط العرض: العمودي الحالي، أو صفحة تقرير أفقية 16:9. */
  canvas?: JakCanvas;
  /** قالب الصفحة الأفقية — لا يُستخدم في العرض العمودي. */
  template?: ReportTemplate;
  /** وحدات المحتوى الموزعة داخل قوالب الأرقام والشبكات. */
  blocks?: Array<{ title: string; body: string; value: string; label: string }>;
  /** موضع العنصر البصري ومساحة النص الآمنة لتوجيه الصورة والتخطيط. */
  focalPoint?: "left" | "center" | "right";
  textSafeArea?: "left" | "center" | "right";
  /** سطر تصنيفي قصير فوق العنوان. */
  eyebrow?: string;
  /** طابع التقرير اللوني — قرار على مستوى المادة يُختم على كل شرائحها. */
  palette?: ReportPalette;
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

/**
 * طابع بصري لكل تقرير: الهيكل والخطوط والمواضع ثابتة، وأربعة ألوان فقط تتغير.
 * الافتراضي economy — فالتقارير القديمة تبقى على الذهبي بلا لمسها.
 */
export const REPORT_PALETTES = {
  economy: { name: "اقتصاد ومال", base: "#0b1a33", base2: "#12284b", glow: "#f5b92e", glow2: "#ffd35e" },
  health: { name: "صحة وطب", base: "#04201f", base2: "#0a3a37", glow: "#17c9b1", glow2: "#5fe8d5" },
  sport: { name: "رياضة", base: "#06200f", base2: "#0c3a1c", glow: "#63d471", glow2: "#a6f0a0" },
  tech: { name: "تقنية وعلوم", base: "#120a2e", base2: "#221452", glow: "#8b5cf6", glow2: "#c4a6ff" },
  culture: { name: "ثقافة وتراث", base: "#2a1408", base2: "#432210", glow: "#d98b3a", glow2: "#f0b878" },
  politics: { name: "سياسة وشؤون", base: "#0d1626", base2: "#1c2a44", glow: "#7ea8d9", glow2: "#b3ceec" },
} as const;

export type ReportPalette = keyof typeof REPORT_PALETTES;

export const isReportPalette = (value: unknown): value is ReportPalette =>
  typeof value === "string" && value in REPORT_PALETTES;

/** طابع التقرير من أول شريحة تحمله — قرار واحد للمادة كلها. */
export const paletteOf = (slides: JakSlide[]): ReportPalette =>
  slides.find((slide) => isReportPalette(slide.data?.palette))?.data?.palette ?? "economy";

/** متغيرات CSS الأربعة التي تقرأها صفحات التقرير ولا شيء غيرها. */
export function paletteVars(key: ReportPalette): Record<string, string> {
  const palette = REPORT_PALETTES[key] ?? REPORT_PALETTES.economy;
  return {
    "--jak-base": palette.base,
    "--jak-base2": palette.base2,
    "--jak-glow": palette.glow,
    "--jak-glow2": palette.glow2,
  };
}

export const isLandscapeReport = (slides: JakSlide[]) =>
  slides.some((slide) => slide.data?.canvas === "landscape");

/** إعدادات توليد الصورة مشتقة من سطح العرض حتى لا يطلب التقرير صورة عمودية. */
export const imageGenerationSize = (slide: JakSlide): "cover" | "portrait" =>
  slide.data?.canvas === "landscape" ? "cover" : "portrait";

/**
 * الصورة تملأ الصفحة والنص يعيش فوقها، فتُطلب كمشهد سينمائي غامر
 * بمساحة هادئة في جهة النص — عكس ما كانت تطلبه معالجة اللوح الجانبي.
 */
export function imageGenerationPrompt(slide: JakSlide): string {
  const basePrompt = slide.imagePrompt.trim();
  if (!basePrompt || slide.data?.canvas !== "landscape") return basePrompt;
  const subjectSide = slide.data.focalPoint ?? "left";
  const quietSide = slide.data.textSafeArea ?? (subjectSide === "left" ? "right" : "left");
  // بلا فرض لوحة لونية: التدرج المفروض سابقًا كان يجعل كل الصور مشهدًا جويًا كحليًا
  // ذهبيًا مهما اختلف الموضوع. تبقى القيود البنيوية وحدها.
  return `${basePrompt}. Premium editorial photograph, 16:9 full-bleed composition filling the entire frame, primary subject on the ${subjectSide}, calm uncluttered negative space on the ${quietSide} third where Arabic headlines will be overlaid, no embedded text, no letters, no logos, no close-up faces of identifiable people.`;
}

/** ملاحظات حتمية تمنع ازدحام قوالب 16:9 قبل التصدير. */
export function reportLayoutIssues(slide: JakSlide): string[] {
  if (slide.data?.canvas !== "landscape") return [];
  const template = slide.data.template ?? "image-text";
  const issues: string[] = [];
  const titleCap = template === "cover" ? 70 : 85;
  const bodyCap = template === "cover" ? 170 : 260;
  if (slide.title.length > titleCap) issues.push(`العنوان يتجاوز حد قالب ${titleCap} حرفًا.`);
  if (slide.body.length > bodyCap) issues.push(`النص يتجاوز حد قالب ${bodyCap} حرفًا.`);
  if (["stats", "grid"].includes(template)) {
    const blocks = slide.data.blocks ?? [];
    if (blocks.length < 3) issues.push("القالب يحتاج 3 وحدات محتوى على الأقل.");
    if (blocks.length > 6) issues.push("القالب يقبل 6 وحدات محتوى كحد أقصى.");
    if (blocks.some((block) => block.body.length > 130)) {
      issues.push("نص إحدى الوحدات يتجاوز 130 حرفًا.");
    }
  }
  return issues;
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
      slide.data?.blocks
        ?.map((block) => `${block.value} ${block.label} ${block.title} ${block.body}`)
        .join(". "),
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
  actor: WriteActor,
  source?: string,
  expectedVersion?: number,
) {
  const { auditQuery, lockStory } = await import("./workflow");
  const db = requireDb();
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story) throw new StoryWriteError("المادة غير موجودة.", 404);
  assertCanWrite(actor, story);
  assertExpectedVersion(story.version, expectedVersion);
  if (!["draft", "review"].includes(story.status)) throw new StoryWriteError("احفظ مسودة مراجعة قبل تعديل الشرائح.");
  const now = new Date().toISOString();
  const sourceToSave = source?.trim();
  const previousSlides = await listSlides(storyId);
  const previousSource = sourceToSave ? await getJakSource(storyId) : undefined;
  const timeline = () => auditQuery(actor.username, "jak:slides-save", storyId, "حفظ ترتيب الشرائح ومحتواها", { before: { ...story, slides: previousSlides, source: previousSource }, after: { body: projectSlides(slides), status: "draft", slides, ...(sourceToSave ? { source: sourceToSave } : {}) } });
  const deleteSlides = () => db.delete(storySlides).where(eq(storySlides.storyId, storyId));
  const updateStory = () => db
    .update(stories)
    .set({ body: projectSlides(slides), updatedAt: now, status: "draft", version: story.version + 1 })
    .where(eq(stories.id, storyId));
  const insertSlides = () => db.insert(storySlides).values(
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
  const upsertSource = () => db
    .insert(jakSources)
    .values({ storyId, source: sourceToSave!, updatedAt: now })
    .onConflictDoUpdate({
      target: jakSources.storyId,
      set: { source: sourceToSave!, updatedAt: now },
    });

  // neon-http لا يدعم المعاملات التفاعلية، وbatch ينفذ الاستعلامات
  // كمعاملة HTTP واحدة غير تفاعلية مع الحفاظ على ذرية الاستبدال.
  if (slides.length > 0 && sourceToSave) {
    await db.batch([lockStory(story), timeline(), deleteSlides(), insertSlides(), updateStory(), upsertSource()]);
  } else if (slides.length > 0) {
    await db.batch([lockStory(story), timeline(), deleteSlides(), insertSlides(), updateStory()]);
  } else if (sourceToSave) {
    await db.batch([lockStory(story), timeline(), deleteSlides(), updateStory(), upsertSource()]);
  } else {
    await db.batch([lockStory(story), timeline(), deleteSlides(), updateStory()]);
  }
  if (story.status !== "draft") invalidateStatusCounts();

  return { version: story.version + 1 };
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
