CREATE TABLE "visitor_story_interactions" (
  "visitor_id" text NOT NULL,
  "story_id" text NOT NULL,
  "liked" integer NOT NULL DEFAULT 0 CHECK ("liked" in (0, 1)),
  "closing_answer" integer CHECK ("closing_answer" in (0, 1)),
  "liked_at" text,
  "answered_at" text,
  PRIMARY KEY ("visitor_id", "story_id")
);
--> statement-breakpoint
CREATE INDEX "visitor_interactions_story_idx" ON "visitor_story_interactions" ("story_id");
