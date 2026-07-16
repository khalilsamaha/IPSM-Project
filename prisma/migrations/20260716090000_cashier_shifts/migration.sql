CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

CREATE TABLE "cashier_shifts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "opening_cash_cents" INTEGER NOT NULL,
  "expected_cash_cents" INTEGER NOT NULL DEFAULT 0,
  "declared_cash_cents" INTEGER,
  "difference_cents" INTEGER,
  "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "closed_by_id" UUID,
  "reopened_by_id" UUID,
  "reopen_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "cashier_shifts_user_id_status_idx" ON "cashier_shifts"("user_id", "status");
CREATE INDEX "cashier_shifts_business_date_idx" ON "cashier_shifts"("business_date");
CREATE UNIQUE INDEX "cashier_shifts_one_open_per_user_idx" ON "cashier_shifts"("user_id") WHERE "status" IN ('OPEN', 'REOPENED');
CREATE UNIQUE INDEX "cashier_shifts_one_open_per_user_date_idx" ON "cashier_shifts"("user_id", "business_date") WHERE "status" IN ('OPEN', 'REOPENED');

ALTER TABLE "payments" ADD COLUMN "shift_id" UUID;
ALTER TABLE "expenses" ADD COLUMN "shift_id" UUID;
CREATE INDEX "payments_shift_id_idx" ON "payments"("shift_id");
CREATE INDEX "expenses_shift_id_idx" ON "expenses"("shift_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
