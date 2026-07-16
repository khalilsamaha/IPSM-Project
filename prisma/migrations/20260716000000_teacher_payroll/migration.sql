CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

CREATE TABLE "teacher_payrolls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "hourly_rate_snapshot_cents" INTEGER NOT NULL,
  "completed_minutes" INTEGER NOT NULL DEFAULT 0,
  "missed_payable_minutes" INTEGER NOT NULL DEFAULT 0,
  "adjustment_cents" INTEGER NOT NULL DEFAULT 0,
  "gross_amount_cents" INTEGER NOT NULL DEFAULT 0,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "approved_by_id" UUID,
  "approved_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_payrolls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_payroll_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payroll_id" UUID NOT NULL,
  "schedule_session_id" UUID,
  "session_date" DATE NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "rate_snapshot_cents" INTEGER NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "item_type" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "teacher_payroll_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teacher_payrolls_teacher_id_period_start_period_end_idx" ON "teacher_payrolls"("teacher_id", "period_start", "period_end");
CREATE INDEX "teacher_payrolls_status_idx" ON "teacher_payrolls"("status");
CREATE UNIQUE INDEX "teacher_payroll_items_schedule_session_id_key" ON "teacher_payroll_items"("schedule_session_id");
CREATE INDEX "teacher_payroll_items_payroll_id_idx" ON "teacher_payroll_items"("payroll_id");
CREATE INDEX "teacher_payroll_items_session_date_idx" ON "teacher_payroll_items"("session_date");

ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "teacher_payrolls_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "teacher_payrolls_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "teacher_payroll_items_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "teacher_payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "teacher_payroll_items_schedule_session_id_fkey" FOREIGN KEY ("schedule_session_id") REFERENCES "schedule_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
