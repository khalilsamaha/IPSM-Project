#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to an isolated PostgreSQL test database}"
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
"${PSQL[@]}" -Atc "SELECT CASE WHEN (SELECT count(*) FROM students WHERE family_id IS NULL)=0 AND (SELECT count(*) FROM payments WHERE family_id IS NULL)=0 AND (SELECT count(*) FROM payments WHERE id::text LIKE '40000000-%' AND receipt_number LIKE 'R-KEEP-%')=2 AND (SELECT count(*) FROM payment_items)=1 AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='student_id') THEN 'fixture-a-ok' ELSE CAST(1/0 AS text) END"

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
"${PSQL[@]}" -Atc "SELECT CASE WHEN (SELECT family_id FROM payments LIMIT 1)='10000000-0000-0000-0000-000000000001' AND (SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('schedule_patterns','school_closures')) THEN 'fixture-b-ok' ELSE CAST(1/0 AS text) END"

failure_case() {
  local sql=$1
  schema no
  "${PSQL[@]}" -c "$sql"
  if "${PSQL[@]}" -f "$MIGRATION" >/dev/null 2>&1; then echo "Expected migration failure" >&2; exit 1; fi
  # The migration transaction must have rolled back its family backfill.
  "${PSQL[@]}" -Atc "SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='schedule_patterns') THEN 'rollback-ok' ELSE CAST(1/0 AS text) END" >/dev/null
}
failure_case "INSERT INTO payments VALUES ('40000000-0000-0000-0000-000000000001',null,'unallocated',now())"
failure_case "INSERT INTO families VALUES (gen_random_uuid(),'DUP','A',null,null,null,'ACTIVE',now(),now()),(gen_random_uuid(),'DUP','B',null,null,null,'ACTIVE',now(),now())"
failure_case "INSERT INTO payment_items VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1)"

echo "PostgreSQL family-only migration integration tests passed"
