ALTER TABLE "audit_log" ADD COLUMN "context" jsonb;--> statement-breakpoint
CREATE INDEX "audit_log_story_time_idx" ON "audit_log" USING btree ("story_id","at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_root_story_idx" ON "audit_log" USING btree (("context"->>'rootStoryId'),"at" DESC NULLS LAST,"id" DESC NULLS LAST);