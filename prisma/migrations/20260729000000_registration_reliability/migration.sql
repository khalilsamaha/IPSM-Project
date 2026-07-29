ALTER TABLE "enrollments"
ADD COLUMN "registration_submission_id" UUID;

CREATE UNIQUE INDEX "enrollments_registration_submission_id_key"
ON "enrollments"("registration_submission_id");
