-- Aggregate SELECT only. The caller must use REPEATABLE READ / READ ONLY,
-- row_security=off (error on filtered rows), and bounded statement/lock timeouts.
-- $1 is the selected Production activation UUID, bound as a query parameter.
WITH latest AS (
  SELECT * FROM public.business_identifier_activations ORDER BY created_at DESC LIMIT 1
), import_owners AS (
  SELECT kind, value, min(owner_id::text)::uuid AS owner_id,
    count(DISTINCT owner_id) AS owners
  FROM public.business_identifier_imports GROUP BY kind, value
), reservations AS (
  SELECT i.*, coalesce(i.owner_id, o.owner_id) AS bound_owner
  FROM public.issued_business_identifiers i LEFT JOIN import_owners o USING(kind,value)
), maxima AS (
  SELECT kind || '-IPSM-' || issuance_year AS key, max(serial) AS maximum
  FROM reservations WHERE namespace='IPSM' GROUP BY kind, issuance_year
), live_refs AS (
  SELECT 'FAM' AS kind, family_code AS value, id AS owner_id FROM public.families
  UNION ALL SELECT 'STU', student_code, id FROM public.students
  UNION ALL SELECT 'RCPT', receipt_number, id FROM public.payments WHERE receipt_number IS NOT NULL
  UNION ALL SELECT 'RCPT', receipt_number, payment_id FROM public.receipts
), checks AS (
  SELECT jsonb_build_object(
    'missing_or_disabled_activation', CASE WHEN coalesce((SELECT enabled FROM latest),false) THEN 0 ELSE 1 END,
    'selected_activation_mismatch', CASE WHEN coalesce((SELECT id=$1::uuid FROM latest),false) THEN 0 ELSE 1 END,
    'binding_mismatch', CASE WHEN coalesce((SELECT database_oid=(SELECT oid::bigint FROM pg_database WHERE datname=current_database())
      AND server_started_at=pg_postmaster_start_time() FROM latest),false) THEN 0 ELSE 1 END,
    'ambiguous_latest_attestation', (SELECT greatest(count(*)-1,0) FROM public.business_identifier_activations WHERE created_at=(SELECT created_at FROM latest)),
    'standby_server', CASE WHEN pg_is_in_recovery() THEN 1 ELSE 0 END,
    'counter_type_mismatch', CASE WHEN (SELECT format_type(atttypid,atttypmod) FROM pg_attribute
      WHERE attrelid='public.business_identifier_counters'::regclass AND attname='value')='bigint' THEN 0 ELSE 1 END,
    'invalid_reservation_metadata', (SELECT count(*) FROM reservations WHERE kind NOT IN ('FAM','STU','RCPT') OR
      NOT ((namespace IS NULL AND issuance_year IS NULL AND serial IS NULL AND value !~* '^(FAM|STU|RCPT)-IPSM-') OR
        (namespace='IPSM' AND issuance_year BETWEEN 2000 AND 9999 AND serial>0 AND
         value=kind||'-IPSM-'||issuance_year||'-'||lpad(serial::text,greatest(6,length(serial::text)),'0'))) IS TRUE),
    'conflicting_import_owners', (SELECT count(*) FROM import_owners o LEFT JOIN reservations i USING(kind,value)
      WHERE o.owners>1 OR (i.owner_id IS NOT NULL AND o.owner_id IS NOT NULL AND i.owner_id<>o.owner_id)),
    'imports_without_reservations', (SELECT count(*) FROM public.business_identifier_imports x
      LEFT JOIN reservations i USING(kind,value) WHERE i.value IS NULL),
    'allocation_mismatch', (SELECT count(*) FROM public.business_identifier_allocations a LEFT JOIN reservations i USING(kind,value)
      LEFT JOIN public.business_identifier_activations att ON att.id=a.activation_id
      WHERE i.value IS NULL OR i.bound_owner IS DISTINCT FROM a.owner_id OR i.namespace IS DISTINCT FROM 'IPSM'
        OR i.issuance_year IS DISTINCT FROM a.issuance_year OR att.id IS NULL),
    'unexplained_ipsm_reservations', (SELECT count(*) FROM reservations i WHERE namespace='IPSM'
      AND NOT EXISTS(SELECT 1 FROM public.business_identifier_allocations a WHERE a.kind=i.kind AND a.value=i.value)
      AND NOT EXISTS(SELECT 1 FROM public.business_identifier_imports x WHERE x.kind=i.kind AND x.value=i.value AND x.purpose='recovery')),
    'live_reference_mismatch', (SELECT count(*) FROM live_refs l LEFT JOIN reservations i USING(kind,value)
      WHERE i.value IS NULL OR i.bound_owner IS DISTINCT FROM l.owner_id),
    'receipt_payment_mismatch', (SELECT count(*) FROM public.receipts r LEFT JOIN public.payments p ON p.id=r.payment_id
      WHERE p.id IS NULL OR (p.receipt_number IS NOT NULL AND p.receipt_number IS DISTINCT FROM r.receipt_number)),
    'missing_or_regressed_counters', (SELECT count(*) FROM maxima m LEFT JOIN public.business_identifier_counters c USING(key)
      WHERE c.key IS NULL OR c.value<m.maximum),
    'negative_counters', (SELECT count(*) FROM public.business_identifier_counters WHERE value<0),
    'current_year_exhausted', (SELECT count(*) FROM public.business_identifier_counters
      WHERE key IN ('FAM-IPSM-'||extract(year FROM current_timestamp AT TIME ZONE 'UTC')::int,
                    'STU-IPSM-'||extract(year FROM current_timestamp AT TIME ZONE 'UTC')::int,
                    'RCPT-IPSM-'||extract(year FROM current_timestamp AT TIME ZONE 'UTC')::int)
        AND value=9223372036854775807)
  ) AS blockers,
  jsonb_build_object(
    'counter_above_retained_maximum', (SELECT count(*) FROM public.business_identifier_counters c LEFT JOIN maxima m USING(key)
      WHERE c.key ~ '^(FAM|STU|RCPT)-IPSM-[0-9]{4}$' AND c.value>coalesce(m.maximum,0)),
    'unrecognized_counter_key', (SELECT count(*) FROM public.business_identifier_counters WHERE key !~ '^(FAM|STU|RCPT)-(IPSM-)?[0-9]{4}$'),
    'ordinary_connections_read_only', CASE WHEN current_setting('default_transaction_read_only')='on' THEN 1 ELSE 0 END
  ) AS reviews
)
SELECT jsonb_build_object(
  'checked_at',clock_timestamp(), 'database',current_database(),
  'effective_role',current_user, 'login_role',session_user,
  'database_oid',(SELECT oid::bigint FROM pg_database WHERE datname=current_database()),
  'server_started_at',pg_postmaster_start_time(), 'server_version',current_setting('server_version'),
  'read_only',current_setting('transaction_read_only'), 'isolation',current_setting('transaction_isolation'),
  'row_security',current_setting('row_security'),
  'blockers',blockers, 'reviews',reviews
) AS report FROM checks;
