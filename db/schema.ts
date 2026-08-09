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
});
