CREATE TABLE "member_saved_stories" (
	"member_id" text NOT NULL,
	"story_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "member_saved_stories_member_id_story_id_pk" PRIMARY KEY("member_id","story_id")
);
--> statement-breakpoint
CREATE TABLE "request_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "revision_of" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "base_version" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "story_versions_story_idx" ON "story_versions" USING btree ("story_id","version");