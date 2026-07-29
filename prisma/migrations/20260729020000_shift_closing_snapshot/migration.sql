ALTER TABLE "cashier_shifts"
  ADD COLUMN "closing_snapshot" JSONB,
  ADD COLUMN "variance_reason" TEXT;
