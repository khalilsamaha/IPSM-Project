CREATE TYPE "AcademicConfigStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "courses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");
CREATE INDEX "courses_status_idx" ON "courses"("status");

CREATE TABLE "course_levels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "course_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "course_levels_name_key" ON "course_levels"("name");
CREATE INDEX "course_levels_status_order_idx" ON "course_levels"("status", "order");

CREATE TABLE "course_pricings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "course_id" UUID NOT NULL,
  "level_id" UUID NOT NULL,
  "season_id" UUID,
  "price_cents" INTEGER NOT NULL,
  "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "course_pricings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "course_pricings_course_id_level_id_season_id_key" ON "course_pricings"("course_id", "level_id", "season_id");
CREATE INDEX "course_pricings_course_id_idx" ON "course_pricings"("course_id");
CREATE INDEX "course_pricings_level_id_idx" ON "course_pricings"("level_id");
CREATE INDEX "course_pricings_season_id_idx" ON "course_pricings"("season_id");
CREATE INDEX "course_pricings_status_idx" ON "course_pricings"("status");
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD COLUMN "course_id" UUID, ADD COLUMN "level_id" UUID;
CREATE INDEX "enrollments_course_id_idx" ON "enrollments"("course_id");
CREATE INDEX "enrollments_level_id_idx" ON "enrollments"("level_id");
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
