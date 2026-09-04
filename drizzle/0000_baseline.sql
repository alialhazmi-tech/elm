CREATE TABLE IF NOT EXISTS "ai_settings" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"at" text NOT NULL,
	"tool" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"actor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"story_id" text,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text NOT NULL,
	"content_keys" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jak_sources" (
	"story_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"rights_cleared" integer DEFAULT 0 NOT NULL,
	"flags" text DEFAULT '' NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" text NOT NULL,
	"ai_generated" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_events" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"story_id" text NOT NULL,
	"type" text NOT NULL,
	"value" integer,
	"duration_ms" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_interests" (
	"member_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "member_interests_member_id_interest_id_pk" PRIMARY KEY("member_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_likes" (
	"member_id" text NOT NULL,
	"story_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "member_likes_member_id_story_id_pk" PRIMARY KEY("member_id","story_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_profiles" (
	"auth_user_id" text PRIMARY KEY NOT NULL,
	"onboarding_completed" integer DEFAULT 0 NOT NULL,
	"personalization_enabled" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_story_stats" (
	"member_id" text NOT NULL,
	"story_id" text NOT NULL,
	"active_ms" integer DEFAULT 0 NOT NULL,
	"max_progress" integer DEFAULT 0 NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"last_visit_at" text NOT NULL,
	"liked" integer DEFAULT 0 NOT NULL,
	"used_ai" integer DEFAULT 0 NOT NULL,
	"ai_tools" jsonb NOT NULL,
	"closing_answer" integer,
	"interest_score" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "member_story_stats_member_id_story_id_pk" PRIMARY KEY("member_id","story_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_topic_scores" (
	"member_id" text NOT NULL,
	"topic_key" text NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"weight" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "member_topic_scores_member_id_topic_key_pk" PRIMARY KEY("member_id","topic_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'footer' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" text NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "series" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"color" text NOT NULL,
	"hidden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "series_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value_case" text NOT NULL,
	"gap_case" text NOT NULL,
	"impact_case" text NOT NULL,
	"proposed_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"eyebrow" text DEFAULT '' NOT NULL,
	"reading_minutes" integer DEFAULT 3 NOT NULL,
	"series_slug" text,
	"image" text,
	"published_at" text,
	"fact_check" jsonb,
	"status" text DEFAULT 'published' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"updated_at" text,
	"scheduled_at" text,
	"format" text DEFAULT 'news' NOT NULL,
	"pinned" integer DEFAULT 0 NOT NULL,
	"breaking_until" text,
	"seo_title" text,
	"seo_description" text,
	"keywords" jsonb,
	"video_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_slides" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"stat" text DEFAULT '' NOT NULL,
	"stat_label" text DEFAULT '' NOT NULL,
	"image" text,
	"image_style" text,
	"image_prompt" text DEFAULT '' NOT NULL,
	"source_context" text DEFAULT '' NOT NULL,
	"hidden" integer DEFAULT 0 NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "story_topics" (
	"story_id" text NOT NULL,
	"topic_key" text NOT NULL,
	"kind" text NOT NULL,
	"weight" integer DEFAULT 1000 NOT NULL,
	"source" text DEFAULT 'heuristic' NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "story_topics_story_id_topic_key_pk" PRIMARY KEY("story_id","topic_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_permissions" (
	"user_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"effect" text DEFAULT 'allow' NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_key_pk" PRIMARY KEY("user_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"suspended_at" text,
	"suspended_by" text,
	"suspend_reason" text DEFAULT '' NOT NULL,
	"last_login_at" text,
	"must_change_password" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_events_member_created_idx" ON "member_events" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_events_member_story_type_idx" ON "member_events" USING btree ("member_id","story_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_events_story_type_idx" ON "member_events" USING btree ("story_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_interests_member_idx" ON "member_interests" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_interests_interest_idx" ON "member_interests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_likes_story_idx" ON "member_likes" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_story_stats_member_idx" ON "member_story_stats" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_story_stats_story_idx" ON "member_story_stats" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_story_stats_member_score_idx" ON "member_story_stats" USING btree ("member_id","interest_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_topic_scores_member_idx" ON "member_topic_scores" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_created_idx" ON "newsletter_subscribers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_status_idx" ON "stories" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_published_at_idx" ON "stories" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_section_idx" ON "stories" USING btree ("section");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_slides_story_idx" ON "story_slides" USING btree ("story_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_topics_topic_idx" ON "story_topics" USING btree ("topic_key");