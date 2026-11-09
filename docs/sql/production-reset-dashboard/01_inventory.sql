-- 01. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
required(name) AS (VALUES
 ('users'),('audit_logs'),('families'),('students'),('seasons'),('teachers'),('courses'),
 ('course_levels'),('course_pricings'),('teacher_courses'),('teacher_availability'),
 ('enrollments'),('registration_attempts'),('schedule_sessions'),('schedule_patterns'),
 ('school_closures'),('rooms'),('operational_settings'),('payments'),('payment_items'),
 ('receipts'),('expenses'),('cashier_shifts'),('teacher_payrolls'),('teacher_payroll_items')),
proposed(name) AS (VALUES ('production_reset_requests'),('production_reset_state'),
 ('reset_registration_submissions'),('business_identifier_counters'),('issued_business_identifiers')),
findings AS (
 SELECT 'identity' AS section, 'REVIEW_REQUIRED' AS status, jsonb_build_object(
  'database',current_database(),'inspecting_role',current_user,'session_role',session_user,
  'postgres_version',current_setting('server_version'),
  'project_identity','Verify rakzehtbpzseetldbohm in Dashboard URL; database name does not establish project identity') AS details
 UNION ALL
 SELECT 'required_table',CASE WHEN c.oid IS NULL OR c.relkind NOT IN ('r','p')
   OR has_table_privilege(current_user,c.oid,'SELECT') IS NOT TRUE THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('table',r.name,'present',c.oid IS NOT NULL,'kind',c.relkind,
    'inspector_select',CASE WHEN c.oid IS NOT NULL THEN has_table_privilege(current_user,c.oid,'SELECT') END)
 FROM required r LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.'||r.name)
 UNION ALL
 SELECT 'migration_history',CASE WHEN to_regclass(name) IS NULL THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('table',name,'present',to_regclass(name) IS NOT NULL)
 FROM (VALUES ('public._prisma_migrations'),('supabase_migrations.schema_migrations')) h(name)
 UNION ALL
 SELECT 'proposed_object',CASE WHEN to_regclass('public.'||name) IS NULL THEN 'EXPECTED_ABSENT_BEFORE_PR90' ELSE 'BLOCKER' END,
  jsonb_build_object('name',name,'present',to_regclass('public.'||name) IS NOT NULL,
    'instruction','An existing object is a collision until reconciled with migration history; absence is not post-migration validation')
 FROM proposed
 UNION ALL
 SELECT 'proposed_payroll_column',CASE WHEN EXISTS (
  SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('public.expenses')
  AND attname='payroll_id' AND attnum>0 AND NOT attisdropped) THEN 'BLOCKER' ELSE 'EXPECTED_ABSENT_BEFORE_PR90' END,
  jsonb_build_object('column','expenses.payroll_id','instruction','If present, run query 11 and reconcile the installation; never reapply blindly')
 UNION ALL
 SELECT 'public_object','REVIEW_REQUIRED',jsonb_build_object(
  'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'outside_prisma_reset_inventory',NOT EXISTS(SELECT 1 FROM required WHERE name=c.relname)
    AND NOT EXISTS(SELECT 1 FROM proposed WHERE name=c.relname))
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '01', 'completed', true,
    'observed_at', transaction_timestamp(),
    'read_only', current_setting('transaction_read_only'),
    'isolation', current_setting('transaction_isolation'),
    'status', CASE WHEN EXISTS (SELECT 1 FROM findings WHERE status='BLOCKER')
                   THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
    'item_count', (SELECT count(*) FROM findings),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY section, details::text) FROM findings f), '[]'::jsonb)
  ) AS preflight_report
)
SELECT preflight_report FROM report;
ROLLBACK;
