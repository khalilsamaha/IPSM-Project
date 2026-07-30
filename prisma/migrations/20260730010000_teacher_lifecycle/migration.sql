CREATE TYPE "TeacherCompensationBasis" AS ENUM ('HOURLY', 'SESSION_UNIT');

ALTER TABLE "teachers"
  ADD COLUMN "compensation_basis" "TeacherCompensationBasis" NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN "session_rate_cents" INTEGER,
  ADD COLUMN "session_unit_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD CONSTRAINT "teachers_rates_nonnegative" CHECK ("hourly_rate_cents" >= 0 AND ("session_rate_cents" IS NULL OR "session_rate_cents" >= 0)),
  ADD CONSTRAINT "teachers_session_unit_positive" CHECK ("session_unit_minutes" > 0);

ALTER TABLE "teacher_availability" ADD COLUMN "course_id" UUID;
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "teacher_availability_course_id_idx" ON "teacher_availability"("course_id");

ALTER TABLE "teacher_payrolls"
  ADD COLUMN "compensation_basis_snapshot" "TeacherCompensationBasis",
  ADD COLUMN "rate_unit_minutes_snapshot" INTEGER;
ALTER TABLE "teacher_payroll_items"
  ADD COLUMN "compensation_basis_snapshot" "TeacherCompensationBasis",
  ADD COLUMN "rate_unit_minutes_snapshot" INTEGER;
