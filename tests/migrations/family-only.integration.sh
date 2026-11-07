#!/usr/bin/env bash
set -euo pipefail
if [[ ${IPSM_DISPOSABLE_TEST_DATABASE:-} != 1 || ${DATABASE_URL:-} != postgresql://*@127.0.0.1:*/ipsm_reset_integrity_test ]]; then
  echo "Use npm run test:migration; this script only accepts the runner's disposable local database." >&2
  exit 1
fi
: "${DATABASE_URL:?Set DATABASE_URL to an isolated PostgreSQL test database}"
source tests/migrations/assertions.sh
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
MIGRATION=prisma/migrations/20260728000000_family_only_recurring_schedule/migration.sql
schema() {
  local legacy=${1:-yes}
  "${PSQL[@]}" <<SQL
DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE families(id uuid PRIMARY KEY, family_code text, name text NOT NULL, email text, phone text, notes text, status text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE students(id uuid PRIMARY KEY, family_id uuid, first_name text, last_name text, email text, phone text, created_at timestamptz DEFAULT now());
CREATE TABLE enrollments(id uuid PRIMARY KEY, student_id uuid NOT NULL REFERENCES students(id));
CREATE TABLE payments(id uuid PRIMARY KEY, family_id uuid REFERENCES families(id), receipt_number text, payment_date timestamptz DEFAULT now()$(if [[ $legacy == yes ]]; then printf ', student_id uuid'; fi));
CREATE TABLE payment_items(id uuid PRIMARY KEY, payment_id uuid, enrollment_id uuid, amount_cents int);
CREATE TABLE teachers(id uuid PRIMARY KEY); CREATE TABLE rooms(id uuid PRIMARY KEY);
CREATE TABLE schedule_sessions(id uuid PRIMARY KEY, session_date date NOT NULL);
SQL
}

# Fixture A: legacy student payer, generated and existing families, stable payment identity/allocation.
schema yes
"${PSQL[@]}" <<'SQL'
INSERT INTO families VALUES ('10000000-0000-0000-0000-000000000001','FAM-2026-000001','Existing',null,null,null,'ACTIVE',now(),now());
INSERT INTO students VALUES ('20000000-0000-0000-0000-000000000001',null,'Indy','One',null,null,now()),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Family','Two',null,null,now());
INSERT INTO enrollments VALUES ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO payments VALUES ('40000000-0000-0000-0000-000000000001',null,'R-KEEP-1',now(),'20000000-0000-0000-0000-000000000001'),('40000000-0000-0000-0000-000000000002',null,'R-KEEP-2',now(),'20000000-0000-0000-0000-000000000002');
INSERT INTO payment_items VALUES ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',500);
SQL
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE actual_count integer;
DECLARE independent_family uuid;
BEGIN
  SELECT count(*) INTO actual_count FROM public.students WHERE family_id IS NULL;
  IF actual_count <> 0 THEN RAISE EXCEPTION 'Fixture A failed: expected zero students without families, found %', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM public.payments WHERE family_id IS NULL;
  IF actual_count <> 0 THEN RAISE EXCEPTION 'Fixture A failed: expected zero payments without families, found %', actual_count; END IF;

  SELECT family_id INTO independent_family FROM public.students WHERE id = '20000000-0000-0000-0000-000000000001';
  IF independent_family IS NULL OR independent_family = '10000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Fixture A failed: independent student did not receive a distinct generated family; found %', independent_family;
  END IF;
  IF (SELECT family_id FROM public.students WHERE id = '20000000-0000-0000-0000-000000000002') IS DISTINCT FROM '10000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Fixture A failed: already-linked student did not retain the existing family';
  END IF;
  IF (SELECT family_id FROM public.payments WHERE id = '40000000-0000-0000-0000-000000000001') IS DISTINCT FROM independent_family THEN
    RAISE EXCEPTION 'Fixture A failed: payment 1 does not point to the generated independent-student family';
  END IF;
  IF (SELECT family_id FROM public.payments WHERE id = '40000000-0000-0000-0000-000000000002') IS DISTINCT FROM '10000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Fixture A failed: payment 2 does not point to the original existing family';
  END IF;

  SELECT count(*) INTO actual_count FROM public.payments
  WHERE (id = '40000000-0000-0000-0000-000000000001' AND receipt_number = 'R-KEEP-1')
     OR (id = '40000000-0000-0000-0000-000000000002' AND receipt_number = 'R-KEEP-2');
  IF actual_count <> 2 THEN RAISE EXCEPTION 'Fixture A failed: expected both payment IDs and receipt numbers unchanged, found % exact matches', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM public.payment_items
  WHERE id = '50000000-0000-0000-0000-000000000001'
    AND payment_id = '40000000-0000-0000-0000-000000000001'
    AND enrollment_id = '30000000-0000-0000-0000-000000000001' AND amount_cents = 500;
  IF actual_count <> 1 THEN RAISE EXCEPTION 'Fixture A failed: payment item identity, allocation, or amount changed'; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'student_id') THEN
    RAISE EXCEPTION 'Fixture A failed: payments.student_id still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_items pi JOIN public.payments p ON p.id=pi.payment_id JOIN public.enrollments e ON e.id=pi.enrollment_id JOIN public.students st ON st.id=e.student_id WHERE p.family_id IS DISTINCT FROM st.family_id) THEN
    RAISE EXCEPTION 'Fixture A failed: allocation-family mismatch remains';
  END IF;
END
$$;
SELECT 'fixture-a-ok';
SQL

# Fixture B: payer column absent; retry-safe schedule foundations already exist.
schema no
"${PSQL[@]}" <<'SQL'
INSERT INTO families VALUES ('10000000-0000-0000-0000-000000000001','FAM-2026-000001','Existing',null,null,null,'ACTIVE',now(),now());
INSERT INTO students VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Allocated','Student',null,null,now());
INSERT INTO enrollments VALUES ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
INSERT INTO payments VALUES ('40000000-0000-0000-0000-000000000001',null,'R-KEEP',now());
INSERT INTO payment_items VALUES ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',500);
SQL
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE actual_count integer;
BEGIN
  IF (SELECT family_id FROM public.payments WHERE id = '40000000-0000-0000-0000-000000000001') IS DISTINCT FROM '10000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Fixture B failed: payment family was not inferred from its allocation';
  END IF;
  SELECT count(*) INTO actual_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('schedule_patterns','school_closures');
  IF actual_count <> 2 THEN RAISE EXCEPTION 'Fixture B failed: expected both schedule foundation tables, found %', actual_count; END IF;
  SELECT count(*) INTO actual_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('schedule_patterns','school_closures') AND c.relrowsecurity;
  IF actual_count <> 2 THEN RAISE EXCEPTION 'Fixture B failed: expected RLS enabled on both schedule foundation tables, found % enabled', actual_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_sessions' AND column_name='schedule_pattern_id') THEN
    RAISE EXCEPTION 'Fixture B failed: public.schedule_sessions.schedule_pattern_id is absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.schedule_sessions'::regclass AND conname='schedule_sessions_schedule_pattern_id_fkey' AND contype='f') THEN
    RAISE EXCEPTION 'Fixture B failed: expected schedule-pattern foreign key is absent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='schedule_sessions' AND indexname='schedule_sessions_schedule_pattern_id_session_date_key') THEN
    RAISE EXCEPTION 'Fixture B failed: expected schedule-pattern/session-date unique index is absent';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='student_id') THEN
    RAISE EXCEPTION 'Fixture B failed: unexpected legacy payments.student_id column exists';
  END IF;
END
$$;
SELECT 'fixture-b-ok';
SQL

failure_case() {
  local sql=$1 expected=$2 status=0
  schema no
  "${PSQL[@]}" -c "$sql"
  local before after log
  before=$("${PSQL[@]}" -Atc "SELECT (SELECT count(*) FROM families), (SELECT count(*) FROM students), (SELECT count(*) FROM students WHERE family_id IS NOT NULL), (SELECT count(*) FROM payments), (SELECT count(*) FROM payments WHERE family_id IS NOT NULL)")
  log=$(mktemp)
  "${PSQL[@]}" -f "$MIGRATION" >"$log" 2>&1 || status=$?
  assert_migration_error "$status" "$expected" "$log"
  after=$("${PSQL[@]}" -Atc "SELECT (SELECT count(*) FROM families), (SELECT count(*) FROM students), (SELECT count(*) FROM students WHERE family_id IS NOT NULL), (SELECT count(*) FROM payments), (SELECT count(*) FROM payments WHERE family_id IS NOT NULL)")
  if [[ "$after" != "$before" ]]; then
    echo "Rollback fixture failed: expected counts/backfills '$before', found '$after'" >&2
    "${PSQL[@]}" -c "SELECT id, family_id, receipt_number FROM public.payments ORDER BY id; SELECT id, family_id, first_name, last_name FROM public.students ORDER BY id; SELECT id, family_code, name FROM public.families ORDER BY id; SELECT payment_id, enrollment_id, amount_cents FROM public.payment_items ORDER BY payment_id;" >&2
    exit 1
  fi
  "${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename IN ('schedule_patterns','school_closures')) THEN
    RAISE EXCEPTION 'Rollback fixture failed: migration-created tables remain after expected failure';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schedule_sessions' AND column_name='schedule_pattern_id') THEN
    RAISE EXCEPTION 'Rollback fixture failed: schedule_pattern_id remained after expected failure';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'schedule_%pattern%') THEN
    RAISE EXCEPTION 'Rollback fixture failed: migration-created schedule index remained after expected failure';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.schedule_sessions'::regclass AND conname='schedule_sessions_schedule_pattern_id_fkey') THEN
    RAISE EXCEPTION 'Rollback fixture failed: migration-created foreign key remained after expected failure';
  END IF;
END
$$;
SQL
  rm -f "$log"
}
failure_case "INSERT INTO payments VALUES ('40000000-0000-0000-0000-000000000001',null,'unallocated',now())" 'Family-only migration failed: 1 payment(s) could not be assigned to a family.'
failure_case "INSERT INTO families VALUES (gen_random_uuid(),'DUP','A',null,null,null,'ACTIVE',now(),now()),(gen_random_uuid(),'DUP','B',null,null,null,'ACTIVE',now(),now())" 'Family-only migration preflight failed: duplicate family codes exist'
failure_case "INSERT INTO payment_items VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1)" 'Family-only migration preflight failed: orphan payment items exist'

echo "PostgreSQL family-only migration integration tests passed"

# PR80 fixture: apply the integrity migration to the physical schema that existed
# immediately before PR80, then verify every enum, relation, foreign key, and index.
PR80_MIGRATION=prisma/migrations/20260730000000_registration_attempts_shift_integrity/migration.sql
"${PSQL[@]}" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');
CREATE TABLE public.users(id uuid PRIMARY KEY);
CREATE TABLE public.families(id uuid PRIMARY KEY);
CREATE TABLE public.students(id uuid PRIMARY KEY);
CREATE TABLE public.enrollments(id uuid PRIMARY KEY);
CREATE TABLE public.payments(id uuid PRIMARY KEY);
SQL
"${PSQL[@]}" -f "$PR80_MIGRATION"
"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  actual_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'registration_attempts' AND c.relkind = 'r'
  ) THEN RAISE EXCEPTION 'PR80 migration failed: public.registration_attempts does not exist'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'RegistrationAttemptStatus'
  ) THEN RAISE EXCEPTION 'PR80 migration failed: public.RegistrationAttemptStatus does not exist'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' AND t.typname = 'ShiftStatus' AND e.enumlabel = 'AUTO_CLOSED'
  ) THEN RAISE EXCEPTION 'PR80 migration failed: ShiftStatus does not contain AUTO_CLOSED'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    WHERE con.contype = 'f' AND child_ns.nspname = 'public' AND child.relname = 'registration_attempts'
      AND parent_ns.nspname = 'public' AND parent.relname = 'users'
      AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = child.oid AND attname = 'created_by_id')]
      AND con.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = parent.oid AND attname = 'id')]
  ) THEN RAISE EXCEPTION 'PR80 migration failed: registration_attempts.created_by_id does not reference public.users(id)'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = parent.relnamespace
    WHERE con.contype = 'f' AND n.nspname = 'public' AND parent.relname = 'user_profiles'
  ) THEN RAISE EXCEPTION 'PR80 migration failed: a foreign key incorrectly references public.user_profiles'; END IF;

  SELECT count(*) INTO actual_count
  FROM pg_constraint con
  JOIN pg_class child ON child.oid = con.conrelid
  JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
  JOIN pg_class parent ON parent.oid = con.confrelid
  JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
  WHERE con.contype = 'f' AND child_ns.nspname = 'public' AND child.relname = 'registration_attempts'
    AND parent_ns.nspname = 'public' AND parent.relname IN ('families', 'students', 'enrollments', 'payments');
  IF actual_count <> 4 THEN RAISE EXCEPTION 'PR80 migration failed: expected family, student, enrollment, and payment foreign keys; found %', actual_count; END IF;

  SELECT count(*) INTO actual_count FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'registration_attempts'
    AND indexname IN ('registration_attempts_family_id_idx', 'registration_attempts_primary_student_id_idx', 'registration_attempts_status_idx');
  IF actual_count <> 3 THEN RAISE EXCEPTION 'PR80 migration failed: expected all three registration-attempt indexes; found %', actual_count; END IF;
END
$$;
SELECT 'pr80-migration-ok';
SQL

echo "PostgreSQL PR80 migration integration tests passed"

SESSION_PRICING_MIGRATION="prisma/migrations/20260729010000_session_pricing_registration/migration.sql"
SUPABASE_SESSION_PRICING_MIGRATION="supabase/migrations/20260729010000_session_pricing_registration.sql"
cmp "$SESSION_PRICING_MIGRATION" "$SUPABASE_SESSION_PRICING_MIGRATION"
grep -Fq -- '"planned_session_count" INTEGER NOT NULL DEFAULT 15' "$SESSION_PRICING_MIGRATION"
grep -Fq -- 'configured_price_cents' "$SESSION_PRICING_MIGRATION"
grep -Fq -- '"pricing_source_id" UUID' "$SESSION_PRICING_MIGRATION"
