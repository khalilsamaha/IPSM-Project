-- Additive teacher operations policy, attendance provenance, and monthly payroll identity.
DO $$ BEGIN
  CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'AUTOMATIC', 'IMPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "operational_settings" (
  "id" TEXT PRIMARY KEY,
  "attendance_auto_finalize_enabled" BOOLEAN NOT NULL DEFAULT true,
  "attendance_finalize_grace_minutes" INTEGER NOT NULL DEFAULT 15,
  "allow_payable_missed_lessons" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id" UUID,
  CONSTRAINT "operational_settings_grace_check" CHECK ("attendance_finalize_grace_minutes" BETWEEN 0 AND 240)
);
INSERT INTO "operational_settings" ("id") VALUES ('school-default') ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "operational_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "schedule_sessions" ADD COLUMN IF NOT EXISTS "attendance_finalized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attendance_finalized_by" UUID,
  ADD COLUMN IF NOT EXISTS "attendance_source" "AttendanceSource",
  ADD COLUMN IF NOT EXISTS "attendance_reason" TEXT;
ALTER TABLE "teacher_payrolls" ADD COLUMN IF NOT EXISTS "payroll_month" DATE;
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_payrolls_teacher_id_payroll_month_key" ON "teacher_payrolls"("teacher_id", "payroll_month");
