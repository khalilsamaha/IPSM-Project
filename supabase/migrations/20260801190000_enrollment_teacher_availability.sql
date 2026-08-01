-- Enforce teacher assignment and require a real availability occurrence for each enrollment.
-- The UI limits new enrollment dates to the effective teacher window. At the
-- database layer, season-wide historical enrollment records remain valid when
-- at least one matching lesson occurrence exists inside their date range.

CREATE OR REPLACE FUNCTION public.validate_enrollment_teacher_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  season_start date;
  season_end date;
BEGIN
  IF NEW.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT start_date, end_date
    INTO season_start, season_end
    FROM public.seasons
   WHERE id = NEW.season_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment references an unavailable season.';
  END IF;

  IF NEW.enrollment_start_date < season_start
     OR NEW.enrollment_end_date > season_end
     OR NEW.enrollment_end_date < NEW.enrollment_start_date THEN
    RAISE EXCEPTION 'Enrollment dates must remain inside the selected season.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.teacher_courses tc
     WHERE tc.teacher_id = NEW.teacher_id
       AND tc.course_id = NEW.course_id
       AND tc.status = 'ACTIVE'::public."AcademicConfigStatus"
       AND tc.archived_at IS NULL
       AND (tc.level_id IS NULL OR tc.level_id = NEW.level_id)
  ) THEN
    RAISE EXCEPTION 'The selected teacher is not actively assigned to this course and level.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.teacher_availability ta
     WHERE ta.teacher_id = NEW.teacher_id
       AND ta.status = 'ACTIVE'::public."TeacherAvailabilityStatus"
       AND ta.archived_at IS NULL
       AND (ta.season_id IS NULL OR ta.season_id = NEW.season_id)
       AND (ta.course_id IS NULL OR ta.course_id = NEW.course_id)
       AND EXISTS (
         SELECT 1
           FROM generate_series(
             greatest(NEW.enrollment_start_date, coalesce(ta.effective_from, season_start)),
             least(NEW.enrollment_end_date, coalesce(ta.effective_to, season_end)),
             interval '1 day'
           ) AS occurrence(day)
          WHERE extract(dow FROM occurrence.day)::integer = ta.day_of_week
       )
  ) THEN
    RAISE EXCEPTION 'No teacher availability occurrence exists inside the enrollment period.';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enrollment_teacher_availability_guard
  ON public.enrollments;
CREATE TRIGGER enrollment_teacher_availability_guard
BEFORE INSERT OR UPDATE OF teacher_id, course_id, level_id, season_id, enrollment_start_date, enrollment_end_date
ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.validate_enrollment_teacher_availability();

REVOKE ALL ON FUNCTION public.validate_enrollment_teacher_availability()
  FROM PUBLIC, anon, authenticated;
