ALTER TABLE "member_profiles" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD COLUMN "suspend_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;