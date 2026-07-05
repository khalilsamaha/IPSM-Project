ALTER TABLE "payments" ALTER COLUMN "family_id" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "student_id" UUID;
CREATE INDEX "payments_student_id_idx" ON "payments"("student_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_exactly_one_payer_chk" CHECK (((family_id IS NOT NULL)::int + (student_id IS NOT NULL)::int) = 1);
