import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";

const url = process.env.RESET_TEST_DATABASE_URL;
const db = url ? await createDisposableProductionResetTestClient() : null;
const directory = path.resolve("docs/sql/production-reset-dashboard");
// Query20 requires the final namespace delta; its absent-schema and installed
// read-only paths are both asserted in ipsm-identifiers.postgres.test.ts.
const files = readdirSync(directory).filter(name => name.endsWith(".sql") && name !== "20_identifier_activation.sql").sort();
const sentinel = "IPSM_PREFLIGHT_REDACTION_SENTINEL";
let inspector: string;
let installed: boolean;
type Report = { query_id: string; completed: boolean; read_only: string; isolation: string; status: string; item_count: number; items: Array<{ section: string; status: string; details: Record<string, any> }> };

function sql(number: string, fillRoles = true) {
  let text = readFileSync(path.join(directory, files.find(file => file.startsWith(number))!), "utf8");
  if (fillRoles) text = text.replaceAll("REPLACE_APP_ROLE", inspector.replaceAll("'", "''")).replaceAll("REPLACE_MIGRATION_ROLE", inspector.replaceAll("'", "''"));
  return text;
}
function run(text: string) {
  // This client exists only after verifying the disposable runner's actual server.
  if (!db) throw new Error("Disposable fixture required");
  return spawnSync("psql", [url!, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"], { input: text, encoding: "utf8", timeout: 55_000, maxBuffer: 16 * 1024 * 1024 });
}
function report(number: string, text = sql(number)): Report {
  const result = run(text);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).not.toContain(sentinel);
  const value = JSON.parse(result.stdout.trim()) as Report;
  expect(value).toMatchObject({ query_id: number, completed: true, read_only: "on", isolation: "repeatable read" });
  expect(value.item_count).toBe(value.items.length);
  expect(value.items.length).toBeGreaterThan(0);
  return value;
}

describe.skipIf(!url)("SQL Editor preflight on the owned PostgreSQL fixture", () => {
  beforeAll(async () => {
    [{ name: inspector }] = await db!.$queryRaw<Array<{ name: string }>>`SELECT current_user AS name`;
    [{ present: installed }] = await db!.$queryRaw<Array<{ present: boolean }>>`SELECT to_regclass('public.issued_business_identifiers') IS NOT NULL AS present`;
    // Synthetic histories only: never inspect production credentials or history.
    const setup = run(`CREATE TABLE public._prisma_migrations(migration_name text,checksum text,started_at timestamptz,finished_at timestamptz,rolled_back_at timestamptz,applied_steps_count int,logs text);
      INSERT INTO public._prisma_migrations VALUES ('fixture','checksum',now(),now(),null,1,'${sentinel}');
      CREATE SCHEMA supabase_migrations;
      CREATE TABLE supabase_migrations.schema_migrations(version text,statements text[],name text);
      INSERT INTO supabase_migrations.schema_migrations VALUES ('fixture',ARRAY['${sentinel}'],'${sentinel}');
      CREATE ROLE ipsm_preflight_reader;
      GRANT USAGE ON SCHEMA public TO ipsm_preflight_reader;
      ALTER TABLE public.families ADD CONSTRAINT preflight_dashboard_probe CHECK (name<>'${sentinel}') NOT VALID;
      CREATE INDEX preflight_dashboard_probe_idx ON public.families ((name || '${sentinel}'));
      CREATE POLICY preflight_dashboard_probe ON public.families FOR SELECT USING (name<>'${sentinel}');
      CREATE FUNCTION public.preflight_dashboard_probe() RETURNS trigger LANGUAGE plpgsql
        SET app.preflight_secret='${sentinel}' AS $$ BEGIN PERFORM '${sentinel}'; RETURN NEW; END $$;
      CREATE TRIGGER preflight_dashboard_probe BEFORE INSERT ON public.families
        FOR EACH ROW EXECUTE FUNCTION public.preflight_dashboard_probe('${sentinel}');`);
    expect(setup.status, setup.stderr).toBe(0);
  });
  afterAll(async () => {
    const cleanup = run("DROP TRIGGER preflight_dashboard_probe ON public.families; DROP FUNCTION public.preflight_dashboard_probe(); DROP POLICY preflight_dashboard_probe ON public.families; DROP INDEX public.preflight_dashboard_probe_idx; ALTER TABLE public.families DROP CONSTRAINT preflight_dashboard_probe; DROP TABLE public._prisma_migrations; DROP SCHEMA supabase_migrations CASCADE; DROP OWNED BY ipsm_preflight_reader; DROP ROLE ipsm_preflight_reader;");
    expect(cleanup.status, cleanup.stderr).toBe(0);
    await db?.$disconnect();
  });
  it.each(files.filter(file => !file.startsWith("11")))("executes the entire %s and returns exactly one complete report", file => {
    const value = report(file.slice(0, 2));
    if (file.startsWith("10")) expect(value.items.find(item => item.section === "role_input")?.status).toBe("REVIEW_REQUIRED");
    if (file.startsWith("13") && installed) {
      expect(value.items.every(item => item.details.function_matches && item.details.trigger_matches)).toBe(true);
      writeFileSync("/tmp/ipsm-reviewed-teacher-guards.json", JSON.stringify(value, null, 2));
    }
  });
  it("limits Query 18 to the fourteen missing catalog flag/ownership items", () => {
    const value = report("18");
    expect(value.item_count).toBe(14);
    expect(value.items.filter(i => i.section === "column_type_and_ownership")).toHaveLength(9);
    if (installed) expect(value.items.every(i => i.status === "MATCH")).toBe(true);
    expect(report("18", "SET search_path = pg_catalog;\n" + sql("18")).items).toEqual(value.items);
  });
  it("reproduces all three administrator constraint hashes using Query 02 pretty rendering", () => {
    if (!installed) return;
    const evidence = JSON.parse(readFileSync("docs/evidence/production-reset-teacher-schema-query02.json", "utf8"));
    const actual = report("02");
    for (const row of evidence.items.filter((i: any) => i.section === "constraint")) {
      const match = actual.items.find(i => i.section === "constraint" && i.details.name === row.details.name);
      expect(match?.details).toMatchObject(row.details);
    }
    const result = run("BEGIN READ ONLY; SET LOCAL search_path=pg_catalog,public; SELECT pg_get_constraintdef(oid),md5(pg_get_constraintdef(oid)),md5(pg_get_constraintdef(oid,true)) FROM pg_constraint WHERE conname='teachers_rates_nonnegative'; ROLLBACK;");
    expect(result.status, result.stderr).toBe(0);
    const [definition, ordinary, pretty] = result.stdout.trim().split("|");
    const reference = JSON.parse(readFileSync("docs/evidence/production-reset-guard-equivalence.json", "utf8"));
    expect(definition).toBe(reference.non_function_reference.constraints.find((c: any) => c.conname === "teachers_rates_nonnegative").definition);
    expect(pretty).toBe("a0ba59ce816f85d082988fd91153f0a7");
    expect(ordinary).not.toBe(pretty);
  });
  // Mutations below exist ONLY inside a rolled-back disposable-fixture transaction.
  // Normal report runs above execute the actual files in READ ONLY mode.
  function mutatedReport(number: string, mutation: string) {
    const result = run(sql(number).replace(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;",
      `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ; ${mutation}`));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain(sentinel);
    return JSON.parse(result.stdout.trim()) as Report;
  }
  it("reports missing scoped schema objects explicitly, never as successful parity", () => {
    const value = mutatedReport("18", "ALTER TABLE public.teacher_payroll_items RENAME TO hidden_parity_items;");
    const missing = value.items.filter(i => i.details.table_name === "teacher_payroll_items");
    expect(missing).toHaveLength(2);
    expect(missing.every(i => i.status === "BLOCKER" && i.details.present === false)).toBe(true);
  });
  it("detects an unexpected type identity and constraint inheritance without leaking expressions", () => {
    if (!installed) return;
    const value = mutatedReport("18", `ALTER TABLE public.teacher_payroll_items ALTER COLUMN rate_unit_minutes_snapshot TYPE bigint;
      ALTER TABLE public.teachers DROP CONSTRAINT teachers_rates_nonnegative;
      ALTER TABLE public.teachers ADD CONSTRAINT teachers_rates_nonnegative CHECK ('${sentinel}' <> '') NO INHERIT;`);
    expect(value.items.find(i => i.details.column_name === "rate_unit_minutes_snapshot" && i.details.table_name === "teacher_payroll_items")?.status).toBe("BLOCKER");
    expect(value.items.find(i => i.details.constraint_name === "teachers_rates_nonnegative")?.details.inheritance_matches).toBe(false);
  });
  it("detects the unreported NULLS NOT DISTINCT index flag", () => {
    if (!installed) return;
    const value = mutatedReport("18", "DROP INDEX public.teacher_courses_teacher_course_all_levels_key; CREATE UNIQUE INDEX teacher_courses_teacher_course_all_levels_key ON public.teacher_courses(teacher_id,course_id) NULLS NOT DISTINCT WHERE level_id IS NULL;");
    expect(value.items.find(i => i.details.index_name === "teacher_courses_teacher_course_all_levels_key")?.status).toBe("BLOCKER");
  });
  it("reports metadata and ACLs without claiming Dashboard proved runtime identity", () => {
    const value = report("19");
    expect(value.item_count).toBe(4);
    expect(value.items.find(i => i.section === "role_input")?.details.runtime_identity_proven_by_this_query).toBe(false);
    expect(report("19", sql("19", false)).status).toBe("BLOCKER");
    const missingClient = report("19", sql("19").replace("('service_role')", "('ipsm_missing_preflight_client')"));
    expect(missingClient.items.filter(i => i.section === "guard_metadata").every(i => i.status === "BLOCKER" && i.details.client_roles_present === false)).toBe(true);
    if (installed) {
      expect(value.status).toBe("REVIEW_REQUIRED");
      expect(value.items.filter(i => i.section === "guard_metadata").every(i => i.details.attributes_match && i.details.trigger_matches && i.details.no_overloads && i.details.owner_matches_selected_migration_role)).toBe(true);
    }
  });
  it("blocks new overloads and configuration drift without disclosing configuration values", () => {
    if (!installed) return;
    const value = mutatedReport("19", `CREATE FUNCTION public.validate_schedule_teacher_availability(integer) RETURNS integer LANGUAGE sql AS 'SELECT 1';
      ALTER FUNCTION public.validate_enrollment_teacher_availability() SET app.private_value='${sentinel}';`);
    expect(value.items.find(i => i.details.function_name === "validate_schedule_teacher_availability")?.details.no_overloads).toBe(false);
    expect(value.items.find(i => i.details.function_name === "validate_enrollment_teacher_availability")?.details.configuration_matches).toBe(false);
    expect(value.status).toBe("BLOCKER");
  });
  it("blocks differing guard ownership and trigger properties", () => {
    if (!installed) return;
    const value = mutatedReport("19", "ALTER FUNCTION public.validate_schedule_teacher_availability() OWNER TO ipsm_preflight_reader; ALTER TABLE public.enrollments DISABLE TRIGGER enrollment_teacher_availability_guard;");
    expect(value.items.find(i => i.details.function_name === "validate_schedule_teacher_availability")?.details.owner_matches_selected_migration_role).toBe(false);
    expect(value.items.find(i => i.details.function_name === "validate_enrollment_teacher_availability")?.details.trigger_matches).toBe(false);
    expect(value.status).toBe("BLOCKER");
  });
  it("shows inherited existing guard EXECUTE as a review item without changing ACLs", () => {
    if (!installed) return;
    const value = mutatedReport("19", "GRANT EXECUTE ON FUNCTION public.validate_schedule_teacher_availability() TO ipsm_preflight_reader; GRANT ipsm_preflight_reader TO anon;");
    const guard = value.items.find(i => i.details.function_name === "validate_schedule_teacher_availability")!;
    expect(guard.details.acl.some((a: any) => a.grantee === "ipsm_preflight_reader" && a.privilege === "EXECUTE")).toBe(true);
    expect(guard.details.client_execute_review.find((r: any) => r.role === "anon").effective_execute).toBe(true);
    expect(guard.status).toBe("REVIEW_REQUIRED");
  });
  it("reports proposed-object absence or existing-installation collisions explicitly", () => {
    const items = report("01").items.filter(item => item.section === "proposed_object");
    expect(items).toHaveLength(5);
    expect(items.every(item => item.status === (installed ? "BLOCKER" : "EXPECTED_ABSENT_BEFORE_PR90"))).toBe(true);
  });
  it("refuses to replace an existing teacher guard with an unreviewed body", () => {
    if (installed) return;
    const create = run("CREATE FUNCTION public.validate_schedule_teacher_availability() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RETURN NEW; END $$;");
    expect(create.status, create.stderr).toBe(0);
    try {
      const result = run(readFileSync("prisma/migrations/20261107000000_teacher_guard_parity/migration.sql", "utf8"));
      expect(result.status).toBe(3);
      expect(result.stderr).toContain("Teacher guard differs from reviewed parity migration");
      const unchanged = run("SELECT prosrc FROM pg_proc WHERE oid='public.validate_schedule_teacher_availability()'::regprocedure;");
      expect(unchanged.stdout.trim()).toBe("BEGIN RETURN NEW; END");
      expect(report("13").items.find(item => item.details.function_name === "validate_schedule_teacher_availability")?.status).toBe("BLOCKER");
    } finally { expect(run("DROP FUNCTION public.validate_schedule_teacher_availability();").status).toBe(0); }
  });
  it("refuses to overwrite a changed existing teacher trigger", () => {
    if (!installed) return;
    expect(run("ALTER TABLE public.teacher_availability DISABLE TRIGGER teacher_availability_scope_guard;").status).toBe(0);
    try {
      const result = run(readFileSync("prisma/migrations/20261107000000_teacher_guard_parity/migration.sql", "utf8"));
      expect(result.status).toBe(3);
      expect(result.stderr).toContain("Teacher guard trigger differs from reviewed parity migration");
      expect(report("13").items.find(item => item.details.function_name === "validate_teacher_availability_scope")?.details.tgenabled).toBe("D");
    } finally { expect(run("ALTER TABLE public.teacher_availability ENABLE TRIGGER teacher_availability_scope_guard;").status).toBe(0); }
  });
  it("distinguishes three unresolved historical pairs from an existing inconsistent financial posting", async () => {
    const auditIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const missingPayrolls = [randomUUID(), randomUUID(), randomUUID()];
    const teacher = await db!.teacher.create({ data: { fullName: "Reconciliation fixture" } });
    const payroll = await db!.teacherPayroll.create({ data: { teacherId: teacher.id, periodStart: new Date("2096-01-01"), periodEnd: new Date("2096-01-31"), hourlyRateSnapshotCents: 1000, grossAmountCents: 500, status: "PAID" } });
    const expenseId = randomUUID();
    try {
      for (let i = 0; i < 3; i++) await db!.auditLog.create({ data: { id: auditIds[i], entity: "TeacherPayroll", action: "mark_paid", entityId: missingPayrolls[i], metadata: i === 0 ? {} : { expenseId: i === 1 ? "invalid" : randomUUID() } } });
      const historical = report("14").items.find(item => item.section === "summary")!;
      expect(historical.details).toMatchObject({ invalid_audit_expense_references: 2, missing_or_inconsistent_posting_links: 3, both_absent_events: 3, live_financial_issue_events: 0 });
      await db!.$executeRaw`INSERT INTO public.expenses(id,category,description,amount_cents,payment_method) VALUES(${expenseId}::uuid,'Teacher Payroll','Reconciliation fixture',400,'cash')`;
      await db!.auditLog.create({ data: { id: auditIds[3], entity: "TeacherPayroll", action: "mark_paid", entityId: payroll.id, metadata: { expenseId, privateData: sentinel } } });
      const live = report("14");
      expect(live.items.find(item => item.section === "summary")?.details.live_financial_issue_events).toBe(1);
      expect(live.items.find(item => item.details.classification === "LIVE_POSTING_MISMATCH")?.details.amount_mismatch).toBe(true);
      expect(JSON.stringify(live)).not.toContain(payroll.id);
      expect(JSON.stringify(live)).not.toContain(expenseId);
      await db!.$executeRaw`UPDATE public.expenses SET amount_cents=500 WHERE id=${expenseId}::uuid`;
      await db!.auditLog.create({ data: { id: auditIds[4], entity: "TeacherPayroll", action: "mark_paid", entityId: payroll.id, metadata: {} } });
      const reconciled = report("14");
      expect(reconciled.items.find(item => item.section === "summary")?.details).toMatchObject({ live_financial_issue_events: 0, old_references_with_current_posting: 1 });
      expect(reconciled.items.find(item => item.details.classification === "UNRESOLVED_OLD_REFERENCE_WITH_CURRENT_POSTING")?.status).toBe("REVIEW_REQUIRED");
    } finally {
      await db!.auditLog.deleteMany({ where: { id: { in: auditIds } } });
      await db!.$executeRaw`DELETE FROM public.expenses WHERE id=${expenseId}::uuid`;
      await db!.teacherPayroll.delete({ where: { id: payroll.id } });
      await db!.teacher.delete({ where: { id: teacher.id } });
    }
  });
  it("reports all four source populations even when identifier tables are empty", () => {
    const sources = report("15").items.filter(item => item.section === "current_source_population");
    expect(sources).toHaveLength(4);
    expect(sources.every(item => item.details.total_rows === 0 && item.details.currently_empty === true)).toBe(true);
  });
  it("reports denied table/function privileges for all three clients after migration", () => {
    const value = report("17");
    const tables = value.items.filter(item => item.section === "effective_table_permissions" && ["anon", "authenticated", "service_role"].includes(String(item.details.role)));
    expect(tables).toHaveLength(15);
    if (!installed) {
      expect(tables.every(item => item.status === "EXPECTED_ABSENT_BEFORE_PR90")).toBe(true);
      return;
    }
    expect(tables.every(item => item.status === "REVIEW_REQUIRED" && item.details.truncate === false && item.details.select === false && item.details.maintain !== true)).toBe(true);
    const functions = value.items.filter(item => item.section === "effective_function_permissions" && ["anon", "authenticated", "service_role"].includes(String(item.details.role)));
    expect(functions).toHaveLength(12);
    expect(functions.every(item => item.details.execute === false)).toBe(true);
  });
  it("checks existing reset objects only when present; missing objects cannot produce a success report", () => {
    if (installed) { report("11"); return; }
    const result = run(sql("11"));
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("42P01");
    expect(result.stderr).toContain("business_identifier_counters");
    expect(result.stdout).not.toContain('"completed": true');
  });
  it("treats unresolved roles as a blocker instead of assuming the inspector is the runtime role", () => {
    const value = report("10", sql("10", false));
    expect(value.status).toBe("BLOCKER");
    expect(value.items.find(item => item.section === "role_input")?.status).toBe("BLOCKER");
  });
  it("reports missing history and positively verifies the failing history query", () => {
    expect(run("ALTER TABLE public._prisma_migrations RENAME TO _preflight_hidden_history;").status).toBe(0);
    try {
      expect(report("01").items.find(item => item.details.table === "public._prisma_migrations")?.status).toBe("BLOCKER");
      const result = run(sql("04"));
      expect(result.status).toBe(3); expect(result.stderr).toContain("42P01");
      expect(result.stdout).not.toContain('"completed": true');
    } finally { expect(run("ALTER TABLE public._preflight_hidden_history RENAME TO _prisma_migrations;").status).toBe(0); }
  });
  it("reports a missing core table as a blocker", () => {
    expect(run("ALTER TABLE public.rooms RENAME TO _preflight_hidden_rooms;").status).toBe(0);
    try {
      expect(report("01").items.find(item => item.details.table === "rooms")?.status).toBe("BLOCKER");
    } finally { expect(run("ALTER TABLE public._preflight_hidden_rooms RENAME TO rooms;").status).toBe(0); }
  });
  it("does not turn permission errors, RLS filtering or unsupported SQL into clean reports", () => {
    let result = run("SET ROLE ipsm_preflight_reader;\n" + sql("07"));
    expect(result.status).toBe(3); expect(result.stderr).toContain("42501");
    expect(result.stdout).not.toContain('"completed": true');
    expect(run("GRANT SELECT ON ALL TABLES IN SCHEMA public TO ipsm_preflight_reader; ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;").status).toBe(0);
    try {
      result = run("SET ROLE ipsm_preflight_reader;\n" + sql("09"));
      expect(result.status).toBe(3); expect(result.stderr).toContain("42501");
      expect(result.stderr).toContain("row-level security policy");
      expect(result.stdout).not.toContain('"completed": true');
    } finally { expect(run("ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;").status).toBe(0); }
    result = run(sql("08").replace("greatest(0,", "pg_catalog.ipsm_nonexistent_function(0,"));
    expect(result.status).toBe(3); expect(result.stderr).toContain("42883");
    expect(result.stdout).not.toContain('"completed": true');
    result = run(sql("08").replace("'45s'", "'1ms'").replace("SELECT preflight_report FROM report;", "SELECT preflight_report FROM report, pg_catalog.pg_sleep(0.1);"));
    expect(result.status).toBe(3); expect(result.stderr).toContain("57014");
    expect(result.stdout).not.toContain('"completed": true');
  });
  it("detects duplicate registration references and conflicting receipt owners on the legacy fixture", async () => {
    // After the existing migrations, database guards already forbid this fixture.
    if (installed) return;
    const family = await db!.family.create({ data: { familyCode: "FAM-2097-000001", name: "Private fixture name" } });
    try {
      const student = await db!.student.create({ data: { familyId: family.id, studentCode: "STU-2097-000001", firstName: "Private", lastName: "Fixture" } });
      const payment = await db!.payment.create({ data: { familyId: family.id, paymentMethod: "cash", totalAmountCents: 100, receiptNumber: "RCPT-2097-000001" } });
      const other = await db!.payment.create({ data: { familyId: family.id, paymentMethod: "cash", totalAmountCents: 100, receiptNumber: "RCPT-2097-000002" } });
      await db!.receipt.create({ data: { paymentId: other.id, receiptNumber: payment.receiptNumber! } });
      for (let i = 0; i < 2; i++) await db!.registrationAttempt.create({ data: { id: randomUUID(), familyId: family.id, primaryStudentId: student.id, paymentId: payment.id } });
      const registrations = report("06");
      expect(registrations.items.find(item => item.section === "duplicate_registration_payment_groups")?.details.affected).toBe(1);
      const receipts = report("08");
      expect(receipts.items.find(item => item.section === "receipt_numbers_with_multiple_payment_owners")?.details.affected).toBe(1);
      expect(receipts.items.find(item => item.section === "receipt_payment_number_mismatches")?.details.affected).toBe(1);
      expect(JSON.stringify([registrations, receipts])).not.toMatch(/Private|RCPT-2097|FAM-2097|STU-2097/);
    } finally {
      await db!.registrationAttempt.deleteMany({ where: { familyId: family.id } });
      await db!.receipt.deleteMany({ where: { payment: { familyId: family.id } } });
      await db!.payment.deleteMany({ where: { familyId: family.id } });
      await db!.student.deleteMany({ where: { familyId: family.id } });
      await db!.family.delete({ where: { id: family.id } });
    }
  });
  it("aggregates synthetic financial findings and historical identifiers without disclosing payloads", async () => {
    const id = randomUUID();
    await db!.auditLog.create({ data: { id, entity: "TeacherPayroll", entityId: randomUUID(), action: "mark_paid", metadata: { expenseId: "invalid", privateData: sentinel, code: "RCPT-2098-123456" } } });
    try {
      expect(report("07").items.find(item => item.section === "invalid_audit_expense_references")?.details.affected).toBe(1);
      expect(report("09").items.find(item => item.details.kind === "RCPT" && item.details.year === "2098")?.details.recovered_high_water).toBe(123456);
      expect(report("04").items.find(item => item.section === "prisma_migration")?.details.has_logs).toBe(true);
      report("05");
    } finally { await db!.auditLog.delete({ where: { id } }); }
  });
});
