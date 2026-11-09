-- 11. IPSM project rakzehtbpzseetldbohm ONLY. Run this ENTIRE file in SQL Editor.
-- Read README.md first. Missing results, errors and timeouts are verification blockers.
-- Only schema metadata, hashes and aggregate diagnostics are returned.
-- Run only if query 01 finds BOTH identifier tables AND expenses.payroll_id. Missing/partial installation is NOT verified; see README.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
-- Does NOT bypass RLS: fail rather than return policy-filtered counts.
SET LOCAL row_security = off;

WITH
counter_summary AS (
 SELECT split_part(key,'-',1) AS kind,split_part(key,'-',2) AS year,value
 FROM public.business_identifier_counters WHERE key ~ '^(FAM|STU|RCPT)-[0-9]{4}$'
),
checks(section,affected) AS (
 SELECT 'nonstandard_counter_keys',count(*) FROM public.business_identifier_counters WHERE key !~ '^(FAM|STU|RCPT)-[0-9]{4}$'
 UNION ALL SELECT 'invalid_or_exhausted_counters',count(*) FROM public.business_identifier_counters WHERE value<0 OR value>=2147483647
 UNION ALL SELECT 'linked_expense_posting_mismatch',count(*) FROM public.expenses e
 LEFT JOIN public.teacher_payrolls p ON p.id=e.payroll_id
 WHERE e.payroll_id IS NOT NULL AND (p.id IS NULL OR p.status<>'PAID' OR p.gross_amount_cents IS DISTINCT FROM e.amount_cents
  OR lower(e.category) IS DISTINCT FROM 'teacher payroll' OR e.archived_at IS NOT NULL)
 UNION ALL SELECT 'duplicate_payroll_expense_links',count(*) FROM (
  SELECT payroll_id FROM public.expenses WHERE payroll_id IS NOT NULL GROUP BY payroll_id HAVING count(*)>1) q
),
findings AS (
 SELECT section,CASE WHEN affected>0 THEN 'BLOCKER' ELSE 'NO_FINDINGS' END AS status,jsonb_build_object('affected',affected) AS details FROM checks
 UNION ALL
 SELECT 'counter','REVIEW_REQUIRED',to_jsonb(c) FROM counter_summary c
 UNION ALL
 SELECT 'reservations','REVIEW_REQUIRED',jsonb_build_object(
  'kind',CASE WHEN kind IN ('FAM','STU','RCPT') THEN kind ELSE 'OTHER_REDACTED' END,
  'reservations',count(*),'history_only',count(*) FILTER (WHERE owner_id IS NULL))
 FROM public.issued_business_identifiers GROUP BY CASE WHEN kind IN ('FAM','STU','RCPT') THEN kind ELSE 'OTHER_REDACTED' END
),
report AS (
  SELECT jsonb_build_object(
    'query_id', '11', 'completed', true,
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
