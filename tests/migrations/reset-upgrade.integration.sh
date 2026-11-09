#!/usr/bin/env bash
set -euo pipefail
if [[ ${IPSM_DISPOSABLE_TEST_DATABASE:-} != 1 || ${DATABASE_URL:-} != postgresql://*@127.0.0.1:*/ipsm_reset_integrity_test ]]; then
  echo "Use npm run test:migration with its owned disposable database." >&2
  exit 1
fi
source tests/migrations/assertions.sh
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
MIGRATION=prisma/migrations/20261107010000_reset_integrity/migration.sql
expect_rollback() {
  local expected=$1 log status=0
  log=$(mktemp /tmp/ipsm-reset-upgrade.XXXXXX)
  "${PSQL[@]}" -f "$MIGRATION" >"$log" 2>&1 || status=$?
  assert_migration_error "$status" "$expected" "$log"
  "${PSQL[@]}" <<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='payroll_id')
     OR to_regclass('public.production_reset_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'Failed migration did not roll back its schema changes';
  END IF;
END $$;
SQL
  rm -f "$log"
}

# Object revokes cannot undo ownership or predefined-role powers; fail closed.
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN EXECUTE format('GRANT %I TO anon', current_user); END $$;
SQL
expect_rollback 'Client role can assume reset infrastructure owner'
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN EXECUTE format('REVOKE %I FROM anon', current_user); END $$;
GRANT pg_read_all_data TO ipsm_fixture_acl_parent;
SQL
expect_rollback 'Client retains effective reset table privilege'
"${PSQL[@]}" -c 'REVOKE pg_read_all_data FROM ipsm_fixture_acl_parent'

# A familiar index name must not conceal a nonunique index.
"${PSQL[@]}" -c 'CREATE INDEX registration_attempts_enrollment_id_key ON public.registration_attempts(enrollment_id)'
expect_rollback 'Registration uniqueness index does not match'
"${PSQL[@]}" -c 'DROP INDEX public.registration_attempts_enrollment_id_key'

# Preserve real legacy posting links and fail rather than guess receipt ownership.
"${PSQL[@]}" <<'SQL'
INSERT INTO public.families(id,family_code,name,updated_at) VALUES('90000000-0000-4000-8000-000000000001','FAM-2099-000040','Upgrade fixture',now());
INSERT INTO public.payments(id,family_id,total_amount_cents,payment_method,receipt_number,updated_at) VALUES
 ('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001',500,'cash','RCPT-2099-000040',now()),
 ('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000001',500,'cash',null,now());
INSERT INTO public.receipts(id,payment_id,receipt_number) VALUES('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000003','RCPT-2099-000040');
INSERT INTO public.teachers(id,full_name,updated_at) VALUES('90000000-0000-4000-8000-000000000005','Upgrade fixture',now());
INSERT INTO public.teacher_payrolls(id,teacher_id,period_start,period_end,hourly_rate_snapshot_cents,gross_amount_cents,status,paid_at,updated_at) VALUES('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000005','2099-01-01','2099-01-31',1000,5000,'PAID',now(),now());
INSERT INTO public.expenses(id,category,description,amount_cents,payment_method) VALUES('90000000-0000-4000-8000-000000000007','Teacher Payroll','Upgrade fixture',5000,'whish');
INSERT INTO public.audit_logs(id,action,entity,entity_id,metadata) VALUES('90000000-0000-4000-8000-000000000008','mark_paid','TeacherPayroll','90000000-0000-4000-8000-000000000006','{"expenseId":"90000000-0000-4000-8000-000000000007","historicalReceipt":"RCPT-2099-000099"}');
SQL
# Model the reported 2 malformed references / 3 inconsistent pairs without
# assuming these synthetic historical orphans describe the live population.
"${PSQL[@]}" <<'SQL'
INSERT INTO public.audit_logs(id,action,entity,entity_id,metadata) VALUES
 ('90000000-0000-4000-8000-000000000009','mark_paid','TeacherPayroll','90000000-0000-4000-8000-000000000099','{}'),
 ('90000000-0000-4000-8000-000000000010','mark_paid','TeacherPayroll','90000000-0000-4000-8000-000000000098','{"expenseId":"not-a-uuid"}'),
 ('90000000-0000-4000-8000-000000000011','mark_paid','TeacherPayroll','90000000-0000-4000-8000-000000000097','{"expenseId":"90000000-0000-4000-8000-000000000096"}');
SQL
"${PSQL[@]}" -c "UPDATE public.expenses SET amount_cents=4999 WHERE id='90000000-0000-4000-8000-000000000007'"
expect_rollback 'Payroll audit links reference inconsistent live postings'
"${PSQL[@]}" -c "UPDATE public.expenses SET amount_cents=5000,archived_at=now() WHERE id='90000000-0000-4000-8000-000000000007'"
expect_rollback 'Payroll audit links reference inconsistent live postings'
"${PSQL[@]}" -c "UPDATE public.expenses SET archived_at=NULL WHERE id='90000000-0000-4000-8000-000000000007'"
"${PSQL[@]}" -c "UPDATE public.teacher_payrolls SET status='APPROVED' WHERE id='90000000-0000-4000-8000-000000000006'"
expect_rollback 'Payroll audit links reference inconsistent live postings'
"${PSQL[@]}" -c "UPDATE public.teacher_payrolls SET status='PAID' WHERE id='90000000-0000-4000-8000-000000000006'"

expect_rollback 'Receipt identifier has conflicting payment owners'
"${PSQL[@]}" -c "UPDATE public.receipts SET payment_id='90000000-0000-4000-8000-000000000002' WHERE id='90000000-0000-4000-8000-000000000004'"
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM public.audit_logs WHERE id IN ('90000000-0000-4000-8000-000000000009','90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000011')) <> 3 THEN
    RAISE EXCEPTION 'Historical audit references were modified by migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE id='90000000-0000-4000-8000-000000000007' AND payroll_id='90000000-0000-4000-8000-000000000006' AND amount_cents=5000 AND payment_method='whish') THEN
    RAISE EXCEPTION 'Legacy payroll backfill lost its posting or failed to link it';
  END IF;
  IF public.allocate_business_identifier('RCPT',2099) <> 'RCPT-2099-000100' THEN
    RAISE EXCEPTION 'Historical audit identifier was not included in the counter';
  END IF;
END $$;
-- Remove only disposable upgrade fixtures; keep the protected reservations.
DELETE FROM public.expenses WHERE id='90000000-0000-4000-8000-000000000007';
DELETE FROM public.teacher_payrolls WHERE id='90000000-0000-4000-8000-000000000006';
DELETE FROM public.teachers WHERE id='90000000-0000-4000-8000-000000000005';
DELETE FROM public.receipts WHERE id='90000000-0000-4000-8000-000000000004';
DELETE FROM public.payments WHERE family_id='90000000-0000-4000-8000-000000000001';
DELETE FROM public.families WHERE id='90000000-0000-4000-8000-000000000001';
DELETE FROM public.audit_logs WHERE id IN ('90000000-0000-4000-8000-000000000008','90000000-0000-4000-8000-000000000009','90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000011');
SELECT 'reset-upgrade-migration-ok';
SQL
