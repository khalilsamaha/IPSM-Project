-- 03. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
expected(name) AS (VALUES ('validate_teacher_availability_scope'),('validate_schedule_teacher_availability'),
 ('validate_enrollment_teacher_availability'),('allocate_business_identifier'),('retain_business_identifier'),
 ('guard_reset_generation'),('guard_reset_registration_submission')),
findings AS (
 SELECT 'trigger' AS section,'REVIEW_REQUIRED' AS status,jsonb_build_object(
  'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'type_bits',t.tgtype,
  'argument_count',t.tgnargs,'definition_md5',md5(pg_get_triggerdef(t.oid,true)),
  'function_schema',pn.nspname,'function',p.proname,
  'function_arguments',pg_get_function_identity_arguments(p.oid),
  'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
  'function_body_md5',md5(p.prosrc),'function_configuration_md5',md5(p.proconfig::text)) AS details
 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal
 UNION ALL
 SELECT 'public_function','REVIEW_REQUIRED',jsonb_build_object(
  'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'kind',p.prokind,
  'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'volatility',p.provolatile,
  'body_md5',md5(p.prosrc),'configuration_md5',md5(p.proconfig::text))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 UNION ALL
 SELECT 'expected_function','REVIEW_REQUIRED',jsonb_build_object('name',e.name,
  'present',EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=e.name),
  'instruction','Compare absence/presence against histories and both proposed migrations; not proof of parity')
 FROM expected e
 UNION ALL
 SELECT 'rls_policy','REVIEW_REQUIRED',jsonb_build_object('table',tablename,'name',policyname,
  'permissive',permissive,'roles',roles,'command',cmd,
  'has_using',qual IS NOT NULL,'using_md5',md5(qual),
  'has_check',with_check IS NOT NULL,'check_md5',md5(with_check))
 FROM pg_catalog.pg_policies WHERE schemaname='public'
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '03', 'completed', true,
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
