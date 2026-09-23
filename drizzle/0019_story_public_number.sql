-- رابط عام قصير لمواد اللوحة: /{القسم}/{رقم}/{السلاج} بدل UUID من 36 حرفًا.
-- يبدأ بعد أكبر معرّف ووردبريس (264651) بهامش، فلا يتصادم رقم مع معرّف مادة منقولة.
CREATE SEQUENCE IF NOT EXISTS "story_public_number_seq" START WITH 300001;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "public_number" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stories_public_number_uidx" ON "stories" USING btree ("public_number");
--> statement-breakpoint
-- المواد الأصلية فقط (لا مسودات التعديل)، بترتيب النشر؛ الروابط القديمة تبقى وتتحول 308 بالمعرّف.
-- الترقيم بـrow_number لأن ترتيب استدعاء nextval داخل استعلام غير مضمون.
WITH numbered AS (
  SELECT "id", 300000 + row_number() OVER (ORDER BY coalesce("published_at", "updated_at") ASC NULLS LAST, "id" ASC) AS n
  FROM "stories"
  WHERE "revision_of" IS NULL AND "id" !~ '^[0-9]+$' AND "id" !~ '^jak-'
    AND NOT EXISTS (SELECT 1 FROM "stories" x WHERE x."public_number" IS NOT NULL)
)
UPDATE "stories" s SET "public_number" = numbered.n FROM numbered WHERE s."id" = numbered."id";
--> statement-breakpoint
SELECT setval('story_public_number_seq', greatest(300000, (SELECT coalesce(max("public_number"), 300000) FROM "stories")));
