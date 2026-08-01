-- Ensure enrollment dates and teacher assignment stay inside configured availability.

CREATE OR REPLACE FUNCTION public.validate_enrollment_teacher_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  season_start date;
  season_end date;
  availability_start date;
  availability_end date;
  matching_rule_count integer;
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

  SELECT
    count(*),
    min(coalesce(ta.effective_from, season_start)),
    max(coalesce(ta.effective_to, season_end))
  INTO matching_rule_count, availability_start, availability_end
  FROM public.teacher_availability ta
  WHERE ta.teacher_id = NEW.teacher_id
    AND ta.status = 'ACTIVE'::public."TeacherAvailabilityStatus"
    AND ta.archived_at IS NULL
    AND (ta.season_id IS NULL OR ta.season_id = NEW.season_id)
    AND (ta.course_id IS NULL OR ta.course_id = NEW.course_id);

  IF matching_rule_count = 0 THEN
    RAISE EXCEPTION 'The selected teacher has no active availability for this course and season.';
  END IF;

  IF NEW.enrollment_start_date < availability_start
     OR NEW.enrollment_end_date > availability_end THEN
    RAISE EXCEPTION 'Enrollment dates must remain inside the selected teacher availability period.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.teacher_availability ta
     WHERE ta.teacher_id = NEW.teacher_id
       AND ta.status = 'ACTIVE'::public."TeacherAvailabilityStatus"
       AND ta.archived_at IS NULL
       AND (ta.season_id IS NULL OR ta.season_id = NEW.season_id)
       AND (ta.course_id IS NULL OR ta.course_id = NEW.course_id)
       AND generate_series(
             greatest(NEW.enrollment_start_date, coalesce(ta.effective_from, season_start)),
             least(NEW.enrollment_end_date, coalesce(ta.effective_to, season_end)),
             interval '1 day'
           )::date IS NOT NULL
       AND extract(dow FROM generate_series(
             greatest(NEW.enrollment_start_date, coalesce(ta.effective_from, season_start)),
             least(NEW.enrollment_end_date, coalesce(ta.effective_to, season_end)),
             interval '1 day'
           ))::integer = ta.day_of_week
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
