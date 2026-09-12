-- فهرسة بحث المحرر في كل الحالات؛ لا نغيّر النص الأصلي أو فهرس البحث العام.
CREATE OR REPLACE FUNCTION public.alelm_editor_search_normalize(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      translate(lower(regexp_replace(regexp_replace(coalesce(value, ''), '<[^>]*>', ' ', 'g'), '&(?:#[0-9]+|#x[0-9a-f]+|[a-z]+);', ' ', 'gi')),
        'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'اااايهوي01234567890123456789'),
      U&'[\0610-\061A\064B-\065F\0670\06D6-\06ED\0640\200B-\200F\202A-\202E\2066-\2069]', '', 'g'),
    '[[:space:]]+', ' ', 'g'))
$$;
--> statement-breakpoint
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS editor_search_text text GENERATED ALWAYS AS (
  public.alelm_editor_search_normalize(title || ' ' || excerpt || ' ' || coalesce(keywords::text, '') || ' ' || body)
) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stories_editor_search_trgm_idx ON public.stories USING gin (editor_search_text gin_trgm_ops);
