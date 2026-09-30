-- تقارير جاك HTML/CSS مستقلة عن stories وstory_slides.
CREATE TABLE IF NOT EXISTS "jak_code_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"image" text,
	"html" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"show_on_homepage" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"published_at" text,
	"source_url" text,
	"source_post_id" integer,
	"source_published_at" text,
	"source_modified_at" text,
	CONSTRAINT "jak_code_reports_homepage_bool" CHECK ("jak_code_reports"."show_on_homepage" in (0, 1)),
	CONSTRAINT "jak_code_reports_status_valid" CHECK ("jak_code_reports"."status" in ('draft', 'review', 'published', 'archived')),
	CONSTRAINT "jak_code_reports_version_positive" CHECK ("jak_code_reports"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jak_code_reports_status_time_idx" ON "jak_code_reports" USING btree ("status", coalesce("source_published_at", "published_at", "created_at") DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jak_code_reports_homepage_time_idx" ON "jak_code_reports" USING btree ("show_on_homepage", coalesce("source_published_at", "published_at", "created_at") DESC, "id" DESC) WHERE "jak_code_reports"."status" = 'published';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jak_code_reports_source_post_uidx" ON "jak_code_reports" USING btree ("source_post_id");
