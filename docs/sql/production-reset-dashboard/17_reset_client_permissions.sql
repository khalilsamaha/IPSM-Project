-- 17. IPSM project rakzehtbpzseetldbohm ONLY. Execute the ENTIRE file.
-- Read-only catalog review, NOT impersonation or an API accessibility test.
-- postgres is the supplied candidate creator, NOT verified Vercel runtime identity.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
SET LOCAL row_security = off;
WITH
creator AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres'),
clients AS (
 SELECT names.name,r.oid,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin
 FROM (VALUES ('anon'),('authenticated'),('service_role')) names(name)
 LEFT JOIN pg_catalog.pg_roles r ON r.rolname=names.name
),
objects AS (
 SELECT names.name,c.oid,c.relowner,c.relrowsecurity,c.relforcerowsecurity
 FROM (VALUES ('production_reset_requests'),('production_reset_state'),('reset_registration_submissions'),
 ('business_identifier_counters'),('issued_business_identifiers')) names(name)
 LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.' || names.name)
),
functions AS (
 SELECT names.signature,to_regprocedure('public.' || names.signature)::oid AS oid
 FROM (VALUES ('allocate_business_identifier(text,integer)'),('retain_business_identifier()'),
 ('guard_reset_generation()'),('guard_reset_registration_submission()')) names(signature)
),
findings AS (
 SELECT 'creator_context' AS section,CASE WHEN EXISTS(SELECT 1 FROM creator) THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END AS status,
 jsonb_build_object('candidate_creator','postgres','runtime_identity_verified',false,
 'limitation','Creator defaults only; confirm actual migration connection and Vercel runtime separately') AS details
 UNION ALL
 SELECT 'client_role',CASE WHEN oid IS NULL THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 jsonb_build_object('role',name,'exists',oid IS NOT NULL,'bypass_rls',rolbypassrls,'superuser',rolsuper,'inherit',rolinherit,'login',rolcanlogin) FROM clients
 UNION ALL
 SELECT 'creator_default_acl','REVIEW_REQUIRED',jsonb_build_object('schema',coalesce(n.nspname,'ALL'),
 'object_type',d.defaclobjtype,'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
 'privilege',a.privilege_type,'grantable',a.is_grantable)
 FROM pg_catalog.pg_default_acl d JOIN creator ON creator.oid=d.defaclrole
 LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
 CROSS JOIN LATERAL aclexplode(d.defaclacl) a
 WHERE d.defaclnamespace=0 OR n.nspname='public'
 UNION ALL
 SELECT 'protected_table',CASE WHEN o.oid IS NULL THEN 'EXPECTED_ABSENT_BEFORE_PR90'
 WHEN NOT o.relrowsecurity OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=o.oid) THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 jsonb_build_object('table',o.name,'exists',o.oid IS NOT NULL,'owner',pg_get_userbyid(o.relowner),'rls',o.relrowsecurity,
 'force_rls',o.relforcerowsecurity,'policy_count',(SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid=o.oid)) FROM objects o
 UNION ALL
 SELECT 'effective_table_permissions',CASE WHEN o.oid IS NULL THEN 'EXPECTED_ABSENT_BEFORE_PR90'
 WHEN c.oid IS NULL THEN 'BLOCKER'
 WHEN c.name IN ('anon','authenticated') AND (
   has_table_privilege(c.oid,o.oid,'TRUNCATE') OR has_table_privilege(c.oid,o.oid,'REFERENCES') OR has_table_privilege(c.oid,o.oid,'TRIGGER')
   OR c.rolsuper OR c.rolbypassrls OR pg_has_role(c.oid,o.relowner,'USAGE')) THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 jsonb_build_object('table',o.name,'role',c.name,'select',has_table_privilege(c.oid,o.oid,'SELECT'),
 'insert',has_table_privilege(c.oid,o.oid,'INSERT'),'update',has_table_privilege(c.oid,o.oid,'UPDATE'),'delete',has_table_privilege(c.oid,o.oid,'DELETE'),
 'truncate',has_table_privilege(c.oid,o.oid,'TRUNCATE'),'references',has_table_privilege(c.oid,o.oid,'REFERENCES'),
 'trigger',has_table_privilege(c.oid,o.oid,'TRIGGER'),'inherits_owner',pg_has_role(c.oid,o.relowner,'USAGE')) FROM objects o CROSS JOIN clients c
 UNION ALL
 SELECT 'effective_function_permissions',CASE WHEN f.oid IS NULL THEN 'EXPECTED_ABSENT_BEFORE_PR90'
 WHEN c.oid IS NULL OR (c.name IN ('anon','authenticated') AND has_function_privilege(c.oid,f.oid,'EXECUTE')) THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 jsonb_build_object('signature',f.signature,'role',c.name,'execute',has_function_privilege(c.oid,f.oid,'EXECUTE'),
 'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner)) FROM functions f CROSS JOIN clients c LEFT JOIN pg_catalog.pg_proc p ON p.oid=f.oid
 UNION ALL
 SELECT 'membership_paths','REVIEW_REQUIRED',jsonb_build_object('client',c.name,'member_of',r.rolname,
 'immediately_inherited',pg_has_role(c.oid,r.oid,'USAGE')) FROM clients c JOIN pg_catalog.pg_roles r ON c.oid IS NOT NULL AND r.oid<>c.oid AND pg_has_role(c.oid,r.oid,'MEMBER')
),
report AS (
 SELECT jsonb_build_object('query_id','17','completed',true,'observed_at',transaction_timestamp(),
 'read_only',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),
 'status',CASE WHEN EXISTS(SELECT 1 FROM findings WHERE status='BLOCKER') THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 'item_count',(SELECT count(*) FROM findings),
 'items',(SELECT jsonb_agg(to_jsonb(f) ORDER BY section,details::text) FROM findings f)) AS preflight_report
)
SELECT preflight_report FROM report;
ROLLBACK;
