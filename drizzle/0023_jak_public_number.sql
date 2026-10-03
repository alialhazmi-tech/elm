-- رقم رابط عام ثابت لتقارير جاك؛ لا يغيّر UUID أو معرّف المصدر أو السلاج.
CREATE SEQUENCE IF NOT EXISTS "jak_code_reports_public_number_seq";
--> statement-breakpoint
ALTER TABLE "jak_code_reports" ADD COLUMN IF NOT EXISTS "public_number" integer;
--> statement-breakpoint
-- ترتيب تاريخي ثابت للصفوف القائمة حتى لا تتغير الروابط عند إعادة تشغيل الهجرة.
WITH numbered AS (
  SELECT "id", (
    COALESCE((SELECT max("public_number") FROM "jak_code_reports"), 0)
    + row_number() OVER (ORDER BY "created_at" ASC, "id" ASC)
  )::integer AS n
  FROM "jak_code_reports"
  WHERE "public_number" IS NULL
)
UPDATE "jak_code_reports" AS reports
SET "public_number" = numbered.n
FROM numbered
WHERE reports."id" = numbered."id" AND reports."public_number" IS NULL;
--> statement-breakpoint
SELECT setval(
  'jak_code_reports_public_number_seq',
  COALESCE((SELECT max("public_number") FROM "jak_code_reports"), 1),
  (SELECT count(*) > 0 FROM "jak_code_reports")
);
--> statement-breakpoint
ALTER TABLE "jak_code_reports"
  ALTER COLUMN "public_number" SET DEFAULT nextval('jak_code_reports_public_number_seq'),
  ALTER COLUMN "public_number" SET NOT NULL;
--> statement-breakpoint
ALTER SEQUENCE "jak_code_reports_public_number_seq" OWNED BY "jak_code_reports"."public_number";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "jak_code_reports_public_number_uidx"
  ON "jak_code_reports" USING btree ("public_number");
--> statement-breakpoint
ALTER TABLE "jak_code_reports"
  ADD CONSTRAINT "jak_code_reports_public_number_positive" CHECK ("public_number" > 0);
