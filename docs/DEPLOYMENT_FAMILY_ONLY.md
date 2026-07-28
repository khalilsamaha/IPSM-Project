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
