-- 09. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
identifiers AS (
 SELECT 'families' AS source,'FAM' AS expected_kind,family_code AS value FROM public.families
 UNION ALL SELECT 'students','STU',student_code FROM public.students
 UNION ALL SELECT 'payments','RCPT',receipt_number FROM public.payments
 UNION ALL SELECT 'receipts','RCPT',receipt_number FROM public.receipts
),
recoverable AS (
 SELECT source,value FROM identifiers
 UNION ALL SELECT 'audit_logs',m[1] FROM public.audit_logs a
 CROSS JOIN LATERAL regexp_matches(a.metadata::text,'((?:FAM|STU|RCPT)-[0-9]{4}-[0-9]+)','g') AS m
),
high_water AS (
 SELECT split_part(value,'-',1) AS kind,split_part(value,'-',2) AS year,
  max(split_part(value,'-',3)::numeric) AS recovered_high_water,
  array_agg(DISTINCT source ORDER BY source) AS sources
 FROM recoverable WHERE value ~ '^(FAM|STU|RCPT)-[0-9]{4}-[0-9]+$' GROUP BY 1,2
),
duplicates(kind,affected) AS (
 SELECT 'FAM',count(*) FROM (SELECT family_code FROM public.families GROUP BY family_code HAVING count(*)>1 OR family_code IS NULL) q
 UNION ALL SELECT 'STU',count(*) FROM (SELECT student_code FROM public.students GROUP BY student_code HAVING count(*)>1 OR student_code IS NULL) q
),
findings AS (
 SELECT 'duplicate_or_null_owner_codes' AS section,CASE WHEN affected>0 THEN 'BLOCKER' ELSE 'NO_FINDINGS' END AS status,
  jsonb_build_object('kind',kind,'affected_groups',affected) AS details FROM duplicates
 UNION ALL
 SELECT 'high_water',CASE WHEN recovered_high_water>=2147483647 THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('kind',kind,'year',year,'recovered_high_water',recovered_high_water,
   'next_minimum',recovered_high_water+1,'integer_exhausted',recovered_high_water>=2147483647,'sources',sources)
 FROM high_water
 UNION ALL
 SELECT 'identifier_format','REVIEW_REQUIRED',jsonb_build_object('source',source,
  'missing',count(*) FILTER (WHERE value IS NULL),
  'nonstandard',count(*) FILTER (WHERE value IS NOT NULL AND value !~ ('^'||expected_kind||'-[0-9]{4}-[0-9]+$')))
 FROM identifiers GROUP BY source
 UNION ALL
 SELECT 'historical_coverage','REVIEW_REQUIRED',jsonb_build_object(
  'high_water_groups',(SELECT count(*) FROM high_water),
  'instruction','Missing/deleted history cannot be recovered by SQL. Compare older exports/backups privately; never share receipt records or audit payloads.')
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '09', 'completed', true,
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
