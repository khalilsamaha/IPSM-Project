-- 16. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
-- If the stored statements column is absent or access is denied, retain the error as an evidence blocker.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
reported(version) AS (VALUES ('20260731171613'),('20260801163840'),('20260801165129')),
history AS (
 SELECT version,cardinality(statements) AS statement_count,md5(array_to_string(statements,E'
')) AS statements_md5,
  position('validate_teacher_availability_scope' IN coalesce(array_to_string(statements,E'
'),''))>0 AS mentions_availability_guard,
  position('validate_schedule_teacher_availability' IN coalesce(array_to_string(statements,E'
'),''))>0 AS mentions_schedule_guard,
  position('validate_enrollment_teacher_availability' IN coalesce(array_to_string(statements,E'
'),''))>0 AS mentions_enrollment_guard
 FROM supabase_migrations.schema_migrations
),
findings AS (
 SELECT 'migration_record' AS section,'REVIEW_REQUIRED' AS status,to_jsonb(h)||jsonb_build_object(
  'reported_version',EXISTS(SELECT 1 FROM reported r WHERE r.version=h.version),
  'instruction','A mention/hash does not establish which repository migration was applied; no stored SQL or arbitrary names returned.') AS details FROM history h
 UNION ALL
 SELECT 'reported_history_summary',CASE WHEN (SELECT count(*) FROM history)=3
  AND NOT EXISTS(SELECT 1 FROM reported r WHERE NOT EXISTS(SELECT 1 FROM history h WHERE h.version=r.version))
  THEN 'REVIEW_REQUIRED' ELSE 'BLOCKER' END,
  jsonb_build_object('records',(SELECT count(*) FROM history),'prisma_history_present',to_regclass('public._prisma_migrations') IS NOT NULL,
   'instruction','None of the three reported versions names a repository migration. Reconcile statement fingerprints and object definitions; do not mark unrelated files applied or replay the whole tree.')
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '16', 'completed', true,
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
