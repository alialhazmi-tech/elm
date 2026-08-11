/**
 * مخطط محتوى العلم — نواة M4-T1: السلاسل والمواد ككيانات أصلية.
 * يُدفع إلى Neon عبر `npm run db:push`، ويُزرع من البذرة عبر `npm run db:seed`.
 */

import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const series = pgTable("series", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull(),
  /** سلسلة مخفية من فهارس الاستكشاف (المتقاعدة) — صفحتها تبقى حية. */
  hidden: integer("hidden").notNull().default(0),
});

export const stories = pgTable("stories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  eyebrow: text("eyebrow").notNull().default(""),
  readingMinutes: integer("reading_minutes").notNull().default(3),
  seriesSlug: text("series_slug"),
  image: text("image"),
  /** ISO 8601 كما في مصدر ووردبريس — يُحوَّل لكائن تاريخ عند العرض فقط. */
  publishedAt: text("published_at"),
  /** بلوك الشائعة/الحقيقة لقالب «افهمها صح»: { rumor, truth }. */
  factCheck: jsonb("fact_check"),
  /** سير عمل «تحرير العلم»: draft → review → scheduled → published. البذرة القديمة كلها published. */
  status: text("status").notNull().default("published"),
  body: text("body").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  updatedAt: text("updated_at"),
  /** موعد النشر المجدول (ISO) — تُرقّى المادة آليًا بعد مرورها على الحارس لحظة الموعد. */
  scheduledAt: text("scheduled_at"),
  /** شكل المادة: news | infographic | video | report | podcast — منفصل عن القسم الموضوعي. */
  format: text("format").notNull().default("news"),
  /** مثبتة في صدارة الرئيسية (قرار معتمد). */
  pinned: integer("pinned").notNull().default(0),
  /** عاجل حتى (ISO) — يظهر شريط العاجل ما دام المستقبل، ويختفي وحده. */
  breakingUntil: text("breaking_until"),
  /** عنوان SEO (يسقط للعنوان عند غيابه) — يتولد بالذكاء ويحرره البشر. */
  seoTitle: text("seo_title"),
  /** وصف SEO (يسقط للموجز عند غيابه). */
  seoDescription: text("seo_description"),
  /** كلمات مفتاحية: مصفوفة نصوص jsonb — تتولد بالذكاء وتُحرر يدويًا. */
  keywords: jsonb("keywords"),
}, (table) => [
  index("stories_status_idx").on(table.status),
  index("stories_published_at_idx").on(table.publishedAt),
  index("stories_section_idx").on(table.section),
]);

/** مكتبة وسائط «تحرير العلم» — الحقوق تُفحص قبل الاستخدام (الدستور §12). */
export const media = pgTable("media", {
  id: text("id").primaryKey(),
  /** المسار العام للملف (محليًا /uploads/…؛ لاحقًا R2). */
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  rightsCleared: integer("rights_cleared").notNull().default(0),
  /** أعلام §12 مفصولة بفواصل: social-watermark, competitor-logo, gore… */
  flags: text("flags").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
  /** مولّدة بالذكاء — توسم بشفافية، وحقوقها داخلية فتُوثق تلقائيًا. */
  aiGenerated: integer("ai_generated").notNull().default(0),
});

/** إعدادات نظام الذكاء — صف واحد jsonb يديره رئيس التحرير من اللوحة. */
export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** سجل استهلاك الذكاء — أساس فرض السقوف اليومية والشهرية. */
export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  tool: text("tool").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  /** بالسنت تجنبًا لكسور الفاصلة العائمة. */
  costCents: integer("cost_cents").notNull().default(0),
  actor: text("actor").notNull(),
});

/** مقترحات سلاسل جديدة — بشروط الدستور، والاعتماد لرئيس التحرير. */
export const seriesProposals = pgTable("series_proposals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  valueCase: text("value_case").notNull(),
  gapCase: text("gap_case").notNull(),
  impactCase: text("impact_case").notNull(),
  proposedBy: text("proposed_by").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

/** مستخدمو لوحة «تحرير العلم» — الأدوار: editor | approver | chief. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("editor"),
  /** PBKDF2-SHA256: صيغة salt:iterations:hash بترميز hex. */
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

/** سجل تدقيق غير قابل للتعديل: كل فعل تحريري يُدوَّن. */
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  storyId: text("story_id"),
  detail: text("detail").notNull().default(""),
});
