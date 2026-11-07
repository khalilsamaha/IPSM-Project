#!/usr/bin/env bash
set -euo pipefail
if [[ ${IPSM_DISPOSABLE_TEST_DATABASE:-} != 1 || ${DATABASE_URL:-} != postgresql://*@127.0.0.1:*/ipsm_reset_integrity_test ]]; then
  echo "Use npm run test:migration with its owned disposable database." >&2
  exit 1
fi
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
MIGRATION=prisma/migrations/20261107010000_reset_integrity/migration.sql
expect_rollback() {
  local expected=$1 log
  log=$(mktemp /tmp/ipsm-reset-upgrade.XXXXXX)
  if "${PSQL[@]}" -f "$MIGRATION" >"$log" 2>&1; then
    echo "Migration unexpectedly accepted inconsistent legacy data" >&2
    exit 1
  fi
  if ! rg -q "$expected" "$log"; then cat "$log"; exit 1; fi
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
expect_rollback 'Receipt identifier has conflicting payment owners'
"${PSQL[@]}" -c "UPDATE public.receipts SET payment_id='90000000-0000-4000-8000-000000000002' WHERE id='90000000-0000-4000-8000-000000000004'"
"${PSQL[@]}" -f "$MIGRATION"
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
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
DELETE FROM public.audit_logs WHERE id='90000000-0000-4000-8000-000000000008';
SELECT 'reset-upgrade-migration-ok';
SQL
