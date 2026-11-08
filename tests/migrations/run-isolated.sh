#!/usr/bin/env bash
set -euo pipefail
# Runtime dependencies: Bash, standard POSIX utilities, PostgreSQL server/client
# binaries, and the repository's installed Node/Vitest dependencies.
for command_name in grep cmp mktemp dirname id cat rm node; do
  command -v "$command_name" >/dev/null || { echo "Missing test dependency: $command_name" >&2; exit 1; }
done
# Never use an ambient DATABASE_URL. Own a fresh cluster and database for this run.
PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PG_BIN=${PG_BIN:-$(pg_config --bindir)}
# Child fixtures must use the same PostgreSQL installation as the owned cluster.
export PATH="$PG_BIN:$PATH"
for command_name in initdb pg_ctl createdb psql pg_dump pg_restore; do
  [[ -x "$PG_BIN/$command_name" ]] || { echo "Missing PostgreSQL test binary: $command_name" >&2; exit 1; }
done
TEST_ROOT=$(mktemp -d /tmp/ipsm-reset-tests.XXXXXX)
TEST_PORT=${IPSM_TEST_PORT:-55439}
export IPSM_DISPOSABLE_TEST_TOKEN=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')
unset VERCEL VERCEL_ENV
cleanup() {
  "$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -m immediate stop >/dev/null 2>&1 || true
  # Preserve logs on failure for review; never touch another database cluster.
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$TEST_ROOT/data" -A trust --encoding=UTF8 --no-locale > "$TEST_ROOT/init.log"
if ! "$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -l "$TEST_ROOT/server.log" -o "-k $TEST_ROOT -p $TEST_PORT -h 127.0.0.1 -c ipsm.disposable_test_token=$IPSM_DISPOSABLE_TEST_TOKEN" start; then
  cat "$TEST_ROOT/server.log"
  echo 'Isolated PostgreSQL could not start. No existing database was used.' >&2
  exit 1
fi
"$PG_BIN/createdb" -h 127.0.0.1 -p "$TEST_PORT" ipsm_reset_integrity_test
export DATABASE_URL="postgresql://$(id -un)@127.0.0.1:$TEST_PORT/ipsm_reset_integrity_test"
export DIRECT_URL="$DATABASE_URL"
export IPSM_DISPOSABLE_TEST_DATABASE=1
export RESET_TEST_DATABASE_URL="$DATABASE_URL"
cd "$PROJECT_ROOT"
source tests/migrations/assertions.sh
cmp prisma/migrations/20261107010000_reset_integrity/migration.sql supabase/migrations/20261107010000_reset_integrity.sql
cmp prisma/migrations/20261107000000_teacher_guard_parity/migration.sql supabase/migrations/20261107000000_teacher_guard_parity.sql
cmp prisma/migrations/20261108000000_ipsm_identifiers/migration.sql supabase/migrations/20261108000000_ipsm_identifiers.sql
bash tests/migrations/family-only.integration.sh
PSQL=("$PG_BIN/psql" "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
"${PSQL[@]}" -f tests/migrations/reset-baseline.sql
"${PSQL[@]}" -f tests/migrations/reset-bootstrap.sql
# Historical enrollment guard is a prerequisite, not replaced by the parity delta.
"${PSQL[@]}" -f prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql
# Synthetic sentinel only: ensure administrator reports do not reveal webhook
# arguments, function bodies/configuration or column-default literals.
"${PSQL[@]}" <<'SQL'
ALTER TABLE public.families ADD COLUMN preflight_redaction_probe text DEFAULT 'IPSM_PREFLIGHT_REDACTION_SENTINEL';
CREATE FUNCTION public.preflight_redaction_probe() RETURNS trigger LANGUAGE plpgsql
SET app.preflight_secret = 'IPSM_PREFLIGHT_REDACTION_SENTINEL'
AS $$ BEGIN PERFORM 'IPSM_PREFLIGHT_REDACTION_SENTINEL'; RETURN NEW; END $$;
CREATE TRIGGER preflight_redaction_probe BEFORE INSERT ON public.families
FOR EACH ROW EXECUTE FUNCTION public.preflight_redaction_probe('IPSM_PREFLIGHT_REDACTION_SENTINEL');
SQL
"${PSQL[@]}" -v app_role="$(id -un)" -v migration_role="$(id -un)" -f docs/sql/production-reset-preflight.sql > "$TEST_ROOT/preflight-before.log"
assert_redacted "$TEST_ROOT/preflight-before.log"
echo "Preflight synthetic-secret redaction assertion passed."
./node_modules/.bin/vitest run tests/production-reset-dashboard.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
"${PSQL[@]}" <<'SQL'
DROP TRIGGER preflight_redaction_probe ON public.families;
DROP FUNCTION public.preflight_redaction_probe();
ALTER TABLE public.families DROP COLUMN preflight_redaction_probe;
SQL
"${PSQL[@]}" -f prisma/migrations/20261107000000_teacher_guard_parity/migration.sql
# Model the reported broad creator defaults ONLY in this owned disposable cluster.
# Supabase Query 17 grants ALL eight table privileges on PG17 (including MAINTAIN).
# Also exercise PUBLIC/custom inherited defaults, without touching production.
"${PSQL[@]}" <<'SQL'
SELECT version() AS disposable_postgresql_version;
CREATE ROLE service_role BYPASSRLS;
CREATE ROLE ipsm_fixture_acl_parent;
CREATE ROLE ipsm_fixture_public_reader;
CREATE ROLE ipsm_fixture_set_only NOINHERIT;
CREATE ROLE ipsm_fixture_backend;
GRANT ipsm_fixture_acl_parent TO anon, authenticated, service_role, ipsm_fixture_set_only;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, ipsm_fixture_acl_parent, ipsm_fixture_public_reader, ipsm_fixture_set_only, ipsm_fixture_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, ipsm_fixture_acl_parent;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role, ipsm_fixture_acl_parent;
CREATE TABLE public.ipsm_unrelated_acl_probe(id integer PRIMARY KEY);
CREATE SCHEMA ipsm_fixture_acl;
CREATE TABLE ipsm_fixture_acl.before_migration AS
SELECT md5(string_agg(row_to_json(d)::text, ',' ORDER BY oid)) AS defaults_hash FROM pg_catalog.pg_default_acl d;
SQL
bash tests/migrations/reset-upgrade.integration.sh
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
  IF (SELECT defaults_hash FROM ipsm_fixture_acl.before_migration) IS DISTINCT FROM
    (SELECT md5(string_agg(row_to_json(d)::text, ',' ORDER BY oid)) FROM pg_catalog.pg_default_acl d) THEN
    RAISE EXCEPTION 'Migration changed global default ACLs';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p WHERE NOT has_table_privilege('anon','public.ipsm_unrelated_acl_probe',p)) THEN
    RAISE EXCEPTION 'Migration changed unrelated table privileges';
  END IF;
END $$;
DROP TABLE public.ipsm_unrelated_acl_probe;
DROP SCHEMA ipsm_fixture_acl CASCADE;
SQL
"${PSQL[@]}" -f tests/migrations/reset-integrity.sql
"${PSQL[@]}" -v app_role="$(id -un)" -v migration_role="$(id -un)" -f docs/sql/production-reset-preflight.sql > "$TEST_ROOT/preflight-after.log"
assert_redacted "$TEST_ROOT/preflight-after.log"
echo "Read-only administrator preflight passed before and after the proposed migrations."
./node_modules/.bin/vitest run tests/production-reset-dashboard.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
./node_modules/.bin/vitest run tests/production-reset.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
./node_modules/.bin/vitest run tests/production-reset-review.postgres.test.ts --pool=threads --poolOptions.threads.singleThread

./node_modules/.bin/vitest run tests/teacher-guard-parity.postgres.test.ts --pool=threads --poolOptions.threads.singleThread

# Last: reconstruct a synthetic current schema, rehearse only the future delta,
# and restore both pre/post backups within this same runner-owned cluster.
./node_modules/.bin/vitest run tests/production-reset-release.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
# Final approved namespace, still inactive by default. Tests certify synthetic
# evidence only and verify restore/restart bindings on the owned cluster.
./node_modules/.bin/vitest run tests/ipsm-identifiers.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
