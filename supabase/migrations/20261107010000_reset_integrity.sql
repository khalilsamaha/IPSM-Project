BEGIN;

-- Additive correction. Duplicates deliberately fail migration for manual review.
CREATE UNIQUE INDEX IF NOT EXISTS registration_attempts_enrollment_id_key ON public.registration_attempts(enrollment_id);
CREATE UNIQUE INDEX IF NOT EXISTS registration_attempts_payment_id_key ON public.registration_attempts(payment_id);

-- IF NOT EXISTS supports deployments where Prisma already created these indexes,
-- but a same-named partial/non-unique/wrong-column index must not mask drift.
DO $$ DECLARE column_name text; BEGIN
  FOREACH column_name IN ARRAY ARRAY['enrollment_id','payment_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
      JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0]
      WHERE i.indrelid='public.registration_attempts'::regclass
        AND idx.relname='registration_attempts_' || column_name || '_key'
        AND i.indisunique AND i.indisvalid AND i.indnatts=1
        AND i.indpred IS NULL AND i.indexprs IS NULL AND a.attname=column_name
    ) THEN RAISE EXCEPTION 'Registration uniqueness index does not match column %', column_name; END IF;
  END LOOP;
END $$;

ALTER TABLE public.expenses ADD COLUMN payroll_id uuid;
CREATE UNIQUE INDEX expenses_payroll_id_key ON public.expenses(payroll_id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_payroll_id_fkey
  FOREIGN KEY (payroll_id) REFERENCES public.teacher_payrolls(id) ON DELETE RESTRICT ON UPDATE CASCADE;
-- Only backfill unambiguous, existing audit links. Legacy ambiguous postings remain
-- visible and prevent non-financial reset; never guess from a person's name.
WITH links AS (
  SELECT entity_id AS payroll_id, (metadata->>'expenseId')::uuid AS expense_id
  FROM public.audit_logs
  WHERE entity = 'TeacherPayroll' AND action IN ('mark_paid', 'payroll_shift_reconciled')
    AND metadata->>'expenseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
), unique_links AS (
  SELECT DISTINCT l.* FROM links l
  WHERE (SELECT count(DISTINCT x.expense_id) FROM links x WHERE x.payroll_id = l.payroll_id) = 1
    AND (SELECT count(DISTINCT x.payroll_id) FROM links x WHERE x.expense_id = l.expense_id) = 1
)
UPDATE public.expenses e SET payroll_id = l.payroll_id
FROM unique_links l JOIN public.teacher_payrolls p ON p.id = l.payroll_id
WHERE e.id = l.expense_id;

CREATE TABLE public.production_reset_requests (
  id uuid PRIMARY KEY, actor_id uuid NOT NULL, selection jsonb NOT NULL,
  fingerprint text NOT NULL, preview jsonb NOT NULL, expires_at timestamp(3) NOT NULL,
  consumed_at timestamp(3), result jsonb, created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX production_reset_requests_actor_id_created_at_idx ON public.production_reset_requests(actor_id, created_at);
CREATE TABLE public.production_reset_state (id text PRIMARY KEY, changed_at timestamptz(6) NOT NULL);
INSERT INTO public.production_reset_state VALUES ('school', '-infinity');
CREATE TABLE public.reset_registration_submissions (id uuid PRIMARY KEY, reset_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.business_identifier_counters (key text PRIMARY KEY, value integer NOT NULL CHECK (value >= 0));
CREATE TABLE public.issued_business_identifiers (kind text NOT NULL, value text NOT NULL, owner_id uuid, PRIMARY KEY(kind, value));

INSERT INTO public.issued_business_identifiers SELECT 'FAM', family_code, id FROM public.families;
INSERT INTO public.issued_business_identifiers SELECT 'STU', student_code, id FROM public.students;
INSERT INTO public.issued_business_identifiers SELECT 'RCPT', receipt_number, id FROM public.payments WHERE receipt_number IS NOT NULL;
INSERT INTO public.issued_business_identifiers SELECT 'RCPT', receipt_number, payment_id FROM public.receipts ON CONFLICT DO NOTHING;
-- Reserve recoverable historical identifiers even when the original row is gone.
INSERT INTO public.issued_business_identifiers(kind, value)
SELECT DISTINCT split_part(m[1], '-', 1), m[1]
FROM public.audit_logs a CROSS JOIN LATERAL regexp_matches(a.metadata::text, '((?:FAM|STU|RCPT)-[0-9]{4}-[0-9]+)', 'g') AS m
ON CONFLICT DO NOTHING;
INSERT INTO public.business_identifier_counters
SELECT split_part(value, '-', 1) || '-' || split_part(value, '-', 2), max(split_part(value, '-', 3)::integer)
FROM public.issued_business_identifiers WHERE value ~ '^(FAM|STU|RCPT)-[0-9]{4}-[0-9]+$'
GROUP BY 1;

CREATE FUNCTION public.allocate_business_identifier(identifier_kind text, identifier_year integer) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE next_value integer; counter_key text;
BEGIN
  IF identifier_kind NOT IN ('FAM', 'STU', 'RCPT') OR identifier_year NOT BETWEEN 2000 AND 9999 THEN
    RAISE EXCEPTION 'Invalid business identifier kind or year';
  END IF;
  counter_key := identifier_kind || '-' || identifier_year;
  INSERT INTO public.business_identifier_counters(key, value) VALUES(counter_key, 1)
  ON CONFLICT(key) DO UPDATE SET value = public.business_identifier_counters.value + 1
  RETURNING value INTO next_value;
  RETURN counter_key || '-' || lpad(next_value::text, greatest(6, length(next_value::text)), '0');
END $$;

CREATE FUNCTION public.retain_business_identifier() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE identifier text; previous_identifier text; record_owner uuid; existing_owner uuid; sequence_value integer;
BEGIN
  identifier := to_jsonb(NEW)->>TG_ARGV[1];
  IF identifier IS NULL THEN RETURN NEW; END IF;
  record_owner := CASE WHEN TG_TABLE_NAME = 'receipts' THEN (to_jsonb(NEW)->>'payment_id')::uuid ELSE NEW.id END;
  IF TG_OP = 'UPDATE' THEN
    previous_identifier := to_jsonb(OLD)->>TG_ARGV[1];
    IF previous_identifier IS NOT NULL AND previous_identifier <> identifier THEN
      RAISE EXCEPTION 'Issued business identifiers are immutable';
    END IF;
  END IF;
  INSERT INTO public.issued_business_identifiers(kind, value, owner_id)
  VALUES(TG_ARGV[0], identifier, record_owner) ON CONFLICT DO NOTHING;
  SELECT owner_id INTO existing_owner FROM public.issued_business_identifiers
    WHERE kind = TG_ARGV[0] AND value = identifier;
  IF existing_owner IS DISTINCT FROM record_owner THEN RAISE EXCEPTION 'Business identifier was already issued'; END IF;
  IF identifier ~ '^(FAM|STU|RCPT)-[0-9]{4}-[0-9]+$' THEN
    sequence_value := split_part(identifier, '-', 3)::integer;
    INSERT INTO public.business_identifier_counters(key, value)
    VALUES(split_part(identifier, '-', 1) || '-' || split_part(identifier, '-', 2), sequence_value)
    ON CONFLICT(key) DO UPDATE SET value = greatest(public.business_identifier_counters.value, EXCLUDED.value);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER retain_family_identifier BEFORE INSERT OR UPDATE OF family_code ON public.families FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('FAM', 'family_code');
CREATE TRIGGER retain_student_identifier BEFORE INSERT OR UPDATE OF student_code ON public.students FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('STU', 'student_code');
CREATE TRIGGER retain_payment_identifier BEFORE INSERT OR UPDATE OF receipt_number ON public.payments FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('RCPT', 'receipt_number');
CREATE TRIGGER retain_receipt_identifier BEFORE INSERT OR UPDATE OF receipt_number ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.retain_business_identifier('RCPT', 'receipt_number');

-- A writer that started before the reset must retry, rather than apply decisions
-- based on the old database after the reset releases its table locks.
CREATE FUNCTION public.guard_reset_generation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE reset_time timestamptz;
BEGIN
  SELECT changed_at INTO reset_time FROM public.production_reset_state WHERE id = 'school' FOR SHARE;
  IF reset_time >= transaction_timestamp() THEN
    RAISE EXCEPTION 'Data changed during production reset; reload and retry' USING ERRCODE = '40001';
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['families','students','seasons','teachers','courses','course_levels','course_pricings','teacher_courses','teacher_availability','enrollments','registration_attempts','schedule_sessions','schedule_patterns','school_closures','rooms','operational_settings','payments','payment_items','receipts','expenses','cashier_shifts','teacher_payrolls','teacher_payroll_items','business_identifier_counters','issued_business_identifiers'] LOOP
    EXECUTE format('CREATE TRIGGER reset_generation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.guard_reset_generation()', table_name);
  END LOOP;
END $$;

CREATE FUNCTION public.guard_reset_registration_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE submission uuid;
BEGIN
  submission := CASE WHEN TG_TABLE_NAME = 'enrollments' THEN (to_jsonb(NEW)->>'registration_submission_id')::uuid ELSE NEW.id END;
  IF EXISTS (SELECT 1 FROM public.reset_registration_submissions WHERE id = submission) THEN
    RAISE EXCEPTION 'This registration was reset; start a new registration';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reset_submission_guard BEFORE INSERT OR UPDATE OF registration_submission_id ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.guard_reset_registration_submission();
CREATE TRIGGER reset_submission_guard BEFORE INSERT ON public.registration_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_reset_registration_submission();

ALTER TABLE public.production_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_reset_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reset_registration_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_identifier_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issued_business_identifiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.allocate_business_identifier(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retain_business_identifier() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_reset_generation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_reset_registration_submission() FROM PUBLIC, anon, authenticated;

COMMIT;
