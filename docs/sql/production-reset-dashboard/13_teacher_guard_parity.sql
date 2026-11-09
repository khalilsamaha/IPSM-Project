-- 13. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
-- Exact approved body hashes: repository sources and independently reproduced live variants.
expected(function_name,table_name,trigger_name,body_md5,approved_live_body_md5,trigger_md5,update_columns) AS (VALUES
 ('validate_teacher_availability_scope','teacher_availability','teacher_availability_scope_guard','ce495851f4dce1da05f507f4af587a61','ce495851f4dce1da05f507f4af587a61','80ee1f388eee210321317f711742c746',ARRAY['course_id','effective_from','effective_to','season_id','teacher_id']::text[]),
 ('validate_schedule_teacher_availability','schedule_sessions','schedule_teacher_availability_guard','e9d829cecb69aedc692d7b1a5fdaaf07','8bf0ff83d02322ec49fb6500f794a74e','b0d939e89c626d3b0d1c6b3a519688f6',ARRAY['end_time','enrollment_id','session_date','start_time','teacher_id']::text[]),
 ('validate_enrollment_teacher_availability','enrollments','enrollment_teacher_availability_guard','e85ba87b42cfa5e5b60c2d3aaa0ccfc1','2e995c04ca6865d8160d798ee9e5099f','1eacafd0b375ce97cdb4d781178993d3',ARRAY['course_id','enrollment_end_date','enrollment_start_date','level_id','season_id','teacher_id']::text[])),
compared AS (
 SELECT e.*,p.oid IS NOT NULL AS function_exists,t.oid IS NOT NULL AS trigger_exists,
  md5(p.prosrc) AS live_body_md5,p.prosecdef,p.provolatile,p.prokind,
  p.proparallel,p.proisstrict,p.proleakproof,p.procost,p.prorows,
  pg_get_userbyid(p.proowner) AS owner,md5(p.proconfig::text) AS configuration_md5,
  p.prosrc IS NOT NULL AND md5(p.prosrc) IN (e.body_md5,e.approved_live_body_md5) AND p.prorettype='trigger'::regtype
   AND p.prokind='f' AND p.provolatile='v' AND NOT p.prosecdef AND l.lanname='plpgsql'
   AND p.proconfig=ARRAY['search_path=""']::text[]
   AND NOT p.proretset AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel='u'
   AND p.procost=100 AND p.prorows=0 AND p.prosupport=0 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.provariadic=0
   AND p.proargnames IS NULL AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
   AND p.proargdefaults IS NULL AND p.probin IS NULL AND p.prosqlbody IS NULL
   AND p.proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid=to_regclass('public.'||e.table_name)) AS function_matches,
  t.tgenabled,t.tgtype,t.tgnargs,md5(pg_get_triggerdef(t.oid,true)) AS trigger_definition_md5,
  (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
   JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num) AS live_update_columns,
  t.oid IS NOT NULL AND t.tgfoid=p.oid AND t.tgenabled='O' AND t.tgtype=23
   AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgqual IS NULL AND NOT t.tgdeferrable AND NOT t.tginitdeferred
   AND t.tgparentid=0 AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0
   AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL AND md5(pg_get_triggerdef(t.oid,true))=e.trigger_md5
   AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr) k(num)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.num)=e.update_columns AS trigger_matches
 FROM expected e
 LEFT JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure('public.'||e.function_name||'()')
 LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
 LEFT JOIN pg_catalog.pg_trigger t ON t.tgrelid=to_regclass('public.'||e.table_name)
   AND t.tgname=e.trigger_name AND NOT t.tgisinternal
),
findings AS (
 SELECT 'teacher_guard_parity' AS section,
  CASE WHEN function_matches IS TRUE AND trigger_matches IS TRUE THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END AS status,
  to_jsonb(c)||jsonb_build_object('instruction',
   'Matching bodies/attributes/triggers establish only this guard parity. Review columns, indexes, constraints and grants separately. The parity migration validates exact source bytes and preserves approved existing functions, attributes, ACLs and triggers. This hash report is not a substitute for all migration assertions.') AS details
 FROM compared c
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '13', 'completed', true,
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
