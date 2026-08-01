-- Keep the Supabase migration path aligned with the teacher lifecycle schema
-- and enforce teacher availability scope for every database write.

DO $$
BEGIN
  IF to_regtype('public."TeacherCompensationBasis"') IS NULL THEN
    CREATE TYPE public."TeacherCompensationBasis" AS ENUM ('HOURLY', 'SESSION_UNIT');
  END IF;
END
$$;

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS compensation_basis public."TeacherCompensationBasis" NOT NULL DEFAULT 'HOURLY',
  ADD COLUMN IF NOT EXISTS session_rate_cents integer,
  ADD COLUMN IF NOT EXISTS session_unit_minutes integer NOT NULL DEFAULT 30;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.teachers'::regclass
      AND conname = 'teachers_rates_nonnegative'
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_rates_nonnegative
      CHECK (hourly_rate_cents >= 0 AND (session_rate_cents IS NULL OR session_rate_cents >= 0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.teachers'::regclass
      AND conname = 'teachers_session_unit_positive'
  ) THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_session_unit_positive
      CHECK (session_unit_minutes > 0);
  END IF;
END
$$;

ALTER TABLE public.teacher_availability
  ADD COLUMN IF NOT EXISTS course_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.teacher_availability'::regclass
      AND conname = 'teacher_availability_course_id_fkey'
  ) THEN
    ALTER TABLE public.teacher_availability
      ADD CONSTRAINT teacher_availability_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES public.courses(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS teacher_availability_course_id_idx
  ON public.teacher_availability(course_id);

ALTER TABLE public.teacher_payrolls
  ADD COLUMN IF NOT EXISTS compensation_basis_snapshot public."TeacherCompensationBasis",
  ADD COLUMN IF NOT EXISTS rate_unit_minutes_snapshot integer;

ALTER TABLE public.teacher_payroll_items
  ADD COLUMN IF NOT EXISTS compensation_basis_snapshot public."TeacherCompensationBasis",
  ADD COLUMN IF NOT EXISTS rate_unit_minutes_snapshot integer;

-- PostgreSQL ordinary UNIQUE indexes allow multiple NULL level values. This
-- closes the gap for course-wide teacher assignments.
CREATE UNIQUE INDEX IF NOT EXISTS teacher_courses_teacher_course_all_levels_key
  ON public.teacher_courses(teacher_id, course_id)
  WHERE level_id IS NULL;

CREATE OR REPLACE FUNCTION public.validate_teacher_availability_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  season_row record;
BEGIN
  IF NEW.season_id IS NOT NULL THEN
    SELECT start_date, end_date
      INTO season_row
      FROM public.seasons
     WHERE id = NEW.season_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Teacher availability references an unavailable season.';
    END IF;

    IF NEW.effective_from IS NULL OR NEW.effective_to IS NULL THEN
      RAISE EXCEPTION 'Seasonal availability requires both effective dates.';
    END IF;

    IF NEW.effective_from < season_row.start_date
       OR NEW.effective_to > season_row.end_date
       OR NEW.effective_to < NEW.effective_from THEN
      RAISE EXCEPTION 'Teacher availability dates must remain inside the selected season.';
    END IF;
  END IF;

  IF NEW.course_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.teacher_courses tc
     WHERE tc.teacher_id = NEW.teacher_id
       AND tc.course_id = NEW.course_id
       AND tc.status = 'ACTIVE'::public."AcademicConfigStatus"
       AND tc.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The availability course is not actively assigned to this teacher.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS teacher_availability_scope_guard
  ON public.teacher_availability;
CREATE TRIGGER teacher_availability_scope_guard
BEFORE INSERT OR UPDATE OF teacher_id, course_id, season_id, effective_from, effective_to
ON public.teacher_availability
FOR EACH ROW
EXECUTE FUNCTION public.validate_teacher_availability_scope();

CREATE OR REPLACE FUNCTION public.validate_schedule_teacher_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  enrollment_course_id uuid;
  enrollment_season_id uuid;
BEGIN
  -- Legacy/imported sessions without an enrollment retain their existing
  -- application-managed behavior.
  IF NEW.enrollment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT course_id, season_id
    INTO enrollment_course_id, enrollment_season_id
    FROM public.enrollments
   WHERE id = NEW.enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule session references an unavailable enrollment.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.teacher_availability ta
     WHERE ta.teacher_id = NEW.teacher_id
       AND ta.day_of_week = extract(dow FROM NEW.session_date)::integer
       AND ta.status = 'ACTIVE'::public."TeacherAvailabilityStatus"
       AND ta.archived_at IS NULL
       AND (ta.season_id IS NULL OR ta.season_id = enrollment_season_id)
       AND (ta.course_id IS NULL OR ta.course_id = enrollment_course_id)
       AND (ta.effective_from IS NULL OR ta.effective_from <= NEW.session_date)
       AND (ta.effective_to IS NULL OR ta.effective_to >= NEW.session_date)
       AND ta.start_time <= NEW.start_time
       AND ta.end_time >= NEW.end_time
  ) THEN
    RAISE EXCEPTION 'Teacher is not available for the enrollment course and lesson window.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS schedule_teacher_availability_guard
  ON public.schedule_sessions;
CREATE TRIGGER schedule_teacher_availability_guard
BEFORE INSERT OR UPDATE OF enrollment_id, teacher_id, session_date, start_time, end_time
ON public.schedule_sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_schedule_teacher_availability();

REVOKE ALL ON FUNCTION public.validate_teacher_availability_scope()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_schedule_teacher_availability()
  FROM PUBLIC, anon, authenticated;
