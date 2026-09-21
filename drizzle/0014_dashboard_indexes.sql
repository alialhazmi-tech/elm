-- ترتيب الفهارس DESC NULLS FIRST يطابق ORDER BY … DESC الافتراضي في PostgreSQL وإلا لا يُستخدم للفرز.
-- فهارس اللوحة: سجل التدقيق بترتيبه، وعائلة مسودات التعديل، والسلاسل المنشورة، واستهلاك الذكاء، والعاجل والمثبت.
-- إضافية ومتكررة التشغيل بأمان؛ الكود يعمل بدونها.
CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log" USING btree ("at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_revision_of_idx" ON "stories" USING btree ("revision_of") WHERE "stories"."revision_of" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_series_published_idx" ON "stories" USING btree ("series_slug","published_at" DESC NULLS FIRST) WHERE "stories"."status" = 'published';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_at_idx" ON "ai_usage" USING btree ("at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_breaking_until_idx" ON "stories" USING btree ("breaking_until") WHERE "stories"."breaking_until" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_pinned_idx" ON "stories" USING btree ("pinned") WHERE "stories"."pinned" = 1;
