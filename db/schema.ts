/**
 * مخطط محتوى العلم — نواة M4-T1: السلاسل والمواد ككيانات أصلية.
 * يُدفع إلى Neon عبر `npm run db:push`، ويُزرع من البذرة عبر `npm run db:seed`.
 */

import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const series = pgTable("series", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull(),
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
  /** سير عمل «تحرير العلم»: draft → review → published. البذرة القديمة كلها published. */
  status: text("status").notNull().default("published"),
  body: text("body").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  updatedAt: text("updated_at"),
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
