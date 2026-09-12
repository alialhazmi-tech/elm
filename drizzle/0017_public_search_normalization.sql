-- إصلاح تطبيع البحث العام مع إبقاء اسم العمود والفهرس وحقول البحث كما هي.
-- PostgreSQL 17+ يعيد حساب الصفوف الموجودة ويحافظ على تحديث العمود والفهرس مع كل حفظ.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '60s';
--> statement-breakpoint
DO $$
BEGIN
  -- تجنب إعادة كتابة الجدول عند إعادة تشغيل الترحيل بعد نجاحه.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
    WHERE d.adrelid='public.stories'::regclass AND a.attname='search_text'
      AND pg_get_expr(d.adbin,d.adrelid) LIKE '%alelm_editor_search_normalize%'
  ) THEN
    ALTER TABLE public.stories ALTER COLUMN search_text SET EXPRESSION AS (
      public.alelm_editor_search_normalize(title || ' ' || excerpt || ' ' || eyebrow || ' ' || coalesce(keywords::text, ''))
    );
  END IF;
END $$;
--> statement-breakpoint
ANALYZE public.stories (search_text);
