import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";

const url = process.env.RESET_TEST_DATABASE_URL;
const db = url ? await createDisposableProductionResetTestClient() : null;
const directory = path.resolve("docs/sql/production-reset-dashboard");
const files = readdirSync(directory).filter(name => name.endsWith(".sql")).sort();
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
  it.each(files.slice(0, 10))("executes the entire %s and returns exactly one complete report", file => {
    const value = report(file.slice(0, 2));
    if (file.startsWith("10")) expect(value.items.find(item => item.section === "role_input")?.status).toBe("REVIEW_REQUIRED");
  });
  it("reports proposed-object absence or existing-installation collisions explicitly", () => {
    const items = report("01").items.filter(item => item.section === "proposed_object");
    expect(items).toHaveLength(5);
    expect(items.every(item => item.status === (installed ? "BLOCKER" : "EXPECTED_ABSENT_BEFORE_PR90"))).toBe(true);
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
