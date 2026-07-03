-- Add explicit enrollment dates while preserving existing enrollment rows by
-- backfilling from the selected season date range.
ALTER TABLE "enrollments" ADD COLUMN "enrollment_start_date" date;
ALTER TABLE "enrollments" ADD COLUMN "enrollment_end_date" date;

UPDATE "enrollments" e
SET "enrollment_start_date" = s."start_date",
    "enrollment_end_date" = s."end_date"
FROM "seasons" s
WHERE e."season_id" = s."id"
  AND (e."enrollment_start_date" IS NULL OR e."enrollment_end_date" IS NULL);

ALTER TABLE "enrollments" ALTER COLUMN "enrollment_start_date" SET NOT NULL;
ALTER TABLE "enrollments" ALTER COLUMN "enrollment_end_date" SET NOT NULL;

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_dates_order_check" CHECK ("enrollment_end_date" >= "enrollment_start_date");

-- Replace legacy one-course-per-season uniqueness with a duplicate guard for
-- the same student + season + course + level. The COALESCE fallback keeps legacy
-- courseName-only enrollments protected without removing the course_name field.
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_student_id_season_id_course_name_key";
CREATE UNIQUE INDEX "enrollments_student_season_course_level_unique"
  ON "enrollments" (
    "student_id",
    "season_id",
    COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("level_id", '00000000-0000-0000-0000-000000000000'::uuid),
    lower("course_name")
  );
