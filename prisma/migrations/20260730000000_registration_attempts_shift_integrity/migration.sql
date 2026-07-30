ALTER TYPE "ShiftStatus" ADD VALUE IF NOT EXISTS 'AUTO_CLOSED';

CREATE TYPE "RegistrationAttemptStatus" AS ENUM ('IDENTITY_SAVED', 'COMPLETED', 'CANCELLED');
CREATE TABLE "registration_attempts" (
  "id" UUID PRIMARY KEY,
  "status" "RegistrationAttemptStatus" NOT NULL DEFAULT 'IDENTITY_SAVED',
  "family_id" UUID NOT NULL REFERENCES "families"("id") ON DELETE RESTRICT,
  "primary_student_id" UUID NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "enrollment_id" UUID REFERENCES "enrollments"("id") ON DELETE SET NULL,
  "payment_id" UUID REFERENCES "payments"("id") ON DELETE SET NULL,
  "last_failure_reason" TEXT,
  "created_by_id" UUID REFERENCES "user_profiles"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "registration_attempts_family_id_idx" ON "registration_attempts"("family_id");
CREATE INDEX "registration_attempts_primary_student_id_idx" ON "registration_attempts"("primary_student_id");
CREATE INDEX "registration_attempts_status_idx" ON "registration_attempts"("status");
