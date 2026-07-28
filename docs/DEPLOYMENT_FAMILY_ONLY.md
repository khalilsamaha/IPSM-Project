# Family-only deployment
1. Take and verify a restorable PostgreSQL backup.
2. Deploy application and migration as one maintenance release; run the preflight/backfill migration before Prisma generation.
3. Record counts from `students WHERE family_id IS NULL` and `payments WHERE family_id IS NULL OR student_id IS NOT NULL` before migration.
4. Apply `20260728000000_family_only_recurring_schedule`, then verify both null counts and allocation-family mismatches are zero.
5. Run `npm run prisma:generate`, then deploy the application processes.
6. Set `APP_TIME_ZONE` (default `Asia/Beirut`) for every server process.
7. Rollback requires restoring the backup after `payments.student_id` is dropped; a schema-only rollback cannot reconstruct the original payer column safely.
