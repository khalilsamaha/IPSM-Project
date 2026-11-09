-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'RECEPTION');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'AUTOMATIC', 'IMPORT');

-- CreateEnum
CREATE TYPE "AcademicConfigStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeacherAvailabilityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeacherCompensationBasis" AS ENUM ('HOURLY', 'SESSION_UNIT');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'AUTO_CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "RegistrationAttemptStatus" AS ENUM ('IDENTITY_SAVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchedulePatternStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECEPTION',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "created_by_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" UUID NOT NULL,
    "family_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "father_first_name" TEXT,
    "father_last_name" TEXT,
    "father_job" TEXT,
    "father_phone" TEXT,
    "father_email" TEXT,
    "mother_first_name" TEXT,
    "mother_last_name" TEXT,
    "mother_job" TEXT,
    "mother_phone" TEXT,
    "mother_email" TEXT,
    "address" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "status" "FamilyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "student_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "date_of_birth" DATE,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'PLANNED',
    "planned_session_count" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "hourly_rate_cents" INTEGER NOT NULL DEFAULT 0,
    "compensation_basis" "TeacherCompensationBasis" NOT NULL DEFAULT 'HOURLY',
    "session_rate_cents" INTEGER,
    "session_unit_minutes" INTEGER NOT NULL DEFAULT 30,
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_levels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "course_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_courses" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "level_id" UUID,
    "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "teacher_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_pricings" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "season_id" UUID,
    "price_cents" INTEGER NOT NULL,
    "status" "AcademicConfigStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "teacher_id" UUID,
    "course_name" TEXT NOT NULL,
    "course_id" UUID,
    "level_id" UUID,
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "final_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "remaining_cents" INTEGER NOT NULL DEFAULT 0,
    "configured_price_cents" INTEGER,
    "price_base_session_count" INTEGER,
    "planned_session_count" INTEGER,
    "calculated_fee_cents" INTEGER,
    "pricing_source_id" UUID,
    "pricing_calculated_at" TIMESTAMP(3),
    "pricing_override_reason" TEXT,
    "enrollment_start_date" DATE NOT NULL,
    "enrollment_end_date" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "registration_submission_id" UUID,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_attempts" (
    "id" UUID NOT NULL,
    "status" "RegistrationAttemptStatus" NOT NULL DEFAULT 'IDENTITY_SAVED',
    "family_id" UUID NOT NULL,
    "primary_student_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "payment_id" UUID,
    "last_failure_reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_sessions" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "season_id" UUID,
    "room_id" UUID,
    "title" TEXT,
    "session_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "status" "ScheduleSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "attendance_finalized_at" TIMESTAMP(3),
    "attendance_finalized_by" UUID,
    "attendance_source" "AttendanceSource",
    "attendance_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "schedule_pattern_id" UUID,

    CONSTRAINT "schedule_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "description" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_patterns" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "room_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "SchedulePatternStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "schedule_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_closures" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "school_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_availability" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "course_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "season_id" UUID,
    "effective_from" DATE,
    "effective_to" DATE,
    "status" "TeacherAvailabilityStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "teacher_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_payrolls" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payroll_month" DATE,
    "hourly_rate_snapshot_cents" INTEGER NOT NULL,
    "compensation_basis_snapshot" "TeacherCompensationBasis",
    "rate_unit_minutes_snapshot" INTEGER,
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

-- CreateTable
CREATE TABLE "operational_settings" (
    "id" TEXT NOT NULL,
    "attendance_auto_finalize_enabled" BOOLEAN NOT NULL DEFAULT true,
    "attendance_finalize_grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "allow_payable_missed_lessons" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "operational_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_payroll_items" (
    "id" UUID NOT NULL,
    "payroll_id" UUID NOT NULL,
    "schedule_session_id" UUID,
    "session_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "rate_snapshot_cents" INTEGER NOT NULL,
    "compensation_basis_snapshot" "TeacherCompensationBasis",
    "rate_unit_minutes_snapshot" INTEGER,
    "amount_cents" INTEGER NOT NULL,
    "item_type" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "teacher_payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL,
    "total_amount_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID,
    "receipt_number" TEXT,
    "shift_id" UUID,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_items" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "pdf_path" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_by_email_at" TIMESTAMP(3),
    "shared_by_whatsapp_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "created_by_id" UUID,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "incurred_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expense_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "shift_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "closing_snapshot" JSONB,
    "variance_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_key" ON "users"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_created_by_id_idx" ON "audit_logs"("created_by_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "families_family_code_key" ON "families"("family_code");

-- CreateIndex
CREATE INDEX "families_status_idx" ON "families"("status");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");

-- CreateIndex
CREATE INDEX "students_family_id_idx" ON "students"("family_id");

-- CreateIndex
CREATE INDEX "students_student_code_idx" ON "students"("student_code");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX "seasons_status_start_date_end_date_idx" ON "seasons"("status", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE INDEX "teachers_status_idx" ON "teachers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "course_levels_name_key" ON "course_levels"("name");

-- CreateIndex
CREATE INDEX "course_levels_status_order_idx" ON "course_levels"("status", "order");

-- CreateIndex
CREATE INDEX "teacher_courses_teacher_id_idx" ON "teacher_courses"("teacher_id");

-- CreateIndex
CREATE INDEX "teacher_courses_course_id_idx" ON "teacher_courses"("course_id");

-- CreateIndex
CREATE INDEX "teacher_courses_level_id_idx" ON "teacher_courses"("level_id");

-- CreateIndex
CREATE INDEX "teacher_courses_status_idx" ON "teacher_courses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_courses_teacher_id_course_id_level_id_key" ON "teacher_courses"("teacher_id", "course_id", "level_id");

-- CreateIndex
CREATE INDEX "course_pricings_course_id_idx" ON "course_pricings"("course_id");

-- CreateIndex
CREATE INDEX "course_pricings_level_id_idx" ON "course_pricings"("level_id");

-- CreateIndex
CREATE INDEX "course_pricings_season_id_idx" ON "course_pricings"("season_id");

-- CreateIndex
CREATE INDEX "course_pricings_status_idx" ON "course_pricings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "course_pricings_course_id_level_id_season_id_key" ON "course_pricings"("course_id", "level_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_registration_submission_id_key" ON "enrollments"("registration_submission_id");

-- CreateIndex
CREATE INDEX "enrollments_student_id_season_id_course_id_level_id_idx" ON "enrollments"("student_id", "season_id", "course_id", "level_id");

-- CreateIndex
CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");

-- CreateIndex
CREATE INDEX "enrollments_season_id_idx" ON "enrollments"("season_id");

-- CreateIndex
CREATE INDEX "enrollments_teacher_id_idx" ON "enrollments"("teacher_id");

-- CreateIndex
CREATE INDEX "enrollments_course_id_idx" ON "enrollments"("course_id");

-- CreateIndex
CREATE INDEX "enrollments_level_id_idx" ON "enrollments"("level_id");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "registration_attempts_enrollment_id_key" ON "registration_attempts"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_attempts_payment_id_key" ON "registration_attempts"("payment_id");

-- CreateIndex
CREATE INDEX "registration_attempts_family_id_idx" ON "registration_attempts"("family_id");

-- CreateIndex
CREATE INDEX "registration_attempts_primary_student_id_idx" ON "registration_attempts"("primary_student_id");

-- CreateIndex
CREATE INDEX "registration_attempts_status_idx" ON "registration_attempts"("status");

-- CreateIndex
CREATE INDEX "schedule_sessions_student_id_session_date_idx" ON "schedule_sessions"("student_id", "session_date");

-- CreateIndex
CREATE INDEX "schedule_sessions_teacher_id_session_date_idx" ON "schedule_sessions"("teacher_id", "session_date");

-- CreateIndex
CREATE INDEX "schedule_sessions_session_date_start_time_idx" ON "schedule_sessions"("session_date", "start_time");

-- CreateIndex
CREATE INDEX "schedule_sessions_enrollment_id_idx" ON "schedule_sessions"("enrollment_id");

-- CreateIndex
CREATE INDEX "schedule_sessions_season_id_session_date_idx" ON "schedule_sessions"("season_id", "session_date");

-- CreateIndex
CREATE INDEX "schedule_sessions_season_id_idx" ON "schedule_sessions"("season_id");

-- CreateIndex
CREATE INDEX "schedule_sessions_room_id_session_date_idx" ON "schedule_sessions"("room_id", "session_date");

-- CreateIndex
CREATE INDEX "schedule_sessions_status_session_date_idx" ON "schedule_sessions"("status", "session_date");

-- CreateIndex
CREATE INDEX "schedule_sessions_status_idx" ON "schedule_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_sessions_schedule_pattern_id_session_date_key" ON "schedule_sessions"("schedule_pattern_id", "session_date");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "schedule_patterns_enrollment_id_idx" ON "schedule_patterns"("enrollment_id");

-- CreateIndex
CREATE INDEX "schedule_patterns_teacher_id_day_of_week_idx" ON "schedule_patterns"("teacher_id", "day_of_week");

-- CreateIndex
CREATE INDEX "school_closures_start_date_end_date_idx" ON "school_closures"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "teacher_availability_teacher_id_day_of_week_status_idx" ON "teacher_availability"("teacher_id", "day_of_week", "status");

-- CreateIndex
CREATE INDEX "teacher_availability_season_id_idx" ON "teacher_availability"("season_id");

-- CreateIndex
CREATE INDEX "teacher_availability_course_id_idx" ON "teacher_availability"("course_id");

-- CreateIndex
CREATE INDEX "teacher_payrolls_teacher_id_period_start_period_end_idx" ON "teacher_payrolls"("teacher_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "teacher_payrolls_status_idx" ON "teacher_payrolls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_payrolls_teacher_id_payroll_month_key" ON "teacher_payrolls"("teacher_id", "payroll_month");

-- CreateIndex
CREATE INDEX "teacher_payroll_items_payroll_id_idx" ON "teacher_payroll_items"("payroll_id");

-- CreateIndex
CREATE INDEX "teacher_payroll_items_session_date_idx" ON "teacher_payroll_items"("session_date");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_payroll_items_schedule_session_id_key" ON "teacher_payroll_items"("schedule_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_family_id_idx" ON "payments"("family_id");

-- CreateIndex
CREATE INDEX "payments_created_by_id_idx" ON "payments"("created_by_id");

-- CreateIndex
CREATE INDEX "payments_shift_id_idx" ON "payments"("shift_id");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "payment_items_payment_id_idx" ON "payment_items"("payment_id");

-- CreateIndex
CREATE INDEX "payment_items_enrollment_id_idx" ON "payment_items"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_items_payment_id_enrollment_id_key" ON "payment_items"("payment_id", "enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_id_key" ON "receipts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "receipts_generated_at_idx" ON "receipts"("generated_at");

-- CreateIndex
CREATE INDEX "expenses_created_by_id_idx" ON "expenses"("created_by_id");

-- CreateIndex
CREATE INDEX "expenses_shift_id_idx" ON "expenses"("shift_id");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "cashier_shifts_user_id_status_idx" ON "cashier_shifts"("user_id", "status");

-- CreateIndex
CREATE INDEX "cashier_shifts_business_date_idx" ON "cashier_shifts"("business_date");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_courses" ADD CONSTRAINT "teacher_courses_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_pricings" ADD CONSTRAINT "course_pricings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "course_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_primary_student_id_fkey" FOREIGN KEY ("primary_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_attempts" ADD CONSTRAINT "registration_attempts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_schedule_pattern_id_fkey" FOREIGN KEY ("schedule_pattern_id") REFERENCES "schedule_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_patterns" ADD CONSTRAINT "schedule_patterns_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_patterns" ADD CONSTRAINT "schedule_patterns_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_patterns" ADD CONSTRAINT "schedule_patterns_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "teacher_payrolls_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payrolls" ADD CONSTRAINT "teacher_payrolls_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "teacher_payroll_items_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "teacher_payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_payroll_items" ADD CONSTRAINT "teacher_payroll_items_schedule_session_id_fkey" FOREIGN KEY ("schedule_session_id") REFERENCES "schedule_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

