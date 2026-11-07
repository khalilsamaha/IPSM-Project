#!/usr/bin/env bash
set -euo pipefail
# Never use an ambient DATABASE_URL. Own a fresh cluster and database for this run.
PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PG_BIN=${PG_BIN:-$(pg_config --bindir)}
TEST_ROOT=$(mktemp -d /tmp/ipsm-reset-tests.XXXXXX)
TEST_PORT=${IPSM_TEST_PORT:-55439}
cleanup() {
  "$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -m immediate stop >/dev/null 2>&1 || true
  # Preserve logs on failure for review; never touch another database cluster.
}
trap cleanup EXIT
"$PG_BIN/initdb" -D "$TEST_ROOT/data" -A trust --encoding=UTF8 --no-locale > "$TEST_ROOT/init.log"
if ! "$PG_BIN/pg_ctl" -D "$TEST_ROOT/data" -l "$TEST_ROOT/server.log" -o "-k $TEST_ROOT -p $TEST_PORT -h 127.0.0.1" start; then
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
bash tests/migrations/family-only.integration.sh
PSQL=("$PG_BIN/psql" "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
"${PSQL[@]}" -f tests/migrations/reset-baseline.sql
"${PSQL[@]}" -f tests/migrations/reset-bootstrap.sql
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
if rg -q 'IPSM_PREFLIGHT_REDACTION_SENTINEL' "$TEST_ROOT/preflight-before.log"; then
  echo 'Preflight exposed a synthetic secret sentinel; refusing to print the report.' >&2
  exit 1
fi
"${PSQL[@]}" <<'SQL'
DROP TRIGGER preflight_redaction_probe ON public.families;
DROP FUNCTION public.preflight_redaction_probe();
ALTER TABLE public.families DROP COLUMN preflight_redaction_probe;
SQL
"${PSQL[@]}" -f prisma/migrations/20261107000000_teacher_guard_parity/migration.sql
"${PSQL[@]}" -f prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql
bash tests/migrations/reset-upgrade.integration.sh
"${PSQL[@]}" -f tests/migrations/reset-integrity.sql
"${PSQL[@]}" -v app_role="$(id -un)" -v migration_role="$(id -un)" -f docs/sql/production-reset-preflight.sql > "$TEST_ROOT/preflight-after.log"
echo "Read-only administrator preflight passed before and after the proposed migrations."
./node_modules/.bin/vitest run tests/production-reset.postgres.test.ts --pool=threads --poolOptions.threads.singleThread
