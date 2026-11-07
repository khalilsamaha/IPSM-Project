-- IPSM ONLY: administrator must verify project rakzehtbpzseetldbohm in the
-- connection/dashboard before running. Never substitute another project.
-- Run with psql -X -v ON_ERROR_STOP=1 -v app_role=ACTUAL_PRISMA_ROLE
--   -v migration_role=ACTUAL_MIGRATION_ROLE -f this-file.sql
-- Supply the connection by your normal secure administrator mechanism.
-- No credentials, auth rows, settings values or arbitrary audit JSON are read.
-- This file is psql SQL (uses \if); do not paste it as one SQL Editor query.
-- Missing core tables/columns or denied permissions abort: that is a blocker,
-- not a reason to skip the failing section or change the production schema.
\set ON_ERROR_STOP on
\if :{?app_role}
\else
  \echo 'Required: -v app_role=the actual Prisma database role'
  \quit 3
\endif
\if :{?migration_role}
\else
  \echo 'Required: -v migration_role=the actual migration database role'
  \quit 3
\endif

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '3s';

-- 1. Identity and migration history. Database name alone does NOT prove the
-- Supabase project (many projects name their database postgres).
SELECT current_database() AS database_name, current_user AS inspecting_role,
       session_user, current_setting('server_version') AS postgres_version,
       current_setting('transaction_read_only') AS read_only,
       current_setting('transaction_isolation') AS isolation,
       :'app_role' AS supplied_app_role, :'migration_role' AS supplied_migration_role;
SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_prisma_history,
       to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_supabase_history,
       to_regclass('public.business_identifier_counters') IS NOT NULL AS has_counters,
       to_regclass('public.issued_business_identifiers') IS NOT NULL AS has_issued
\gset
\if :has_prisma_history
  SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
         applied_steps_count, logs IS NOT NULL AS has_logs
  FROM public._prisma_migrations ORDER BY started_at, migration_name;
\else
  \echo 'Prisma migration history absent: reconcile deployment history before rollout.'
\endif
\if :has_supabase_history
  SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
\else
  \echo 'Supabase migration history absent: reconcile deployment history before rollout.'
\endif

-- 2. Actual public objects, columns, defaults, enums, RLS and constraints.
-- Includes tables absent from Prisma; never treats them as resettable by default.
SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname;
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default IS NOT NULL AS has_default, md5(column_default) AS default_md5
FROM information_schema.columns WHERE table_schema='public'
ORDER BY table_name, ordinal_position;
SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
WHERE n.nspname='public' ORDER BY t.typname, e.enumsortorder;
SELECT child_ns.nspname AS child_schema, child.relname AS child_table,
       c.conname, c.contype, c.convalidated, c.condeferrable, c.condeferred,
       parent_ns.nspname AS parent_schema, parent.relname AS parent_table,
       pg_get_constraintdef(c.oid, true) AS definition
FROM pg_catalog.pg_constraint c
JOIN pg_catalog.pg_class child ON child.oid=c.conrelid
JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
LEFT JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid
LEFT JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
WHERE child_ns.nspname='public' OR parent_ns.nspname='public'
ORDER BY child_ns.nspname, child.relname, c.conname;
SELECT tablename, indexname, indexdef FROM pg_catalog.pg_indexes
WHERE schemaname='public' ORDER BY tablename, indexname;
SELECT idx.relname AS index_name, tbl.relname AS table_name,
       i.indisunique, i.indisvalid, i.indisready,
       pg_get_expr(i.indpred, i.indrelid) AS predicate
FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
JOIN pg_catalog.pg_class tbl ON tbl.oid=i.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid=tbl.relnamespace
WHERE n.nspname='public' ORDER BY tbl.relname, idx.relname;

-- Trigger definitions and function attributes/hashes, not arbitrary function
-- source text (which could contain sensitive configuration literals).
SELECT n.nspname AS table_schema, c.relname AS table_name, t.tgname,
       t.tgenabled, t.tgnargs AS argument_count,
       CASE WHEN t.tgnargs=0 THEN pg_get_triggerdef(t.oid, true)
         ELSE 'REDACTED: inspect argument-bearing trigger locally; webhook arguments may contain secrets'
       END AS definition,
       md5(pg_get_triggerdef(t.oid, true)) AS definition_md5,
       pn.nspname AS function_schema, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS function_arguments,
       pg_get_userbyid(p.proowner) AS function_owner, p.prosecdef,
       p.provolatile, (SELECT split_part(setting,'=',2) FROM unnest(p.proconfig) AS setting WHERE setting LIKE 'search_path=%') AS search_path, md5(p.prosrc) AS function_body_md5
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
WHERE NOT t.tgisinternal AND n.nspname='public' ORDER BY c.relname,t.tgname;
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef, (SELECT split_part(setting,'=',2) FROM unnest(p.proconfig) AS setting WHERE setting LIKE 'search_path=%') AS search_path,
       md5(p.prosrc) AS body_md5
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('validate_teacher_availability_scope','validate_schedule_teacher_availability',
  'validate_enrollment_teacher_availability','allocate_business_identifier',
  'retain_business_identifier','guard_reset_generation','guard_reset_registration_submission')
ORDER BY p.proname;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_catalog.pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

-- New-object collisions: expected absent before the reset-integrity migration.
SELECT name, to_regclass('public.' || name)::text AS existing_object
FROM unnest(ARRAY['production_reset_requests','production_reset_state',
 'reset_registration_submissions','business_identifier_counters',
 'issued_business_identifiers']) AS names(name);
SELECT column_name, udt_name, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='expenses' AND column_name='payroll_id';

-- 3. Registration and teacher-assignment uniqueness blockers.
SELECT enrollment_id, count(*) AS attempts, array_agg(id ORDER BY id) AS attempt_ids
FROM public.registration_attempts WHERE enrollment_id IS NOT NULL
GROUP BY enrollment_id HAVING count(*)>1;
SELECT payment_id, count(*) AS attempts, array_agg(id ORDER BY id) AS attempt_ids
FROM public.registration_attempts WHERE payment_id IS NOT NULL
GROUP BY payment_id HAVING count(*)>1;
SELECT registration_submission_id, count(*) AS enrollments
FROM public.enrollments WHERE registration_submission_id IS NOT NULL
GROUP BY registration_submission_id HAVING count(*)>1;
SELECT teacher_id, course_id, count(*) AS assignments,
       array_agg(id ORDER BY id) AS assignment_ids
FROM public.teacher_courses WHERE level_id IS NULL
GROUP BY teacher_id,course_id HAVING count(*)>1;
SELECT id, hourly_rate_cents, session_rate_cents, session_unit_minutes
FROM public.teachers WHERE hourly_rate_cents<0 OR session_rate_cents<0 OR session_unit_minutes<=0;

-- Existing scope violations are not repaired by installing validation triggers.
SELECT ta.id, ta.teacher_id, ta.course_id, ta.season_id
FROM public.teacher_availability ta LEFT JOIN public.seasons s ON s.id=ta.season_id
WHERE (ta.season_id IS NOT NULL AND (s.id IS NULL OR ta.effective_from IS NULL
       OR ta.effective_to IS NULL OR ta.effective_from<s.start_date
       OR ta.effective_to>s.end_date OR ta.effective_to<ta.effective_from))
   OR (ta.course_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teacher_courses tc
       WHERE tc.teacher_id=ta.teacher_id AND tc.course_id=ta.course_id
         AND tc.status='ACTIVE' AND tc.archived_at IS NULL));
SELECT ss.id, ss.enrollment_id, ss.teacher_id
FROM public.schedule_sessions ss LEFT JOIN public.enrollments e ON e.id=ss.enrollment_id
WHERE ss.enrollment_id IS NOT NULL AND (e.id IS NULL OR NOT EXISTS (
 SELECT 1 FROM public.teacher_availability ta WHERE ta.teacher_id=ss.teacher_id
 AND ta.day_of_week=extract(dow FROM ss.session_date)::integer
 AND ta.status='ACTIVE' AND ta.archived_at IS NULL
 AND (ta.season_id IS NULL OR ta.season_id=e.season_id)
 AND (ta.course_id IS NULL OR ta.course_id=e.course_id)
 AND (ta.effective_from IS NULL OR ta.effective_from<=ss.session_date)
 AND (ta.effective_to IS NULL OR ta.effective_to>=ss.session_date)
 AND ta.start_time<=ss.start_time AND ta.end_time>=ss.end_time));

-- 4. Audit-based payroll reconciliation. IDs, amounts and counts only.
-- Invalid UUIDs are guarded with CASE, never blindly cast.
SELECT id AS audit_id, entity_id AS payroll_id
FROM public.audit_logs WHERE entity='TeacherPayroll'
 AND action IN ('mark_paid','payroll_shift_reconciled')
 AND (metadata->>'expenseId' IS NULL OR metadata->>'expenseId' !~*
 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
WITH links AS (
 SELECT entity_id AS payroll_id,
 CASE WHEN metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN (metadata->>'expenseId')::uuid END AS expense_id
 FROM public.audit_logs WHERE entity='TeacherPayroll' AND action IN ('mark_paid','payroll_shift_reconciled')
)
SELECT 'multiple_expenses_for_payroll' AS issue, payroll_id AS entity_id,
       count(DISTINCT expense_id) AS references_count
FROM links GROUP BY payroll_id HAVING count(DISTINCT expense_id)>1
UNION ALL
SELECT 'multiple_payrolls_for_expense', expense_id, count(DISTINCT payroll_id)
FROM links WHERE expense_id IS NOT NULL GROUP BY expense_id HAVING count(DISTINCT payroll_id)>1;
WITH links AS (
 SELECT DISTINCT entity_id AS payroll_id,
 CASE WHEN metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN (metadata->>'expenseId')::uuid END AS expense_id
 FROM public.audit_logs WHERE entity='TeacherPayroll' AND action IN ('mark_paid','payroll_shift_reconciled')
)
SELECT l.payroll_id,l.expense_id,p.status AS payroll_status,p.gross_amount_cents,
       e.amount_cents,e.payment_method,e.shift_id,e.archived_at,
       p.id IS NULL AS missing_payroll,e.id IS NULL AS missing_expense
FROM links l LEFT JOIN public.teacher_payrolls p ON p.id=l.payroll_id
LEFT JOIN public.expenses e ON e.id=l.expense_id
WHERE p.id IS NULL OR e.id IS NULL OR p.status<>'PAID'
 OR p.gross_amount_cents IS DISTINCT FROM e.amount_cents
 OR lower(e.category)<>'teacher payroll' OR e.archived_at IS NOT NULL;
WITH links AS (
 SELECT entity_id AS payroll_id,
 CASE WHEN metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN (metadata->>'expenseId')::uuid END AS expense_id
 FROM public.audit_logs WHERE entity='TeacherPayroll' AND action IN ('mark_paid','payroll_shift_reconciled')
)
SELECT 'paid_payroll_without_recoverable_posting' AS issue,p.id,p.gross_amount_cents AS amount_cents
FROM public.teacher_payrolls p WHERE p.status='PAID' AND NOT EXISTS
 (SELECT 1 FROM links l JOIN public.expenses e ON e.id=l.expense_id WHERE l.payroll_id=p.id)
UNION ALL
SELECT 'payroll_expense_without_recoverable_payroll',e.id,e.amount_cents
FROM public.expenses e WHERE lower(e.category)='teacher payroll' AND NOT EXISTS
 (SELECT 1 FROM links l JOIN public.teacher_payrolls p ON p.id=l.payroll_id WHERE l.expense_id=e.id);

-- 5. Receipt ownership and charge integrity, including archived/void history.
WITH owners AS (
 SELECT receipt_number,id AS payment_id FROM public.payments WHERE receipt_number IS NOT NULL
 UNION ALL SELECT receipt_number,payment_id FROM public.receipts
)
SELECT receipt_number,count(DISTINCT payment_id) AS owners,
       array_agg(DISTINCT payment_id) AS payment_ids
FROM owners GROUP BY receipt_number HAVING count(DISTINCT payment_id)>1;
SELECT p.id AS payment_id,r.id AS receipt_id,p.receipt_number AS payment_number,
       r.receipt_number AS receipt_number
FROM public.receipts r JOIN public.payments p ON p.id=r.payment_id
WHERE p.receipt_number IS DISTINCT FROM r.receipt_number;
SELECT id,fee_cents,discount_cents,final_fee_cents,paid_cents,remaining_cents
FROM public.enrollments WHERE fee_cents<0 OR discount_cents<0
 OR final_fee_cents<>greatest(0,fee_cents-discount_cents)
 OR paid_cents<0 OR remaining_cents<0 OR paid_cents+remaining_cents<>final_fee_cents;

-- 6. Recoverable high-water marks. NUMERIC avoids overflow in this diagnostic;
-- the proposed allocator uses INTEGER and must not be installed on overflow.
SELECT 'FAM' AS kind,family_code AS value,count(*) AS owners
FROM public.families GROUP BY family_code HAVING count(*)>1 OR family_code IS NULL
UNION ALL
SELECT 'STU',student_code,count(*) FROM public.students
GROUP BY student_code HAVING count(*)>1 OR student_code IS NULL;
WITH identifiers AS (
 SELECT 'families' AS source,family_code AS value FROM public.families
 UNION ALL SELECT 'students',student_code FROM public.students
 UNION ALL SELECT 'payments',receipt_number FROM public.payments WHERE receipt_number IS NOT NULL
 UNION ALL SELECT 'receipts',receipt_number FROM public.receipts
 UNION ALL SELECT 'audit_logs',m[1] FROM public.audit_logs a
 CROSS JOIN LATERAL regexp_matches(a.metadata::text,'((?:FAM|STU|RCPT)-[0-9]{4}-[0-9]+)','g') AS m
)
SELECT split_part(value,'-',1) AS kind,split_part(value,'-',2) AS year,
       max(split_part(value,'-',3)::numeric) AS recovered_high_water,
       max(split_part(value,'-',3)::numeric)+1 AS next_minimum,
       max(split_part(value,'-',3)::numeric)>=2147483647 AS integer_exhausted,
       array_agg(DISTINCT source) AS sources
FROM identifiers WHERE value ~ '^(FAM|STU|RCPT)-[0-9]{4}-[0-9]+$'
GROUP BY 1,2 ORDER BY 1,2;
WITH identifiers AS (
 SELECT 'FAM' AS kind,family_code AS value FROM public.families
 UNION ALL SELECT 'STU',student_code FROM public.students
 UNION ALL SELECT 'RCPT',receipt_number FROM public.payments
 UNION ALL SELECT 'RCPT',receipt_number FROM public.receipts
)
SELECT kind,count(*) FILTER (WHERE value IS NULL) AS missing,
 count(*) FILTER (WHERE value IS NOT NULL AND value !~ ('^' || kind || '-[0-9]{4}-[0-9]+$')) AS nonstandard
FROM identifiers GROUP BY kind;
\if :has_counters
  SELECT key,value FROM public.business_identifier_counters ORDER BY key;
\endif
\if :has_issued
  SELECT kind,count(*) AS reservations,count(*) FILTER (WHERE owner_id IS NULL) AS history_only
  FROM public.issued_business_identifiers GROUP BY kind;
\endif

-- 7. Role permissions: run using the real Prisma/migration role names, not an
-- assumed postgres/service_role. Effective grants do not themselves bypass RLS.
SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls
FROM pg_catalog.pg_roles WHERE rolname IN
 (:'app_role',:'migration_role','anon','authenticated','service_role');
SELECT :'app_role' AS app_role,
 pg_has_role(:'app_role',:'migration_role','USAGE') AS inherits_migration_owner_privileges,
 has_database_privilege(:'migration_role',current_database(),'CREATE') AS migration_database_create,
 has_schema_privilege(:'migration_role','public','CREATE') AS migration_schema_create,
 has_schema_privilege(:'app_role','public','USAGE') AS app_schema_usage;
SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege(:'app_role',c.oid,'SELECT') AS app_select,
 has_table_privilege(:'app_role',c.oid,'INSERT') AS app_insert,
 has_table_privilege(:'app_role',c.oid,'UPDATE') AS app_update,
 has_table_privilege(:'app_role',c.oid,'DELETE') AS app_delete,
 pg_has_role(:'app_role',c.relowner,'USAGE') AS app_inherits_owner,
 pg_has_role(:'migration_role',c.relowner,'USAGE') AS migration_inherits_owner
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 pg_get_userbyid(p.proowner) AS owner,
 has_function_privilege(:'app_role',p.oid,'EXECUTE') AS app_execute,
 pg_has_role(:'migration_role',p.proowner,'USAGE') AS migration_inherits_owner
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('validate_teacher_availability_scope','validate_schedule_teacher_availability',
 'allocate_business_identifier','retain_business_identifier','guard_reset_generation',
 'guard_reset_registration_submission') ORDER BY p.proname;
SELECT pg_get_userbyid(d.defaclrole) AS creating_role,
       coalesce(n.nspname,'ALL') AS schema_scope,d.defaclobjtype,d.defaclacl
FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
WHERE d.defaclrole IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=:'migration_role');

-- No writes are performed. End the consistent snapshot promptly.
ROLLBACK;
