-- 04. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
-- Missing table, denied access or unknown history layout is a BLOCKER; do not replace with an empty result.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
history AS (
 SELECT migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count,
  logs IS NOT NULL AS has_logs
 FROM public._prisma_migrations
),
findings AS (
 SELECT 'history_summary' AS section,CASE WHEN count(*)=0 THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END AS status,
  jsonb_build_object('records',count(*),'instruction','Empty or missing history requires reconciliation; no logs are returned') AS details FROM history
 UNION ALL
 SELECT 'prisma_migration',CASE WHEN finished_at IS NULL AND rolled_back_at IS NULL THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,to_jsonb(h) FROM history h
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '04', 'completed', true,
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
