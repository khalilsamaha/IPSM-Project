-- Post-installation staging / separately authorized administrator check only.
-- Missing tables/functions, errors, timeout or partial output are BLOCKERS.
-- No activation IDs, individual codes, approver text or financial payloads returned.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '3s';
SET LOCAL row_security = off;
WITH result AS (SELECT jsonb_build_object(
  'report','20_identifier_activation','completed',true,
  'read_only',current_setting('transaction_read_only'),
  'activation_count',(SELECT count(*) FROM public.business_identifier_activations),
  'latest_enabled',(SELECT enabled FROM public.business_identifier_activations ORDER BY created_at DESC LIMIT 1),
  'latest_binding_matches',(SELECT database_oid=(SELECT oid::bigint FROM pg_database WHERE datname=current_database())
    AND server_started_at=pg_postmaster_start_time() FROM public.business_identifier_activations ORDER BY created_at DESC LIMIT 1),
  'unreconciled_ipsm_history',(SELECT count(*) FROM public.issued_business_identifiers WHERE namespace IS NULL AND value ~ '^(FAM|STU|RCPT)-IPSM-'),
  'historical_ipsm_audit_events',(SELECT count(*) FROM public.audit_logs WHERE metadata::text ~ '(FAM|STU|RCPT)-IPSM-[0-9]{4}-[0-9]{6,19}' AND (NOT EXISTS(SELECT 1 FROM public.business_identifier_activations WHERE enabled) OR created_at < (SELECT min(created_at) AT TIME ZONE 'UTC' FROM public.business_identifier_activations WHERE enabled))),
  'allocation_count',(SELECT count(*) FROM public.business_identifier_allocations),
  'import_count',(SELECT count(*) FROM public.business_identifier_imports),
  'counter_type',(SELECT format_type(atttypid,atttypmod) FROM pg_attribute WHERE attrelid='public.business_identifier_counters'::regclass AND attname='value'),
  'effective_client_table_grants',(SELECT count(*) FROM pg_roles r JOIN pg_roles a ON a.oid=r.oid OR pg_has_role(r.oid,a.oid,'MEMBER') CROSS JOIN
    (VALUES('business_identifier_activations'),('business_identifier_allocations'),('business_identifier_imports'),('business_identifier_counters'),('issued_business_identifiers')) t(name)
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] || CASE WHEN current_setting('server_version_num')::int>=170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) p(privilege)
    WHERE r.rolname IN ('anon','authenticated','service_role') AND has_table_privilege(a.oid,('public.'||t.name)::regclass,p.privilege)),
  'effective_client_function_grants',(SELECT count(*) FROM pg_roles r JOIN pg_roles a ON a.oid=r.oid OR pg_has_role(r.oid,a.oid,'MEMBER') CROSS JOIN
    (VALUES('public.allocate_ipsm_identifier(text,integer,uuid,uuid)'),('public.guard_identifier_history()'),('public.validate_identifier_activation()'),('public.prepare_identifier_allocation()'),('public.apply_identifier_import()')) f(signature)
    WHERE r.rolname IN ('anon','authenticated','service_role') AND has_function_privilege(a.oid,f.signature::regprocedure,'EXECUTE')),
  'runtime_identity_verified',false,
  'historical_non_use_certified_by_this_query',false
) AS report)
SELECT report || jsonb_build_object('status',CASE
  WHEN (report->>'effective_client_table_grants')::bigint>0 OR (report->>'effective_client_function_grants')::bigint>0
    OR (report->>'unreconciled_ipsm_history')::bigint>0 OR (report->>'historical_ipsm_audit_events')::bigint>0
    OR report->>'counter_type'<>'bigint'
    OR ((report->>'latest_enabled')::boolean AND NOT (report->>'latest_binding_matches')::boolean)
  THEN 'BLOCKER' ELSE 'REVIEW_REQUIRED' END) AS report FROM result;
ROLLBACK;
