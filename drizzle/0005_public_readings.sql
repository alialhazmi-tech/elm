CREATE TABLE "story_reading_sessions" (
	"visitor_id" text NOT NULL,
	"story_id" text NOT NULL,
	"session_id" text NOT NULL,
	"member_id" text,
	"active_ms" integer DEFAULT 0 NOT NULL,
	"max_progress" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "story_reading_sessions_visitor_id_story_id_session_id_pk" PRIMARY KEY("visitor_id","story_id","session_id"),
	CONSTRAINT "story_reading_active_bounds" CHECK ("story_reading_sessions"."active_ms" between 0 and 7200000),
	CONSTRAINT "story_reading_progress_bounds" CHECK ("story_reading_sessions"."max_progress" between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX "story_reading_sessions_story_idx" ON "story_reading_sessions" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_reading_sessions_member_idx" ON "story_reading_sessions" USING btree ("member_id");