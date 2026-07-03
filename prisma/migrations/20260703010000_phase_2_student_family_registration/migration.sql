ALTER TABLE "families" ADD COLUMN "father_first_name" TEXT,
ADD COLUMN "father_last_name" TEXT,
ADD COLUMN "father_job" TEXT,
ADD COLUMN "father_phone" TEXT,
ADD COLUMN "father_email" TEXT,
ADD COLUMN "mother_first_name" TEXT,
ADD COLUMN "mother_last_name" TEXT,
ADD COLUMN "mother_job" TEXT,
ADD COLUMN "mother_phone" TEXT,
ADD COLUMN "mother_email" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "emergency_contact_name" TEXT,
ADD COLUMN "emergency_contact_phone" TEXT;

ALTER TABLE "students" ADD COLUMN "student_code" TEXT;

WITH ordered AS (
  SELECT id, created_at, row_number() OVER (ORDER BY created_at, id) AS seq
  FROM "students"
  WHERE "student_code" IS NULL
)
UPDATE "students" s
SET "student_code" = 'STU-' || EXTRACT(YEAR FROM ordered.created_at)::int || '-' || lpad(ordered.seq::text, 6, '0')
FROM ordered
WHERE s.id = ordered.id;

ALTER TABLE "students" ALTER COLUMN "student_code" SET NOT NULL;
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");
CREATE INDEX "students_student_code_idx" ON "students"("student_code");
