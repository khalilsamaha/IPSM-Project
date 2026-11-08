-- 19. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Targeted metadata gaps only; no application records, bodies or expression literals.
-- Missing/error/timeout results are blockers. This does not authorize migrations.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
SET LOCAL row_security = off;
-- Same rendering context as teacher_guard_parity, independent of Dashboard defaults.
SET LOCAL search_path = pg_catalog, public;

WITH
-- Fill only independently verified role NAMES. Dashboard identity is not runtime identity.
role_input(app_role,migration_role) AS (VALUES ('REPLACE_APP_ROLE'::text,'REPLACE_MIGRATION_ROLE'::text)),
roles AS (
 SELECT r.*,a.oid AS app_oid,m.oid AS migration_oid
 FROM role_input r LEFT JOIN pg_catalog.pg_roles a ON a.rolname=r.app_role
 LEFT JOIN pg_catalog.pg_roles m ON m.rolname=r.migration_role
),
expected(function_name,table_name,trigger_name,trigger_md5,update_columns) AS (VALUES
 ('validate_teacher_availability_scope','teacher_availability','teacher_availability_scope_guard','80ee1f388eee210321317f711742c746',ARRAY['course_id','effective_from','effective_to','season_id','teacher_id']::text[]),
 ('validate_schedule_teacher_availability','schedule_sessions','schedule_teacher_availability_guard','b0d939e89c626d3b0d1c6b3a519688f6',ARRAY['end_time','enrollment_id','session_date','start_time','teacher_id']::text[]),
 ('validate_enrollment_teacher_availability','enrollments','enrollment_teacher_availability_guard','1eacafd0b375ce97cdb4d781178993d3',ARRAY['course_id','enrollment_end_date','enrollment_start_date','level_id','season_id','teacher_id']::text[])),
compared AS (
 SELECT e.function_name,e.table_name,e.trigger_name,p.oid AS function_oid,p.proowner,
  p.oid IS NOT NULL AS function_exists,t.oid IS NOT NULL AS trigger_exists,
  pg_get_userbyid(p.proowner) AS function_owner,pg_get_userbyid(c.relowner) AS table_owner,
  p.proowner=c.relowner AND p.proowner=r.migration_oid AS owner_matches_selected_migration_role,
  NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc other JOIN pg_catalog.pg_namespace n ON n.oid=other.pronamespace
    WHERE n.nspname='public' AND other.proname=e.function_name AND other.oid IS DISTINCT FROM p.oid) AS no_overloads,
  p.prorettype='trigger'::regtype AND p.prokind='f' AND p.provolatile='v' AND NOT p.prosecdef AND l.lanname='plpgsql'
   AND NOT p.proretset AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
   AND p.procost=100 AND p.prorows=0 AND p.prosupport=0 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.provariadic=0
   AND p.proargnames IS NULL AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
   AND p.proargdefaults IS NULL AND p.probin IS NULL AND p.prosqlbody IS NULL AS attributes_match,
  p.proconfig=ARRAY['search_path=""']::text[] AS configuration_matches,
  t.tgfoid=p.oid AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgtype=23
   AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgqual IS NULL AND NOT t.tgdeferrable AND NOT t.tginitdeferred
   AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0
   AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL AND md5(pg_get_triggerdef(t.oid,true))=e.trigger_md5
   AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num)=e.update_columns AS trigger_matches,
  CASE WHEN p.oid IS NOT NULL THEN
   (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
     'grantor',pg_get_userbyid(x.grantor),'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type)
    FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x) END AS acl,
  p.proacl IS NULL AS acl_uses_builtin_default,
  CASE WHEN p.oid IS NOT NULL AND r.app_oid IS NOT NULL THEN has_function_privilege(r.app_oid,p.oid,'EXECUTE') END AS selected_app_can_execute,
  CASE WHEN p.oid IS NOT NULL AND r.migration_oid IS NOT NULL THEN has_function_privilege(r.migration_oid,p.oid,'EXECUTE') END AS selected_migration_can_execute,
  (SELECT jsonb_agg(jsonb_build_object('role',client.name,'exists',cr.oid IS NOT NULL,
    'effective_execute',CASE WHEN cr.oid IS NOT NULL AND p.oid IS NOT NULL THEN has_function_privilege(cr.oid,p.oid,'EXECUTE') END)
    ORDER BY client.name)
   FROM (VALUES ('anon'),('authenticated'),('service_role')) client(name)
   LEFT JOIN pg_catalog.pg_roles cr ON cr.rolname=client.name) AS client_execute_review
 FROM expected e CROSS JOIN roles r
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure('public.'||e.function_name||'()')
 LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.'||e.table_name)
 LEFT JOIN pg_catalog.pg_trigger t ON t.tgrelid=c.oid AND t.tgname=e.trigger_name
),
findings AS (
 SELECT 'role_input' AS section,
  CASE WHEN app_oid IS NULL OR migration_oid IS NULL OR app_role LIKE 'REPLACE_%' OR migration_role LIKE 'REPLACE_%'
   THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END AS status,
  jsonb_build_object('supplied_app_role',app_role,'supplied_migration_role',migration_role,
   'app_role_exists',app_oid IS NOT NULL,'migration_role_exists',migration_oid IS NOT NULL,
   'dashboard_inspector',current_user,'runtime_identity_proven_by_this_query',false) AS details FROM roles
 UNION ALL SELECT 'guard_metadata',
  CASE WHEN function_exists AND trigger_exists AND owner_matches_selected_migration_role AND no_overloads
   AND attributes_match AND configuration_matches AND trigger_matches AND selected_app_can_execute AND selected_migration_can_execute
   THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END,
  to_jsonb(c)-'function_oid'-'proowner' FROM compared c
)

SELECT jsonb_build_object(
 'query_id','19','completed',true,'observed_at',transaction_timestamp(),
 'read_only',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),
 'server_version_num',current_setting('server_version_num'),
 'rendering_search_path',current_setting('search_path'),
 'status',CASE WHEN EXISTS(SELECT 1 FROM findings WHERE status='BLOCKER') THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
 'item_count',(SELECT count(*) FROM findings),
 'items',(SELECT jsonb_agg(to_jsonb(f) ORDER BY section,details::text) FROM findings f)
) AS preflight_report;
ROLLBACK;
