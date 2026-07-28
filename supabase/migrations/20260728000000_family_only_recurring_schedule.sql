-- Family-only payer migration. Take a database backup before applying.
-- Preflight: fail for corruption that cannot be repaired without guessing.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM families WHERE family_code IS NULL OR btrim(family_code) = '') THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: blank family codes exist';
  END IF;
  IF EXISTS (SELECT family_code FROM families GROUP BY family_code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: duplicate family codes exist';
  END IF;
  IF EXISTS (SELECT 1 FROM students s LEFT JOIN families f ON f.id=s.family_id WHERE s.family_id IS NOT NULL AND f.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan students exist';
  END IF;
  IF EXISTS (SELECT 1 FROM payments p LEFT JOIN families f ON f.id=p.family_id WHERE p.family_id IS NOT NULL AND f.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan payments exist';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_items pi LEFT JOIN payments p ON p.id=pi.payment_id LEFT JOIN enrollments e ON e.id=pi.enrollment_id WHERE p.id IS NULL OR e.id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration preflight failed: orphan payment items exist';
  END IF;
END $$;

-- One deterministic family per independent student. The UUID mapping is retained in a
-- temporary table for all payment reassignment in this transaction.
CREATE TEMP TABLE legacy_student_families(student_id uuid PRIMARY KEY, family_id uuid NOT NULL);
INSERT INTO legacy_student_families
SELECT id, gen_random_uuid() FROM students WHERE family_id IS NULL;

INSERT INTO families(id, family_code, name, email, phone, notes, status, created_at, updated_at)
SELECT m.family_id,
       'FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' ||
       lpad((row_number() OVER (ORDER BY s.created_at, s.id) +
         COALESCE((SELECT max(substring(family_code from '([0-9]{6})$')::bigint) FROM families WHERE family_code LIKE 'FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-%'), 0))::text, 6, '0'),
       COALESCE(NULLIF(btrim(s.last_name), ''), 'Student') || ' Family', s.email, s.phone,
       'Migrated from legacy independent student record.', 'ACTIVE', now(), now()
FROM legacy_student_families m JOIN students s ON s.id=m.student_id;

UPDATE students s SET family_id=m.family_id FROM legacy_student_families m WHERE s.id=m.student_id;
UPDATE payments p SET family_id=m.family_id FROM legacy_student_families m WHERE p.student_id=m.student_id;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE family_id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration failed: students without families remain';
  END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE family_id IS NULL) THEN
    RAISE EXCEPTION 'Family-only migration failed: payments without families remain';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_items pi JOIN payments p ON p.id=pi.payment_id JOIN enrollments e ON e.id=pi.enrollment_id JOIN students s ON s.id=e.student_id WHERE s.family_id <> p.family_id) THEN
    RAISE EXCEPTION 'Family-only migration failed: payment allocation family mismatch';
  END IF;
END $$;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_family_id_fkey;
ALTER TABLE students ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE students ADD CONSTRAINT students_family_id_fkey FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE RESTRICT;
ALTER TABLE payments ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_student_id_fkey;
DROP INDEX IF EXISTS payments_student_id_idx;
ALTER TABLE payments DROP COLUMN student_id;

CREATE TYPE "SchedulePatternStatus" AS ENUM ('ACTIVE','ARCHIVED');
CREATE TABLE schedule_patterns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
 teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
 day_of_week integer NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), start_time text NOT NULL, end_time text NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL, status "SchedulePatternStatus" NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
 CONSTRAINT schedule_pattern_dates CHECK(ends_on >= starts_on), CONSTRAINT schedule_pattern_times CHECK(end_time > start_time)
);
CREATE INDEX schedule_patterns_enrollment_id_idx ON schedule_patterns(enrollment_id);
CREATE INDEX schedule_patterns_teacher_id_day_of_week_idx ON schedule_patterns(teacher_id,day_of_week);
ALTER TABLE schedule_sessions ADD COLUMN schedule_pattern_id uuid REFERENCES schedule_patterns(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX schedule_sessions_schedule_pattern_id_session_date_key ON schedule_sessions(schedule_pattern_id,session_date);
CREATE TABLE school_closures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, CONSTRAINT school_closure_dates CHECK(end_date >= start_date));
CREATE INDEX school_closures_start_date_end_date_idx ON school_closures(start_date,end_date);
ALTER TABLE schedule_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_closures ENABLE ROW LEVEL SECURITY;
