# Family-only deployment
1. Take and verify a restorable PostgreSQL backup.
2. Deploy application and migration as one maintenance release; run the preflight/backfill migration before Prisma generation.
3. Record counts from `students WHERE family_id IS NULL` and `payments WHERE family_id IS NULL OR student_id IS NOT NULL` before migration.
4. Apply `20260728000000_family_only_recurring_schedule`, then verify both null counts and allocation-family mismatches are zero.
5. Run `npm run prisma:generate`, then deploy the application processes.
6. Set `APP_TIME_ZONE` (default `Asia/Beirut`) for every server process.
7. Rollback requires restoring the backup after `payments.student_id` is dropped; a schema-only rollback cannot reconstruct the original payer column safely.

## Read-only post-migration verification

The following three counts must each be zero:

```sql
SELECT count(*) FROM public.students WHERE family_id IS NULL;
SELECT count(*) FROM public.payments WHERE family_id IS NULL;
SELECT count(*)
FROM public.payment_items AS pi
JOIN public.payments AS p ON p.id = pi.payment_id
JOIN public.enrollments AS e ON e.id = pi.enrollment_id
JOIN public.students AS s ON s.id = e.student_id
WHERE s.family_id IS DISTINCT FROM p.family_id;
```

Confirm the legacy column is absent, the new tables exist, and RLS is enabled:

```sql
SELECT count(*) = 0 AS student_payer_removed
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'student_id';

SELECT c.relname, c.relrowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('schedule_patterns', 'school_closures');
```

Before deployment, snapshot payment IDs and receipt numbers and compare that snapshot after migration. The migration updates payer ownership in place; it does not recreate payments or receipts.

## Production rollout checklist

- [ ] Take a verified, restorable Supabase/PostgreSQL backup.
- [ ] Record pre-migration student, family, payment, payment-item, and enrollment counts.
- [ ] Export payment IDs and receipt numbers for an exact post-migration comparison.
- [ ] Apply `20260728000000_family_only_recurring_schedule` during the maintenance window.
- [ ] Run every read-only post-migration query above and compare the recorded counts and identifiers.
- [ ] Confirm `payments.student_id` is absent.
- [ ] Confirm `schedule_patterns` and `school_closures` exist.
- [ ] Confirm row-level security is enabled on both new tables.
- [ ] Confirm student/payment null-family, orphan-item, and cross-family mismatch counts are all zero.
- [ ] Set `APP_TIME_ZONE` to the school's IANA business timezone in every runtime.
- [ ] Deploy the application only after database verification passes.
- [ ] Run the registration, payment, and receipt smoke tests below.

## Manual production smoke tests

Use disposable test records and an authorized receptionist; never use real card or database credentials.

### Registration

- Register a new one-student family without payment and confirm no cashier shift is required.
- Register a new family with siblings, add a student to an existing family, and add an enrollment to an existing student.
- With an open shift, register with an initial payment and verify its payment, allocation, shift, balance, and receipt.
- Without an open shift, attempt an initial payment and verify the friendly shift message and that the entire registration/payment transaction rolls back if any operation fails.

### Family payment

- Select a family and confirm all current and previous-season enrollments appear; settled enrollments remain visible but cannot be allocated.
- Confirm Total amount, Paid, and Remaining equal the stored enrollment values.
- Record a valid payment with an open shift and verify its family, allocations, shift, receipt, and resulting balances.
- Verify cross-family allocations, over-allocation, and payment without an open shift are rejected without creating a payment or allocation.

### Receipt and reprint

- Verify the payer display falls back in order from father name, to mother name, to family name.
- Verify the complete family roster and allocation-only payment table are present.
- Reprint the receipt and confirm the existing receipt number is preserved.
