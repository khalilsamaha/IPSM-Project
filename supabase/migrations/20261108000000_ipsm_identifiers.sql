-- Approved IPSM grammar. Certification/activation is deliberately NOT seeded.
-- Run only after the two reviewed PR90 foundation migrations. No historical DDL rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE public.business_identifier_counters ALTER COLUMN value TYPE bigint;
ALTER TABLE public.issued_business_identifiers
  ADD COLUMN namespace text,
  ADD COLUMN issuance_year integer,
  ADD COLUMN serial bigint,
  ADD CONSTRAINT ipsm_identifier_metadata CHECK ((
    (namespace IS NULL AND issuance_year IS NULL AND serial IS NULL) OR
    (namespace = 'IPSM' AND issuance_year BETWEEN 2000 AND 9999 AND serial > 0 AND
     value = kind || '-IPSM-' || issuance_year || '-' || lpad(serial::text,greatest(6,length(serial::text)),'0'))) IS TRUE);
CREATE UNIQUE INDEX ipsm_identifier_serial ON public.issued_business_identifiers(kind,namespace,issuance_year,serial) WHERE namespace IS NOT NULL;

-- Append-only administrator attestations. The app requires an explicitly selected
-- ID outside the DB too. A restored DB / restarted server needs a new attestation.
-- Hashes identify privately reviewed evidence; SQL cannot certify their truth.
CREATE TABLE public.business_identifier_activations (
  id uuid PRIMARY KEY,
  namespace text NOT NULL DEFAULT 'IPSM' CHECK(namespace='IPSM'),
  enabled boolean NOT NULL DEFAULT false,
  non_use_sha256 text NOT NULL CHECK(non_use_sha256 ~ '^[a-f0-9]{64}$'),
  recovery_sha256 text NOT NULL CHECK(recovery_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by text NOT NULL CHECK(length(trim(approved_by)) BETWEEN 1 AND 200),
  database_oid bigint NOT NULL,
  server_started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.business_identifier_allocations (
  kind text NOT NULL CHECK(kind IN ('FAM','STU','RCPT')),
  owner_id uuid NOT NULL,
  issuance_year integer NOT NULL CHECK(issuance_year BETWEEN 2000 AND 9999),
  activation_id uuid NOT NULL,
  value text NOT NULL,
  transaction_id text NOT NULL,
  PRIMARY KEY(kind,owner_id), UNIQUE(kind,value)
);
-- Private reviewed manifest entries, not a public import API. Every restoration
-- must insert an exact-owner grant in the SAME transaction as restoring the row.
CREATE TABLE public.business_identifier_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind IN ('FAM','STU','RCPT')),
  value text NOT NULL CHECK(length(value)>0),
  owner_id uuid,
  purpose text NOT NULL CHECK(purpose IN ('reservation','restoration','recovery')),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  approved_by text NOT NULL CHECK(length(trim(approved_by)) BETWEEN 1 AND 200),
  transaction_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(purpose <> 'restoration' OR owner_id IS NOT NULL)
);

CREATE INDEX business_identifier_imports_lookup ON public.business_identifier_imports(kind,value);

CREATE FUNCTION public.guard_identifier_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') OR (TG_OP='UPDATE' AND TG_TABLE_NAME <> 'business_identifier_counters') THEN
    RAISE EXCEPTION 'Identifier history is immutable';
  END IF;
  IF TG_TABLE_NAME IN ('issued_business_identifiers','business_identifier_counters') THEN
    IF pg_trigger_depth() < 2 THEN RAISE EXCEPTION 'Use reviewed allocation or manifest import'; END IF;
    IF TG_TABLE_NAME='business_identifier_counters' AND TG_OP='UPDATE' THEN
      IF NEW.key IS DISTINCT FROM OLD.key OR NEW.value < OLD.value THEN RAISE EXCEPTION 'Identifier counters cannot decrease'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.validate_identifier_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ipsm-activation-control',0));
  IF NEW.enabled AND (EXISTS(SELECT 1 FROM public.issued_business_identifiers WHERE namespace IS NULL AND value ~ '^(FAM|STU|RCPT)-IPSM-')
    OR EXISTS(SELECT 1 FROM public.audit_logs WHERE metadata::text ~ '(FAM|STU|RCPT)-IPSM-[0-9]{4}-[0-9]{6,19}'
      AND (NOT EXISTS(SELECT 1 FROM public.business_identifier_activations WHERE enabled)
        OR created_at < (SELECT min(created_at) AT TIME ZONE 'UTC' FROM public.business_identifier_activations WHERE enabled)))) THEN
    RAISE EXCEPTION 'Unreconciled historical IPSM namespace';
  END IF;
  NEW.database_oid := (SELECT oid::bigint FROM pg_catalog.pg_database WHERE datname=current_database());
  NEW.server_started_at := pg_catalog.pg_postmaster_start_time();
  NEW.created_at := greatest(clock_timestamp(), coalesce((SELECT max(created_at) + interval '1 microsecond' FROM public.business_identifier_activations),'-infinity'::timestamptz));
  INSERT INTO public.audit_logs(id,entity,action,entity_id,metadata)
  VALUES(gen_random_uuid(),'BusinessIdentifier','activation',NEW.id,
    jsonb_build_object('namespace','IPSM','enabled',NEW.enabled,'nonUseSha256',NEW.non_use_sha256,'recoverySha256',NEW.recovery_sha256,'approvedBy',NEW.approved_by));
  RETURN NEW;
END $$;

CREATE FUNCTION public.prepare_identifier_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET row_security=off AS $$
DECLARE activation public.business_identifier_activations%ROWTYPE; serial_value bigint; counter_key text;
BEGIN
  SELECT * INTO STRICT activation FROM public.business_identifier_activations WHERE id=NEW.activation_id AND enabled AND id=(SELECT id FROM public.business_identifier_activations ORDER BY created_at DESC LIMIT 1) FOR SHARE;
  IF activation.database_oid IS DISTINCT FROM (SELECT oid::bigint FROM pg_catalog.pg_database WHERE datname=current_database())
     OR activation.server_started_at IS DISTINCT FROM pg_catalog.pg_postmaster_start_time() THEN
    RAISE EXCEPTION 'Identifier recovery certification required';
  END IF;
  IF NEW.kind IS NULL OR NEW.kind NOT IN ('FAM','STU','RCPT') OR NEW.owner_id IS NULL
     OR NEW.issuance_year IS NULL OR NEW.issuance_year NOT BETWEEN 2000 AND 9999 THEN
    RAISE EXCEPTION 'Invalid identifier allocation';
  END IF;
  counter_key := NEW.kind || '-IPSM-' || NEW.issuance_year;
  INSERT INTO public.business_identifier_counters(key,value) VALUES(counter_key,1)
  ON CONFLICT(key) DO UPDATE SET value=public.business_identifier_counters.value+1
  WHERE public.business_identifier_counters.value < 9223372036854775807
  RETURNING value INTO serial_value;
  IF serial_value IS NULL THEN RAISE EXCEPTION 'Identifier serial exhausted'; END IF;
  NEW.value := counter_key || '-' || lpad(serial_value::text,greatest(6,length(serial_value::text)),'0');
  NEW.transaction_id := pg_current_xact_id()::text;
  INSERT INTO public.issued_business_identifiers(kind,value,owner_id,namespace,issuance_year,serial)
    VALUES(NEW.kind,NEW.value,NEW.owner_id,'IPSM',NEW.issuance_year,serial_value);
  RETURN NEW;
END $$;

CREATE FUNCTION public.allocate_ipsm_identifier(identifier_kind text, identifier_year integer, record_owner uuid, activation uuid) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET row_security=off AS $$
DECLARE result text;
BEGIN
  IF record_owner IS NULL OR activation IS NULL THEN RAISE EXCEPTION 'Identifier activation and owner required'; END IF;
  IF identifier_kind IS NULL OR identifier_kind NOT IN ('FAM','STU','RCPT') OR identifier_year IS NULL
    OR identifier_year NOT BETWEEN 2000 AND 9999 THEN RAISE EXCEPTION 'Invalid identifier kind or year'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.business_identifier_activations a WHERE a.id=activation AND a.enabled
    AND a.id=(SELECT id FROM public.business_identifier_activations ORDER BY created_at DESC LIMIT 1)
    AND a.database_oid=(SELECT oid::bigint FROM pg_catalog.pg_database WHERE datname=current_database())
    AND a.server_started_at=pg_catalog.pg_postmaster_start_time()) THEN
    RAISE EXCEPTION 'Identifier activation or recovery certification required';
  END IF;
  -- Serialize same-owner retries before the INSERT trigger allocates a counter.
  PERFORM pg_advisory_xact_lock(hashtextextended('ipsm-identifier:'||identifier_kind||':'||record_owner,0));
  SELECT value INTO result FROM public.business_identifier_allocations WHERE kind=identifier_kind AND owner_id=record_owner;
  IF result IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO public.business_identifier_allocations(kind,owner_id,issuance_year,activation_id,value,transaction_id)
    VALUES(identifier_kind,record_owner,identifier_year,activation,'','') RETURNING value INTO result;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.allocate_business_identifier(identifier_kind text, identifier_year integer) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Legacy allocator disabled; certified IPSM allocation required'; END $$;

CREATE FUNCTION public.apply_identifier_import() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET row_security=off AS $$
DECLARE existing public.issued_business_identifiers%ROWTYPE; parts text[]; serial_value bigint; bound_owner uuid;
BEGIN
  IF NEW.kind IS NULL OR NEW.kind NOT IN ('FAM','STU','RCPT') OR NEW.value IS NULL OR NEW.value='' THEN
    RAISE EXCEPTION 'Invalid identifier import';
  END IF;
  -- Exact-value lock also protects an absent reservation against competing imports.
  PERFORM pg_advisory_xact_lock(hashtextextended('ipsm-import:'||NEW.kind||':'||NEW.value,0));
  SELECT * INTO existing FROM public.issued_business_identifiers WHERE kind=NEW.kind AND value=NEW.value FOR UPDATE;
  SELECT owner_id INTO bound_owner FROM public.business_identifier_imports
    WHERE kind=NEW.kind AND value=NEW.value AND owner_id IS NOT NULL LIMIT 1;
  bound_owner := coalesce(existing.owner_id,bound_owner);
  IF bound_owner IS NOT NULL AND NEW.owner_id IS NOT NULL AND bound_owner <> NEW.owner_id THEN
    RAISE EXCEPTION 'Identifier ownership conflict';
  END IF;
  parts := regexp_match(NEW.value,'^(FAM|STU|RCPT)-IPSM-([0-9]{4})-([0-9]{6,19})$');
  IF parts IS NOT NULL THEN
    serial_value := parts[3]::bigint;
    IF parts[1] <> NEW.kind OR parts[2]::integer NOT BETWEEN 2000 AND 9999 OR serial_value <= 0
       OR parts[3] <> lpad(serial_value::text,greatest(6,length(serial_value::text)),'0') THEN
      RAISE EXCEPTION 'Noncanonical IPSM identifier';
    END IF;
    -- A new namespace value is accepted here only as recovered historical issuance,
    -- never as an ordinary manually chosen business identifier.
    IF existing.value IS NULL AND NEW.purpose <> 'recovery' THEN RAISE EXCEPTION 'IPSM values require recovery evidence'; END IF;
    INSERT INTO public.business_identifier_counters(key,value) VALUES(NEW.kind||'-IPSM-'||parts[2],serial_value)
      ON CONFLICT(key) DO UPDATE SET value=greatest(public.business_identifier_counters.value,EXCLUDED.value);
  ELSIF NEW.value ~ '^(FAM|STU|RCPT)-IPSM-' THEN RAISE EXCEPTION 'Invalid IPSM identifier';
  END IF;
  IF existing.value IS NULL THEN
    INSERT INTO public.issued_business_identifiers(kind,value,owner_id,namespace,issuance_year,serial)
    VALUES(NEW.kind,NEW.value,NEW.owner_id,CASE WHEN parts IS NOT NULL THEN 'IPSM' END,
      CASE WHEN parts IS NOT NULL THEN parts[2]::integer END,serial_value);
  END IF;
  NEW.transaction_id := pg_current_xact_id()::text;
  NEW.created_at := clock_timestamp();
  INSERT INTO public.audit_logs(id,entity,action,entity_id,metadata)
    VALUES(gen_random_uuid(),'BusinessIdentifier',NEW.purpose,NEW.id,
      jsonb_build_object('kind',NEW.kind,'manifestSha256',NEW.manifest_sha256,'approvedBy',NEW.approved_by));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.retain_business_identifier() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET row_security=off AS $$
DECLARE identifier text; previous_identifier text; record_owner uuid; bound_owner uuid; authorized boolean;
BEGIN
  identifier := to_jsonb(NEW)->>TG_ARGV[1];
  record_owner := CASE WHEN TG_TABLE_NAME='receipts' THEN (to_jsonb(NEW)->>'payment_id')::uuid ELSE NEW.id END;
  IF TG_OP='UPDATE' THEN
    previous_identifier := to_jsonb(OLD)->>TG_ARGV[1];
    IF NEW.id IS DISTINCT FROM OLD.id OR (TG_TABLE_NAME='receipts' AND to_jsonb(NEW)->>'payment_id' IS DISTINCT FROM to_jsonb(OLD)->>'payment_id')
      OR (previous_identifier IS NOT NULL AND previous_identifier IS DISTINCT FROM identifier) THEN
      RAISE EXCEPTION 'Issued business identifiers are immutable';
    END IF;
    IF previous_identifier IS NOT DISTINCT FROM identifier THEN RETURN NEW; END IF;
  END IF;
  IF identifier IS NULL THEN RETURN NEW; END IF;
  SELECT coalesce(i.owner_id,(SELECT x.owner_id FROM public.business_identifier_imports x
      WHERE x.kind=i.kind AND x.value=i.value AND x.owner_id IS NOT NULL LIMIT 1)) INTO bound_owner
    FROM public.issued_business_identifiers i WHERE i.kind=TG_ARGV[0] AND i.value=identifier;
  IF bound_owner IS DISTINCT FROM record_owner THEN RAISE EXCEPTION 'Identifier is unreserved or belongs to another owner'; END IF;
  authorized := EXISTS(SELECT 1 FROM public.business_identifier_allocations a WHERE a.kind=TG_ARGV[0] AND a.owner_id=record_owner
    AND a.value=identifier AND a.transaction_id=pg_current_xact_id()::text)
    OR EXISTS(SELECT 1 FROM public.business_identifier_imports x WHERE x.kind=TG_ARGV[0] AND x.value=identifier
      AND x.owner_id=record_owner AND x.purpose='restoration' AND x.transaction_id=pg_current_xact_id()::text);
  -- Reprint/repair of an existing historical payment/receipt never allocates.
  IF TG_TABLE_NAME='receipts' THEN authorized := authorized OR EXISTS(SELECT 1 FROM public.payments WHERE id=record_owner AND receipt_number=identifier);
  ELSIF TG_TABLE_NAME='payments' AND TG_OP='UPDATE' THEN authorized := authorized OR EXISTS(SELECT 1 FROM public.receipts WHERE payment_id=record_owner AND receipt_number=identifier);
  END IF;
  IF NOT authorized THEN RAISE EXCEPTION 'Same-transaction allocation or reviewed restoration required'; END IF;
  RETURN NEW;
END $$;
-- Protect ownership keys as well as displayed codes.
DROP TRIGGER retain_family_identifier ON public.families;
DROP TRIGGER retain_student_identifier ON public.students;
DROP TRIGGER retain_payment_identifier ON public.payments;
DROP TRIGGER retain_receipt_identifier ON public.receipts;
CREATE TRIGGER retain_family_identifier BEFORE INSERT OR UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('FAM','family_code');
CREATE TRIGGER retain_student_identifier BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('STU','student_code');
CREATE TRIGGER retain_payment_identifier BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('RCPT','receipt_number');
CREATE TRIGGER retain_receipt_identifier BEFORE INSERT OR UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('RCPT','receipt_number');
CREATE TRIGGER prepare_identifier_allocation BEFORE INSERT ON public.business_identifier_allocations FOR EACH ROW EXECUTE FUNCTION public.prepare_identifier_allocation();
CREATE TRIGGER apply_identifier_import BEFORE INSERT ON public.business_identifier_imports FOR EACH ROW EXECUTE FUNCTION public.apply_identifier_import();
CREATE TRIGGER validate_identifier_activation BEFORE INSERT ON public.business_identifier_activations FOR EACH ROW EXECUTE FUNCTION public.validate_identifier_activation();
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['business_identifier_activations','business_identifier_allocations','business_identifier_imports','issued_business_identifiers','business_identifier_counters'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_identifier_history BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_identifier_history()',name);
    EXECUTE format('CREATE TRIGGER immutable_identifier_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.guard_identifier_history()',name);
    IF name IN ('issued_business_identifiers','business_identifier_counters') THEN
      EXECUTE format('CREATE TRIGGER controlled_identifier_insert BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_identifier_history()',name);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
      EXECUTE format('CREATE TRIGGER guard_reset_generation BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.guard_reset_generation()',name);
    END IF;
  END LOOP;
END $$;
DO $$
DECLARE target record; recipient record; client record; access_role record; privilege text;
  table_privileges text[] := ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'];
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    table_privileges := array_append(table_privileges, 'MAINTAIN');
  END IF;
  FOR target IN SELECT c.oid, c.relname, c.relowner, c.relacl
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('business_identifier_activations','business_identifier_allocations','business_identifier_imports',
      'business_identifier_counters','issued_business_identifiers') LOOP
    IF target.relowner <> current_user::regrole::oid THEN
      RAISE EXCEPTION 'Unexpected reset infrastructure owner';
    END IF;
    FOR recipient IN SELECT DISTINCT a.grantee FROM pg_catalog.aclexplode(
      coalesce(target.relacl, pg_catalog.acldefault('r', target.relowner))) a
      WHERE a.grantee <> target.relowner LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %s CASCADE', target.relname,
        CASE WHEN recipient.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_catalog.pg_get_userbyid(recipient.grantee)) END);
    END LOOP;
    -- Check both immediately inherited grants and NOINHERIT memberships that
    -- permit SET ROLE. Never change global memberships to force this check through.
    FOR client IN SELECT oid, rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('anon','authenticated','service_role') LOOP
      FOR access_role IN SELECT oid, rolname FROM pg_catalog.pg_roles
        WHERE oid=client.oid OR pg_catalog.pg_has_role(client.oid, oid, 'MEMBER') LOOP
        FOREACH privilege IN ARRAY table_privileges LOOP
          IF pg_catalog.has_table_privilege(access_role.oid, target.oid, privilege)
            OR (CASE WHEN privilege IN ('SELECT','INSERT','UPDATE','REFERENCES')
                THEN pg_catalog.has_any_column_privilege(access_role.oid, target.oid, privilege) ELSE false END) THEN
            RAISE EXCEPTION 'Client retains effective reset table privilege via %: %.% (%); reconcile before migration',
              access_role.rolname, 'public', target.relname, privilege;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  FOR target IN SELECT p.oid, p.proowner, p.proacl, names.signature
    FROM (VALUES ('public.allocate_business_identifier(text,integer)'),
      ('public.retain_business_identifier()'),('public.guard_reset_generation()'),
      ('public.guard_reset_registration_submission()'),('public.allocate_ipsm_identifier(text,integer,uuid,uuid)'),
      ('public.guard_identifier_history()'),('public.validate_identifier_activation()'),
      ('public.prepare_identifier_allocation()'),('public.apply_identifier_import()')) names(signature)
    JOIN pg_catalog.pg_proc p ON p.oid=names.signature::regprocedure LOOP
    IF target.proowner <> current_user::regrole::oid THEN
      RAISE EXCEPTION 'Unexpected reset function owner';
    END IF;
    FOR recipient IN SELECT DISTINCT a.grantee FROM pg_catalog.aclexplode(
      coalesce(target.proacl, pg_catalog.acldefault('f', target.proowner))) a
      WHERE a.grantee <> target.proowner LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s CASCADE', target.signature,
        CASE WHEN recipient.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_catalog.pg_get_userbyid(recipient.grantee)) END);
    END LOOP;
    FOR client IN SELECT oid FROM pg_catalog.pg_roles
      WHERE rolname IN ('anon','authenticated','service_role') LOOP
      FOR access_role IN SELECT oid, rolname FROM pg_catalog.pg_roles
        WHERE oid=client.oid OR pg_catalog.pg_has_role(client.oid, oid, 'MEMBER') LOOP
        IF pg_catalog.has_function_privilege(access_role.oid, target.oid, 'EXECUTE') THEN
          RAISE EXCEPTION 'Client retains effective reset function execution via %: %', access_role.rolname, target.signature;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;


COMMIT;
