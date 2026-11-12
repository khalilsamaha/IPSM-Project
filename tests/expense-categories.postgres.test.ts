import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createFamilyWithCode } from "@/lib/families";
import { createStudentWithCode } from "@/lib/students";
import { createPaymentWithAllocations } from "@/lib/payments/payment-service";
import { randomUUID } from "node:crypto";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { manageExpenseCategory, requireExpenseActor, resolveExpenseCategory } from "@/lib/expense-categories";

const db = process.env.RESET_TEST_DATABASE_URL ? await createDisposableProductionResetTestClient() : null;
const actors = { SUPER_ADMIN: randomUUID(), ADMIN: randomUUID(), RECEPTION: randomUUID(), inactive: randomUUID(), archived: randomUUID() };
const migration = readFileSync("supabase/migrations/20261112000000_expense_categories.sql", "utf8");
function run(sql: string, success = true) {
  if (!db) throw new Error("Disposable fixture is required");
  const result = spawnSync("psql", [process.env.RESET_TEST_DATABASE_URL!, "-XqAt", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  if (success) expect(result.status, result.stderr).toBe(0);
  return result;
}
describe.skipIf(!db)("persisted expense categories on isolated PostgreSQL", () => {
  beforeAll(async () => {
    run("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    run("DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    for (const path of ["tests/migrations/reset-baseline.sql", "tests/migrations/reset-bootstrap.sql", "prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql", "supabase/migrations/20261107000000_teacher_guard_parity.sql", "supabase/migrations/20261107010000_reset_integrity.sql", "supabase/migrations/20261108000000_ipsm_identifiers.sql"]) run(readFileSync(path, "utf8"));
    // Match the production creator's broad defaults, including inherited access.
    run("DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$; DO $$ BEGIN CREATE ROLE category_client_parent; EXCEPTION WHEN duplicate_object THEN NULL; END $$; GRANT category_client_parent TO anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC, anon, authenticated, service_role, category_client_parent;");
    run(migration);
    for (const [role, authId] of Object.entries(actors)) await db!.userProfile.create({ data: { authId, name: `Synthetic ${role}`, email: `${role.toLowerCase()}@category.test`, role: role === "inactive" || role === "archived" ? "ADMIN" : role as "ADMIN" | "SUPER_ADMIN" | "RECEPTION", status: role === "inactive" ? "INACTIVE" : "ACTIVE", archivedAt: role === "archived" ? new Date() : null } });
  }, 60000);
  afterAll(async () => { await db?.$disconnect(); });
  it("seeds exactly the requested defaults and no payroll category", async () => {
    expect((await db!.expenseCategory.findMany()).map(row => row.name).sort()).toEqual(["Rent", "Electricity", "Cellphone", "Ogero / Internet", "Water", "Maintenance", "Office Supplies", "Other"].sort());
  });
  it.each(["SUPER_ADMIN", "ADMIN"] as const)("lets active %s create, rename, archive and restore with audits", async role => {
    const row = await manageExpenseCategory(db!, actors[role], { action: "create", name: `  Supplies ${role}  ` });
    await manageExpenseCategory(db!, actors[role], { action: "rename", id: row.id, name: `Renamed ${role}` });
    await manageExpenseCategory(db!, actors[role], { action: "archive", id: row.id });
    await expect(db!.$transaction(tx => resolveExpenseCategory(tx, row.id))).rejects.toThrow(/no longer available/);
    await manageExpenseCategory(db!, actors[role], { action: "restore", id: row.id });
    expect(await db!.$transaction(tx => resolveExpenseCategory(tx, row.id))).toBe(`Renamed ${role}`);
    const logs = await db!.auditLog.findMany({ where: { entity: "ExpenseCategory", entityId: row.id } });
    expect(logs).toHaveLength(4);
    expect(logs.find(log => log.action === "rename")?.metadata).toMatchObject({ before: { name: `Supplies ${role}` }, after: { name: `Renamed ${role}` } });
  });
  it.each(["RECEPTION", "inactive", "archived", "unknown"])("rejects every management action from %s", async role => {
    const row = await db!.expenseCategory.findFirstOrThrow({ where: { name: "Rent" } });
    for (const command of [{ action: "create", name: "Forbidden" }, { action: "rename", id: row.id, name: "Forbidden" }, { action: "archive", id: row.id }, { action: "restore", id: row.id }]) {
      await expect(manageExpenseCategory(db!, actors[role as keyof typeof actors] ?? randomUUID(), command)).rejects.toThrow(/permission/);
    }
    expect(await db!.expenseCategory.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ name: "Rent", archivedAt: null });
  });
  it("lets Reception choose available categories and retain historical values only on existing expenses", async () => {
    const rent = await db!.expenseCategory.findFirstOrThrow({ where: { name: "Rent" } });
    await db!.$transaction(async tx => {
      await requireExpenseActor(tx, actors.RECEPTION);
      expect(await resolveExpenseCategory(tx, rent.id)).toBe("Rent");
      expect(await resolveExpenseCategory(tx, "historical", { category: "Legacy supplies label" })).toBe("Legacy supplies label");
      await expect(resolveExpenseCategory(tx, "historical")).rejects.toThrow(/Select/);
      await expect(resolveExpenseCategory(tx, "Rent")).rejects.toThrow(/Select/);
    });
  });
  it("leaves historical expense values and amounts intact on rename/archive", async () => {
    const row = await manageExpenseCategory(db!, actors.ADMIN, { action: "create", name: "Past label" });
    const expense = await db!.expense.create({ data: { category: "Past label", description: "Synthetic historical expense", amountCents: 1250 } });
    await manageExpenseCategory(db!, actors.ADMIN, { action: "rename", id: row.id, name: "New label" });
    await manageExpenseCategory(db!, actors.ADMIN, { action: "archive", id: row.id });
    expect(await db!.expense.findUniqueOrThrow({ where: { id: expense.id } })).toMatchObject({ category: "Past label", amountCents: 1250 });
  });
  it("serializes duplicate names including case and rejects reserved payroll/fallback edits", async () => {
    const attempts = await Promise.allSettled(["Concurrent", "concurrent"].map(name => manageExpenseCategory(db!, actors.ADMIN, { action: "create", name })));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const other = await db!.expenseCategory.findFirstOrThrow({ where: { name: "Other" } });
    for (const command of [{ action: "create", name: " teacher   payroll " }, { action: "rename", id: other.id, name: "Misc" }, { action: "archive", id: other.id }]) await expect(manageExpenseCategory(db!, actors.ADMIN, command)).rejects.toThrow();
  });
  it("rolls the catalogue change back if its audit insert fails", async () => {
    run("CREATE FUNCTION public.reject_category_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity='ExpenseCategory' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_category_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_category_audit();");
    try { await expect(manageExpenseCategory(db!, actors.ADMIN, { action: "create", name: "Must roll back" })).rejects.toThrow(); }
    finally { run("DROP TRIGGER reject_category_audit ON public.audit_logs; DROP FUNCTION public.reject_category_audit();"); }
    expect(await db!.expenseCategory.count({ where: { name: "Must roll back" } })).toBe(0);
  });
  it("denies all browser/service-role privileges even with broad inherited defaults and RLS bypass", () => {
    const privileges = Number(run("SHOW server_version_num;").stdout.trim()) >= 170000 ? ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"] : ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
    for (const role of ["anon", "authenticated", "service_role", "category_client_parent"]) for (const privilege of privileges) expect(run(`SELECT has_table_privilege('${role}','public.expense_categories','${privilege}');`).stdout.trim()).toBe("f");
    expect(run("SELECT relrowsecurity FROM pg_class WHERE oid='public.expense_categories'::regclass").stdout.trim()).toBe("t");
    expect(run("BEGIN; SET LOCAL ROLE service_role; SELECT * FROM public.expense_categories; ROLLBACK;", false).status).not.toBe(0);
  });
  it.each(["automatic", "manual"] as const)("preserves multi-student %s posting, receipt, audit and replay", async allocationMode => {
    const activation = randomUUID(), original = process.env.IPSM_IDENTIFIER_ACTIVATION_ID;
    run(`INSERT INTO public.business_identifier_activations(id,enabled,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES('${activation}',true,'${"b".repeat(64)}','${"b".repeat(64)}','Synthetic payment compatibility',0,now());`);
    process.env.IPSM_IDENTIFIER_ACTIVATION_ID = activation;
    try {
      const user = await db!.userProfile.findUniqueOrThrow({ where: { authId: actors.ADMIN } });
      const family = await createFamilyWithCode(db!, { name: "Synthetic multi-student family" });
      const season = await db!.season.create({ data: { name: randomUUID(), startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
      const enrollments = [];
      for (const firstName of ["Synthetic Lea", "Synthetic Sami"]) {
        const student = await createStudentWithCode(db!, { family: { connect: { id: family.id } }, firstName, lastName: "Fixture" });
        enrollments.push(await db!.enrollment.create({ data: { studentId: student.id, seasonId: season.id, courseName: "Piano", feeCents: 1000, finalFeeCents: 1000, remainingCents: 1000, enrollmentStartDate: season.startDate, enrollmentEndDate: season.endDate } }));
      }
      const shift = await db!.cashierShift.findFirst({ where: { userId: user.id, status: "OPEN" } }) ?? await db!.cashierShift.create({ data: { userId: user.id, businessDate: new Date(), openingCashCents: 0 } });
      const input = { requestId: randomUUID(), familyId: family.id, paymentDate: new Date(), paymentMethod: "cash", notes: null, createdById: user.id, actorId: user.authId, shiftId: shift.id, amountCents: 1500, allocationMode,
        allocations: allocationMode === "manual" ? enrollments.map(row => ({ enrollmentId: row.id, amountCents: 750 })) : [] };
      const first = await createPaymentWithAllocations(db!, input);
      expect((await createPaymentWithAllocations(db!, input)).id).toBe(first.id);
      expect(await db!.paymentItem.count({ where: { paymentId: first.id } })).toBe(2);
      expect(await db!.receipt.count({ where: { paymentId: first.id } })).toBe(1);
      expect(await db!.auditLog.count({ where: { entityId: first.id, action: "create", entity: "Payment" } })).toBe(1);
      const balances = await db!.enrollment.findMany({ where: { id: { in: enrollments.map(row => row.id) } } });
      expect(balances.reduce((sum, row) => sum + row.paidCents, 0)).toBe(1500);
      expect(balances.reduce((sum, row) => sum + row.remainingCents, 0)).toBe(500);
      await expect(createPaymentWithAllocations(db!, { ...input, paymentMethod: "whish" })).rejects.toThrow(/different details/);
    } finally { if (original === undefined) delete process.env.IPSM_IDENTIFIER_ACTIVATION_ID; else process.env.IPSM_IDENTIFIER_ACTIVATION_ID = original; }
  });
  it("rejects repeat application without altering catalogue data", async () => {
    const before = await db!.expenseCategory.count();
    expect(run(migration, false).status).not.toBe(0);
    expect(await db!.expenseCategory.count()).toBe(before);
  });
});
