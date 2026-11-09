-- 10. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
-- Role names only: administrator must replace BOTH placeholders; do not alter grants or use SET ROLE.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
-- EDIT ONLY these two role names, not credentials. Unknown/placeholders => BLOCKER.
input(app_role,migration_role) AS (VALUES ('REPLACE_APP_ROLE'::text,'REPLACE_MIGRATION_ROLE'::text)),
roles AS (
 SELECT input.*,a.oid AS app_oid,m.oid AS migration_oid,a.rolsuper,a.rolbypassrls
 FROM input LEFT JOIN pg_catalog.pg_roles a ON a.rolname=input.app_role
 LEFT JOIN pg_catalog.pg_roles m ON m.rolname=input.migration_role
),
findings AS (
 SELECT 'role_input' AS section,CASE WHEN app_oid IS NULL OR migration_oid IS NULL THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END AS status,
  jsonb_build_object('app_role',app_role,'migration_role',migration_role,'app_exists',app_oid IS NOT NULL,
   'migration_exists',migration_oid IS NOT NULL,'instruction','Confirm actual Prisma and migration role names privately; never infer from SQL Editor current_user') AS details FROM roles
 UNION ALL
 SELECT 'required_supabase_role',CASE WHEN r.oid IS NULL THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('name',names.name,'exists',r.oid IS NOT NULL)
 FROM (VALUES ('anon'),('authenticated')) names(name) LEFT JOIN pg_catalog.pg_roles r ON r.rolname=names.name
 UNION ALL
 SELECT 'role_flags','REVIEW_REQUIRED',jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,
  'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'can_login',r.rolcanlogin,'bypass_rls',r.rolbypassrls)
 FROM pg_catalog.pg_roles r CROSS JOIN input WHERE r.rolname IN (input.app_role,input.migration_role,'anon','authenticated','service_role')
 UNION ALL
 SELECT 'schema_privileges','REVIEW_REQUIRED',jsonb_build_object(
  'app_schema_usage',has_schema_privilege(app_oid,'public','USAGE'),
  'migration_schema_create',has_schema_privilege(migration_oid,'public','CREATE'),
  'migration_database_create',has_database_privilege(migration_oid,current_database(),'CREATE'),
  'app_inherits_migration_role',pg_has_role(app_oid,migration_oid,'USAGE')) FROM roles
 UNION ALL
 SELECT 'table_privileges','REVIEW_REQUIRED',jsonb_build_object('table',c.relname,
  'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
  'app_select',has_table_privilege(app_oid,c.oid,'SELECT'),
  'app_insert',has_table_privilege(app_oid,c.oid,'INSERT'),
  'app_update',has_table_privilege(app_oid,c.oid,'UPDATE'),
  'app_delete',has_table_privilege(app_oid,c.oid,'DELETE'),
  'app_inherits_owner',pg_has_role(app_oid,c.relowner,'USAGE'),
  'migration_inherits_owner',pg_has_role(migration_oid,c.relowner,'USAGE'),
  'app_bypasses_table_rls',rolsuper OR rolbypassrls OR (NOT c.relforcerowsecurity AND pg_has_role(app_oid,c.relowner,'USAGE')))
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN roles
 WHERE n.nspname='public' AND c.relkind IN ('r','p')
 UNION ALL
 SELECT 'function_privileges','REVIEW_REQUIRED',jsonb_build_object('function',p.proname,
  'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),
  'app_execute',has_function_privilege(app_oid,p.oid,'EXECUTE'),
  'migration_inherits_owner',pg_has_role(migration_oid,p.proowner,'USAGE'))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace CROSS JOIN roles
 WHERE n.nspname='public' AND p.proname IN ('validate_teacher_availability_scope','validate_schedule_teacher_availability',
  'validate_enrollment_teacher_availability','allocate_business_identifier','retain_business_identifier',
  'guard_reset_generation','guard_reset_registration_submission')
 UNION ALL
 SELECT 'default_privileges','REVIEW_REQUIRED',jsonb_build_object('creating_role',pg_get_userbyid(d.defaclrole),
  'schema',coalesce(n.nspname,'ALL'),'object_type',d.defaclobjtype,'acl',d.defaclacl::text)
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN roles
 WHERE d.defaclrole=migration_oid
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '10', 'completed', true,
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
