-- Run only after reset-baseline.sql and corrective migrations, on disposable PostgreSQL.
BEGIN;
INSERT INTO public.users(id,auth_id,name,email,role,status,updated_at) VALUES('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Test owner','reset-test@example.invalid','SUPER_ADMIN','ACTIVE',now());
INSERT INTO public.families(id,family_code,name,updated_at) VALUES('20000000-0000-4000-8000-000000000001','FAM-2026-000040','Fixture',now());
INSERT INTO public.students(id,family_id,student_code,first_name,last_name,updated_at) VALUES('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','STU-2026-000090','Test','Student',now());
INSERT INTO public.seasons(id,name,start_date,end_date,updated_at) VALUES('40000000-0000-4000-8000-000000000001','Fixture','2026-01-01','2026-12-31',now());
INSERT INTO public.enrollments(id,student_id,season_id,course_name,fee_cents,discount_cents,final_fee_cents,paid_cents,remaining_cents,enrollment_start_date,enrollment_end_date,updated_at) VALUES('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Fixture',12000,2000,10000,4000,6000,'2026-01-01','2026-12-31',now());
INSERT INTO public.registration_attempts(id,family_id,primary_student_id,enrollment_id,updated_at) VALUES('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now());
DO $$ BEGIN
  BEGIN
    INSERT INTO public.registration_attempts(id,family_id,primary_student_id,enrollment_id,updated_at) VALUES(gen_random_uuid(),'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',now());
    RAISE EXCEPTION 'Duplicate registration enrollment unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
DELETE FROM public.registration_attempts;
DELETE FROM public.enrollments;
DELETE FROM public.students;
DELETE FROM public.families;
DO $$ DECLARE code text; BEGIN
  code := public.allocate_business_identifier('FAM',2026);
  IF code <> 'FAM-2026-000041' THEN RAISE EXCEPTION 'Family counter was reused: %',code; END IF;
  code := public.allocate_business_identifier('STU',2026);
  IF code <> 'STU-2026-000091' THEN RAISE EXCEPTION 'Student counter was reused: %',code; END IF;
  BEGIN
    INSERT INTO public.families(id,family_code,name,updated_at) VALUES(gen_random_uuid(),'FAM-2026-000040','Reused',now());
    RAISE EXCEPTION 'FAIL: reused family code accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Business identifier was already issued' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email='reset-test@example.invalid') THEN RAISE EXCEPTION 'User unexpectedly removed'; END IF;
END $$;
INSERT INTO public.reset_registration_submissions(id) VALUES('60000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.registration_attempts(id,family_id,primary_student_id,updated_at) VALUES('60000000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),now());
    RAISE EXCEPTION 'FAIL: reset submission replayed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This registration was reset; start a new registration' THEN RAISE; END IF;
  END;
END $$;
-- Simulate the reset barrier; an older transaction cannot continue writing.
UPDATE public.production_reset_state SET changed_at=clock_timestamp() WHERE id='school';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.families(id,family_code,name,updated_at) VALUES(gen_random_uuid(),'FAM-2026-001000','Stale writer',now());
    RAISE EXCEPTION 'Stale writer was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
ROLLBACK;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE email='reset-test@example.invalid') THEN RAISE EXCEPTION 'Fixture rollback failed'; END IF;
END $$;
SELECT 'reset-integrity-sql-ok';
