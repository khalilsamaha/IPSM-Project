-- Additive registration pricing snapshots. Existing financial totals remain authoritative.
ALTER TABLE "seasons"
  ADD COLUMN "planned_session_count" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "seasons"
  ADD CONSTRAINT "seasons_planned_session_count_positive"
  CHECK ("planned_session_count" > 0);

ALTER TABLE "enrollments"
  ADD COLUMN "configured_price_cents" INTEGER,
  ADD COLUMN "price_base_session_count" INTEGER,
  ADD COLUMN "planned_session_count" INTEGER,
  ADD COLUMN "calculated_fee_cents" INTEGER,
  ADD COLUMN "pricing_source_id" UUID,
  ADD COLUMN "pricing_calculated_at" TIMESTAMP(3),
  ADD COLUMN "pricing_override_reason" TEXT;

ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_price_base_session_count_positive"
    CHECK ("price_base_session_count" IS NULL OR "price_base_session_count" > 0),
  ADD CONSTRAINT "enrollments_planned_session_count_nonnegative"
    CHECK ("planned_session_count" IS NULL OR "planned_session_count" >= 0),
  ADD CONSTRAINT "enrollments_pricing_cents_nonnegative"
    CHECK (("configured_price_cents" IS NULL OR "configured_price_cents" >= 0)
      AND ("calculated_fee_cents" IS NULL OR "calculated_fee_cents" >= 0));
