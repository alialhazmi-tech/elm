/**
 * زرع محتوى البذرة في Neon — upsert آمن للتكرار.
 *   node --env-file=.env.local scripts/db-seed.mjs
 */

import { neon } from "@neondatabase/serverless";

import { ALL_SERIES } from "../lib/content/series.ts";
import { seedStories, seedVideos } from "../lib/content/seed.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL غير مضبوط — أضفه في .env.local");
  process.exit(1);
}

const sql = neon(url);

for (const s of ALL_SERIES) {
  await sql`
    insert into series (slug, name, description, color, hidden)
    values (${s.slug}, ${s.name}, ${s.description}, ${s.color}, 0)
    on conflict (slug) do update
      set name = excluded.name, description = excluded.description, color = excluded.color`;
}

const all = [...seedStories, ...seedVideos];
for (const s of all) {
  await sql`
    insert into stories (id, slug, section, title, excerpt, eyebrow,
                         reading_minutes, series_slug, image, published_at, fact_check)
    values (${s.id}, ${s.slug}, ${s.section}, ${s.title}, ${s.excerpt}, ${s.eyebrow},
            ${s.readingMinutes}, ${s.series ?? null}, ${s.image ?? null},
            ${s.publishedAt ?? null}, ${s.factCheck ? JSON.stringify(s.factCheck) : null})
    on conflict (id) do update
      set slug = excluded.slug, section = excluded.section, title = excluded.title,
          excerpt = excluded.excerpt, eyebrow = excluded.eyebrow,
          reading_minutes = excluded.reading_minutes, series_slug = excluded.series_slug,
          image = excluded.image, published_at = excluded.published_at,
          fact_check = excluded.fact_check`;
}

const [seriesCount] = await sql`select count(*)::int as n from series`;
const [storyCount] = await sql`select count(*)::int as n from stories`;
console.log(`تم الزرع — السلاسل: ${seriesCount.n} · المواد: ${storyCount.n}`);
