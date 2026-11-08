BEGIN;
SET LOCAL search_path = pg_catalog, public;
-- Stabilize the affected table/trigger definitions during validation and DDL.
-- Release procedure also prohibits concurrent privileged function/schema DDL.
LOCK TABLE public.enrollments, public.schedule_sessions, public.teacher_availability,
  public.teacher_courses, public.teacher_payroll_items, public.teacher_payrolls,
  public.teachers IN SHARE ROW EXCLUSIVE MODE;

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

-- Names alone are not evidence of parity. Unknown existing definitions abort
-- this whole transaction; never overwrite/reinterpret them with IF NOT EXISTS.
DO $schema_check$
DECLARE expected record;
BEGIN
  IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_catalog.pg_enum
      WHERE enumtypid='public."TeacherCompensationBasis"'::regtype)
      IS DISTINCT FROM ARRAY['HOURLY','SESSION_UNIT']::text[] THEN
    RAISE EXCEPTION 'Teacher parity enum differs from reviewed definition';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('teachers','hourly_rate_cents','integer',true,'0'),
    ('teachers','compensation_basis','public."TeacherCompensationBasis"',true,'''HOURLY''::"TeacherCompensationBasis"'),
    ('teachers','session_rate_cents','integer',false,NULL),
    ('teachers','session_unit_minutes','integer',true,'30'),
    ('teacher_availability','course_id','uuid',false,NULL),
    ('teacher_payrolls','compensation_basis_snapshot','public."TeacherCompensationBasis"',false,NULL),
    ('teacher_payrolls','rate_unit_minutes_snapshot','integer',false,NULL),
    ('teacher_payroll_items','compensation_basis_snapshot','public."TeacherCompensationBasis"',false,NULL),
    ('teacher_payroll_items','rate_unit_minutes_snapshot','integer',false,NULL)
  ) AS reviewed(table_name,column_name,type_name,not_null,default_expr) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=('public.'||expected.table_name)::regclass
        AND a.attname=expected.column_name AND NOT a.attisdropped AND a.attnum>0
        AND a.atttypid=expected.type_name::regtype AND a.atttypmod=-1
        AND a.attnotnull=expected.not_null AND a.attidentity='' AND a.attgenerated=''
        AND pg_catalog.pg_get_expr(d.adbin,d.adrelid) IS NOT DISTINCT FROM expected.default_expr
    ) THEN RAISE EXCEPTION 'Teacher parity column differs from reviewed definition: %.%', expected.table_name,expected.column_name; END IF;
  END LOOP;
  FOR expected IN SELECT * FROM (VALUES
    ('teachers','teachers_rates_nonnegative','c','CHECK (((hourly_rate_cents >= 0) AND ((session_rate_cents IS NULL) OR (session_rate_cents >= 0))))'),
    ('teachers','teachers_session_unit_positive','c','CHECK ((session_unit_minutes > 0))'),
    ('teacher_availability','teacher_availability_course_id_fkey','f','FOREIGN KEY (course_id) REFERENCES courses(id) ON UPDATE CASCADE ON DELETE RESTRICT')
  ) AS reviewed(table_name,constraint_name,kind,definition) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint c
      WHERE c.conrelid=('public.'||expected.table_name)::regclass AND c.conname=expected.constraint_name
        AND c.contype::text=expected.kind AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
        AND c.connoinherit=(expected.kind='f') AND c.conislocal AND c.coninhcount=0
        AND pg_catalog.pg_get_constraintdef(c.oid)=expected.definition
        AND (expected.kind<>'f' OR c.confrelid='public.courses'::regclass)
    ) THEN RAISE EXCEPTION 'Teacher parity constraint differs from reviewed definition: %',expected.constraint_name; END IF;
  END LOOP;
  FOR expected IN SELECT * FROM (VALUES
    ('teacher_availability','teacher_availability_course_id_idx',false,1,'CREATE INDEX teacher_availability_course_id_idx ON public.teacher_availability USING btree (course_id)'),
    ('teacher_courses','teacher_courses_teacher_course_all_levels_key',true,2,'CREATE UNIQUE INDEX teacher_courses_teacher_course_all_levels_key ON public.teacher_courses USING btree (teacher_id, course_id) WHERE (level_id IS NULL)')
  ) AS reviewed(table_name,index_name,is_unique,key_count,definition) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_index i
      WHERE i.indexrelid=to_regclass('public.'||expected.index_name)
        AND i.indrelid=('public.'||expected.table_name)::regclass
        AND i.indisunique=expected.is_unique AND i.indnatts=expected.key_count AND i.indnkeyatts=expected.key_count
        AND i.indisvalid AND i.indisready AND i.indislive AND NOT i.indisprimary AND NOT i.indisexclusion
        AND NOT i.indnullsnotdistinct AND pg_catalog.pg_get_indexdef(i.indexrelid)=expected.definition
    ) THEN RAISE EXCEPTION 'Teacher parity index differs from reviewed definition: %',expected.index_name; END IF;
  END LOOP;
END $schema_check$;

-- Exact body equality, not whitespace/comment normalization of incoming source.
-- The two live variants were reconstructed from historical repository bodies and
-- independently reproduced their reported PostgreSQL prosrc MD5 values.
DO $guards$
DECLARE
  availability_body constant text := $availability_body$
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
$availability_body$;
  schedule_body constant text := $schedule_body$
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
$schedule_body$;
  enrollment_body constant text := $enrollment_body$
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
$enrollment_body$;
  expected record; actual record; function_oid oid; trigger_oid oid; live_body text;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('validate_teacher_availability_scope','teacher_availability','teacher_availability_scope_guard',
      availability_body,'ce495851f4dce1da05f507f4af587a61','ce495851f4dce1da05f507f4af587a61','80ee1f388eee210321317f711742c746',
      ARRAY['teacher_id','course_id','season_id','effective_from','effective_to']::text[],true),
    ('validate_schedule_teacher_availability','schedule_sessions','schedule_teacher_availability_guard',
      schedule_body,'e9d829cecb69aedc692d7b1a5fdaaf07','8bf0ff83d02322ec49fb6500f794a74e','b0d939e89c626d3b0d1c6b3a519688f6',
      ARRAY['enrollment_id','teacher_id','session_date','start_time','end_time']::text[],true),
    ('validate_enrollment_teacher_availability','enrollments','enrollment_teacher_availability_guard',
      enrollment_body,'e85ba87b42cfa5e5b60c2d3aaa0ccfc1','2e995c04ca6865d8160d798ee9e5099f','1eacafd0b375ce97cdb4d781178993d3',
      ARRAY['teacher_id','course_id','level_id','season_id','enrollment_start_date','enrollment_end_date']::text[],false)
  ) AS reviewed(name,table_name,trigger_name,canonical_body,canonical_md5,live_md5,trigger_md5,columns,may_create) LOOP
    live_body := CASE expected.name
      WHEN 'validate_enrollment_teacher_availability' THEN replace(enrollment_body,E'\n',E'\r\n')
      WHEN 'validate_schedule_teacher_availability' THEN replace(schedule_body,
        E'  -- Legacy/imported sessions without an enrollment retain their existing\n  -- application-managed behavior.\n','')
      ELSE availability_body END;
    IF md5(expected.canonical_body)<>expected.canonical_md5 OR md5(live_body)<>expected.live_md5 THEN
      RAISE EXCEPTION 'Reviewed teacher guard source/hash mismatch: %',expected.name;
    END IF;
    function_oid := to_regprocedure('public.'||expected.name||'()');
    SELECT oid INTO trigger_oid FROM pg_catalog.pg_trigger
      WHERE tgrelid=('public.'||expected.table_name)::regclass AND tgname=expected.trigger_name;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=expected.name AND p.oid IS DISTINCT FROM function_oid) THEN
      RAISE EXCEPTION 'Unreviewed teacher guard overload: %',expected.name;
    END IF;
    IF function_oid IS NULL THEN
      -- Availability/schedule may be added on the documented older schema path.
      -- Enrollment is an existing historical prerequisite; do not silently invent it.
      IF NOT expected.may_create OR trigger_oid IS NOT NULL THEN
        RAISE EXCEPTION 'Teacher guard prerequisite missing or inconsistent: %',expected.name;
      END IF;
      EXECUTE format('CREATE FUNCTION public.%I() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = %L AS %L',
        expected.name,'',expected.canonical_body);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %s ON public.%I FOR EACH ROW EXECUTE FUNCTION public.%I()',
        expected.trigger_name,array_to_string(expected.columns,', '),expected.table_name,expected.name);
      -- Match the prior creation policy only for newly created guards. Existing
      -- approved functions (including their owners/ACLs) are completely preserved.
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated',expected.name);
      function_oid := to_regprocedure('public.'||expected.name||'()');
      SELECT oid INTO trigger_oid FROM pg_catalog.pg_trigger
        WHERE tgrelid=('public.'||expected.table_name)::regclass AND tgname=expected.trigger_name;
    END IF;
    SELECT p.*,l.lanname INTO actual FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=function_oid;
    IF (actual.prosrc IS DISTINCT FROM expected.canonical_body AND actual.prosrc IS DISTINCT FROM live_body)
      OR actual.prosecdef OR actual.provolatile<>'v' OR actual.prokind<>'f' OR actual.lanname<>'plpgsql'
      OR actual.prorettype<>'trigger'::regtype OR actual.proretset OR actual.proisstrict OR actual.proleakproof
      OR actual.proparallel<>'u' OR actual.procost<>100 OR actual.prorows<>0 OR actual.prosupport<>0
      OR actual.pronargs<>0 OR actual.pronargdefaults<>0 OR actual.provariadic<>0
      OR actual.proargnames IS NOT NULL OR actual.proallargtypes IS NOT NULL OR actual.proargmodes IS NOT NULL
      OR actual.proargdefaults IS NOT NULL OR actual.probin IS NOT NULL OR actual.prosqlbody IS NOT NULL
      OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR actual.proowner<>current_user::regrole::oid
      OR actual.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid=('public.'||expected.table_name)::regclass) THEN
      RAISE EXCEPTION 'Teacher guard differs from reviewed parity migration: %; reconcile before deployment',expected.name;
    END IF;
    IF trigger_oid IS NULL OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.oid=trigger_oid
        AND t.tgfoid=function_oid AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgtype=23
        AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgqual IS NULL AND NOT t.tgdeferrable AND NOT t.tginitdeferred
        AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0
        AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
        AND md5(pg_catalog.pg_get_triggerdef(t.oid,true))=expected.trigger_md5
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
          JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num)
          = (SELECT array_agg(col ORDER BY col) FROM unnest(expected.columns) col)
    ) THEN
      RAISE EXCEPTION 'Teacher guard trigger differs from reviewed parity migration: %; reconcile before deployment',expected.trigger_name;
    END IF;
    -- Deliberately no CREATE OR REPLACE, DROP TRIGGER, ALTER FUNCTION or REVOKE
    -- for an existing approved guard. Its bytes, attributes and ACL remain intact.
  END LOOP;
END $guards$;

COMMIT;
