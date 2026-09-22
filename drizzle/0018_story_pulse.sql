-- نبض الظهور: يرفع المادة المنشورة في الرئيسية والقسم والسلسلة دون تغيير published_at.
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "boosted_at" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_public_recency_idx" ON "stories" USING btree ((coalesce("boosted_at", "published_at")) DESC NULLS FIRST, "id" ASC) WHERE "stories"."status" = 'published';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_section_boost_idx" ON "stories" USING btree ("section", (coalesce("boosted_at", "published_at")) DESC NULLS FIRST) WHERE "stories"."status" = 'published';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_series_boost_idx" ON "stories" USING btree ("series_slug", (coalesce("boosted_at", "published_at")) DESC NULLS FIRST) WHERE "stories"."status" = 'published';
