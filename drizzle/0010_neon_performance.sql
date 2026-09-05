-- Neon preloads pg_stat_statements; creating the extension exposes its statistics.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "stories_title_trgm_idx" ON "stories" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
-- Keep the visibility map and planner statistics fresh on the editorial table.
-- At ~29k stories these trigger around 1,510 dead tuples / 634 changed rows.
ALTER TABLE "stories" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
