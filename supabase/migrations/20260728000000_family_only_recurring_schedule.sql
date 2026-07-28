-- Family-only payer migration. Take a database backup before applying.
BEGIN;

-- Fail for corruption that cannot be repaired without guessing.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.families WHERE family_code IS NULL OR btrim(family_code) = '') THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: blank family codes exist';
  END IF;
  IF EXISTS (SELECT family_code FROM public.families GROUP BY family_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: duplicate family codes exist';
  END IF;
  IF EXISTS (SELECT 1 FROM public.students s LEFT JOIN public.families f ON f.id = s.family_id WHERE s.family_id IS NOT NULL AND f.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan students exist';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments p LEFT JOIN public.families f ON f.id = p.family_id WHERE p.family_id IS NOT NULL AND f.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan payments exist';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_items pi LEFT JOIN public.payments p ON p.id = pi.payment_id LEFT JOIN public.enrollments e ON e.id = pi.enrollment_id WHERE p.id IS NULL OR e.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan payment items exist';
  END IF;
END $$;

CREATE TEMP TABLE legacy_student_families (
  student_id uuid PRIMARY KEY,
  family_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO legacy_student_families (student_id, family_id)
SELECT id, gen_random_uuid() FROM public.students WHERE family_id IS NULL;

INSERT INTO public.families (id, family_code, name, email, phone, notes, status, created_at, updated_at)
SELECT m.family_id,
       'FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' ||
       lpad((row_number() OVER (ORDER BY s.created_at, s.id) +
         COALESCE((SELECT max(substring(family_code from '([0-9]{6})$')::bigint)
                   FROM public.families
                   WHERE family_code ~ ('^FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-[0-9]{6}$')), 0))::text, 6, '0'),
       COALESCE(NULLIF(btrim(s.last_name), ''), 'Student') || ' Family',
       s.email, s.phone, 'Migrated from legacy independent student record.', 'ACTIVE', now(), now()
FROM legacy_student_families m
JOIN public.students s ON s.id = m.student_id;

UPDATE public.students s SET family_id = m.family_id
FROM legacy_student_families m WHERE s.id = m.student_id;

-- student_id is deliberately confined to dynamic SQL so a modernized source schema parses.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'student_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.payments AS p
      SET family_id = s.family_id
      FROM public.students AS s
      WHERE p.family_id IS NULL
        AND p.student_id = s.id
        AND s.family_id IS NOT NULL
    $sql$;
  END IF;
END $$;

WITH payment_family_candidates AS (
  SELECT pi.payment_id,
         min(s.family_id::text)::uuid AS family_id,
         count(DISTINCT s.family_id) AS family_count
  FROM public.payment_items pi
  JOIN public.enrollments e ON e.id = pi.enrollment_id
  JOIN public.students s ON s.id = e.student_id
  WHERE s.family_id IS NOT NULL
  GROUP BY pi.payment_id
)
UPDATE public.payments p SET family_id = candidate.family_id
FROM payment_family_candidates candidate
WHERE p.id = candidate.payment_id
  AND p.family_id IS NULL
  AND candidate.family_count = 1;

DO $$
DECLARE unresolved_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.students WHERE family_id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration failed: students without families remain';
  END IF;
  IF EXISTS (
    SELECT pi.payment_id FROM public.payment_items pi
    JOIN public.enrollments e ON e.id = pi.enrollment_id
    JOIN public.students s ON s.id = e.student_id
    GROUP BY pi.payment_id HAVING count(DISTINCT s.family_id) > 1
  ) THEN
    RAISE EXCEPTION 'Family-only migration failed: a payment has allocations across multiple families';
  END IF;
  SELECT count(*) INTO unresolved_count FROM public.payments WHERE family_id IS NULL;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Family-only migration failed: % payment(s) could not be assigned to a family. These may have no allocations or allocations across multiple families.', unresolved_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payment_items pi
    JOIN public.payments p ON p.id = pi.payment_id
    JOIN public.enrollments e ON e.id = pi.enrollment_id
    JOIN public.students s ON s.id = e.student_id
    WHERE s.family_id IS DISTINCT FROM p.family_id
  ) THEN
    RAISE EXCEPTION 'Family-only migration failed: payment allocation family mismatch';
  END IF;
END $$;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_family_id_fkey;
ALTER TABLE public.students ALTER COLUMN family_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.students'::regclass AND conname = 'students_family_id_fkey') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.payments ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
DROP INDEX IF EXISTS public.payments_student_id_idx;
ALTER TABLE public.payments DROP COLUMN IF EXISTS student_id;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'SchedulePatternStatus') THEN
    CREATE TYPE public."SchedulePatternStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.schedule_patterns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT, room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
 day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), start_time text NOT NULL, end_time text NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL, status public."SchedulePatternStatus" NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
 CONSTRAINT schedule_pattern_dates CHECK (ends_on >= starts_on), CONSTRAINT schedule_pattern_times CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS schedule_patterns_enrollment_id_idx ON public.schedule_patterns(enrollment_id);
CREATE INDEX IF NOT EXISTS schedule_patterns_teacher_id_day_of_week_idx ON public.schedule_patterns(teacher_id, day_of_week);
ALTER TABLE public.schedule_sessions ADD COLUMN IF NOT EXISTS schedule_pattern_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.schedule_sessions'::regclass AND conname = 'schedule_sessions_schedule_pattern_id_fkey') THEN
    ALTER TABLE public.schedule_sessions ADD CONSTRAINT schedule_sessions_schedule_pattern_id_fkey FOREIGN KEY (schedule_pattern_id) REFERENCES public.schedule_patterns(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS schedule_sessions_schedule_pattern_id_session_date_key ON public.schedule_sessions(schedule_pattern_id, session_date);

CREATE TABLE IF NOT EXISTS public.school_closures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
 notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
 CONSTRAINT school_closure_dates CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS school_closures_start_date_end_date_idx ON public.school_closures(start_date, end_date);
ALTER TABLE public.schedule_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_closures ENABLE ROW LEVEL SECURITY;

-- Post-migration integrity assertions (the documented read-only equivalents must return zero).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.students WHERE family_id IS NULL) OR
     EXISTS (SELECT 1 FROM public.payments WHERE family_id IS NULL) OR
     EXISTS (SELECT 1 FROM public.payment_items pi JOIN public.payments p ON p.id = pi.payment_id JOIN public.enrollments e ON e.id = pi.enrollment_id JOIN public.students s ON s.id = e.student_id WHERE s.family_id IS DISTINCT FROM p.family_id) THEN
    RAISE EXCEPTION 'Family-only migration postflight failed';
  END IF;
END $$;

COMMIT;
