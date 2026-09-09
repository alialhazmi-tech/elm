CREATE TABLE "editorial_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"kind" text DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"story_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" text NOT NULL,
	"read_at" text
);
--> statement-breakpoint
CREATE TABLE "editorial_presence" (
	"story_id" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"seen_at" text NOT NULL,
	CONSTRAINT "editorial_presence_story_id_user_id_session_id_pk" PRIMARY KEY("story_id","user_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "due_at" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "returned_at" text;--> statement-breakpoint
ALTER TABLE "editorial_notes" ADD CONSTRAINT "editorial_notes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_notifications" ADD CONSTRAINT "editorial_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_notifications" ADD CONSTRAINT "editorial_notifications_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_presence" ADD CONSTRAINT "editorial_presence_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_presence" ADD CONSTRAINT "editorial_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editorial_notes_story_idx" ON "editorial_notes" USING btree ("story_id","created_at");--> statement-breakpoint
CREATE INDEX "editorial_notifications_user_idx" ON "editorial_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "editorial_presence_seen_idx" ON "editorial_presence" USING btree ("seen_at");--> statement-breakpoint
CREATE INDEX "stories_assigned_to_idx" ON "stories" USING btree ("assigned_to","status");--> statement-breakpoint
CREATE INDEX "stories_author_status_idx" ON "stories" USING btree ("author_id","status");