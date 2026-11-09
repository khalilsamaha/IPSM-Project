-- Disposable test baseline supplements: SQL-only constraints absent from Prisma.
-- reset-baseline.sql is generated from the verified a6abe1e Prisma schema.
DROP INDEX public.registration_attempts_enrollment_id_key;
DROP INDEX public.registration_attempts_payment_id_key;
CREATE UNIQUE INDEX seasons_name_lower_unique ON public.seasons(lower(name));
CREATE UNIQUE INDEX enrollments_student_season_course_level_unique ON public.enrollments(student_id,season_id,coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(level_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(course_name));
CREATE UNIQUE INDEX cashier_shifts_one_open_per_user_idx ON public.cashier_shifts(user_id) WHERE status IN ('OPEN','REOPENED');
CREATE UNIQUE INDEX cashier_shifts_one_open_per_user_date_idx ON public.cashier_shifts(user_id,business_date) WHERE status IN ('OPEN','REOPENED');
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_dates_order_check CHECK(enrollment_end_date>=enrollment_start_date);
ALTER TABLE public.seasons ADD CONSTRAINT seasons_planned_session_count_positive CHECK(planned_session_count>0);
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_price_base_session_count_positive CHECK(price_base_session_count IS NULL OR price_base_session_count>0), ADD CONSTRAINT enrollments_planned_session_count_nonnegative CHECK(planned_session_count IS NULL OR planned_session_count>=0), ADD CONSTRAINT enrollments_pricing_cents_nonnegative CHECK((configured_price_cents IS NULL OR configured_price_cents>=0) AND (calculated_fee_cents IS NULL OR calculated_fee_cents>=0));
ALTER TABLE public.teacher_availability ADD CONSTRAINT teacher_availability_day_of_week_check CHECK(day_of_week BETWEEN 0 AND 6), ADD CONSTRAINT teacher_availability_time_order CHECK(end_time>start_time);
ALTER TABLE public.schedule_patterns ADD CONSTRAINT schedule_patterns_day_of_week_check CHECK(day_of_week BETWEEN 0 AND 6), ADD CONSTRAINT schedule_pattern_dates CHECK(ends_on>=starts_on), ADD CONSTRAINT schedule_pattern_times CHECK(end_time>start_time);
ALTER TABLE public.school_closures ADD CONSTRAINT school_closure_dates CHECK(end_date>=start_date);
ALTER TABLE public.operational_settings ADD CONSTRAINT operational_settings_grace_check CHECK(attendance_finalize_grace_minutes BETWEEN 0 AND 240);
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
