SET LOCAL lock_timeout = '5s';--> statement-breakpoint
SET LOCAL statement_timeout = '60s';--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "search_text" text GENERATED ALWAYS AS (translate(lower("title" || ' ' || "excerpt" || ' ' || "eyebrow" || ' ' || coalesce("keywords"::text, '')), 'أإآٱىةؤئًٌٍَُِّْٰـ', 'اايهوي')) STORED;--> statement-breakpoint
CREATE INDEX "stories_search_text_trgm_idx" ON "stories" USING gin ("search_text" gin_trgm_ops) WHERE "stories"."status" = 'published';
