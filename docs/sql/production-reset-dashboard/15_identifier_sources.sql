-- 15. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
source_counts(source,total_rows,non_null_codes) AS (
 SELECT 'families',count(*),count(family_code) FROM public.families
 UNION ALL SELECT 'students',count(*),count(student_code) FROM public.students
 UNION ALL SELECT 'payments',count(*),count(receipt_number) FROM public.payments
 UNION ALL SELECT 'receipts',count(*),count(receipt_number) FROM public.receipts
),
audit_codes AS (
 SELECT split_part(m[1],'-',1) AS kind,split_part(m[1],'-',2) AS year,
  split_part(m[1],'-',3)::numeric AS number
 FROM public.audit_logs a CROSS JOIN LATERAL regexp_matches(a.metadata::text,'((?:FAM|STU|RCPT)-[0-9]{4}-[0-9]+)','g') m
),
findings AS (
 SELECT 'current_source_population' AS section,'REVIEW_REQUIRED' AS status,
  jsonb_build_object('source',source,'total_rows',total_rows,'non_null_codes',non_null_codes,'currently_empty',total_rows=0) AS details FROM source_counts
 UNION ALL
 SELECT 'audit_high_water',CASE WHEN max(number)>=2147483647 THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END,
  jsonb_build_object('kind',kind,'year',year,'occurrences',count(*),'high_water',max(number)::text,'next_minimum',(max(number)+1)::text)
 FROM audit_codes GROUP BY kind,year
 UNION ALL
 SELECT 'audit_coverage','REVIEW_REQUIRED',jsonb_build_object('kind',k.kind,
  'recoverable_occurrences',(SELECT count(*) FROM audit_codes a WHERE a.kind=k.kind),
  'instruction','Empty current tables and no recoverable audit code do not prove an identifier was never issued. Family/Student create audits may omit codes; verify external history before first allocation.')
 FROM (VALUES ('FAM'),('STU'),('RCPT')) k(kind)
 UNION ALL
 SELECT 'creation_audit_coverage','REVIEW_REQUIRED',jsonb_build_object(
  'entity',e.entity,'create_events',count(a.id),
  'events_with_standard_code',count(a.id) FILTER (WHERE a.metadata::text ~ (e.prefix||'-[0-9]{4}-[0-9]+')))
 FROM (VALUES ('Family','FAM'),('Student','STU'),('Payment','RCPT')) e(entity,prefix)
 LEFT JOIN public.audit_logs a ON a.entity=e.entity AND a.action='create' GROUP BY e.entity,e.prefix
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '15', 'completed', true,
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
