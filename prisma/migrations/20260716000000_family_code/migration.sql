ALTER TABLE "families" ADD COLUMN "family_code" TEXT;

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY EXTRACT(YEAR FROM created_at)::int ORDER BY created_at, id) AS seq, EXTRACT(YEAR FROM created_at)::int AS family_year
  FROM "families"
)
UPDATE "families" f
SET "family_code" = 'FAM-' || numbered.family_year || '-' || lpad(numbered.seq::text, 6, '0')
FROM numbered
WHERE f.id = numbered.id AND f."family_code" IS NULL;

ALTER TABLE "families" ALTER COLUMN "family_code" SET NOT NULL;
CREATE UNIQUE INDEX "families_family_code_key" ON "families"("family_code");
