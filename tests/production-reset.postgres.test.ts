import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { previewProductionReset, executeProductionReset, emptyProductionResetSelection, RESET_CONFIRMATION, resetTables } from "@/lib/production-reset";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { allocateBusinessIdentifier } from "@/lib/business-identifiers";
import { ensurePaymentReceipt } from "@/lib/payments/receipt-repair";

const url = process.env.RESET_TEST_DATABASE_URL;
// Never construct a client from ambient application configuration. The factory
// verifies the runner's URL, actual server identity and per-cluster marker first.
const db = url ? await createDisposableProductionResetTestClient() : null;
const actor = randomUUID();
let userId: string;
const selection = (value: Partial<typeof emptyProductionResetSelection>) => ({ ...emptyProductionResetSelection, ...value });
const run = (requestId: string) => executeProductionReset(db!, { actorId: actor, requestId, confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true });

async function enrollmentFixture() {
  const family = await db!.family.create({ data: { familyCode: await allocateBusinessIdentifier(db!, "FAM"), name: "Reset fixture" } });
  const student = await db!.student.create({ data: { familyId: family.id, studentCode: await allocateBusinessIdentifier(db!, "STU"), firstName: "Test", lastName: "Student" } });
  const season = await db!.season.create({ data: { name: randomUUID(), startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
  const enrollment = await db!.enrollment.create({ data: { studentId: student.id, seasonId: season.id, courseName: "Piano", feeCents: 12000, discountCents: 2000, finalFeeCents: 10000, paidCents: 6000, remainingCents: 4000, enrollmentStartDate: season.startDate, enrollmentEndDate: season.endDate, registrationSubmissionId: randomUUID() } });
  const shift = await db!.cashierShift.create({ data: { userId, businessDate: new Date("2026-01-05"), openingCashCents: 1000, status: "AUTO_CLOSED", expectedCashCents: 3000, closingSnapshot: { cash: 3000, whish: 4000 } } });
  for (const [method, amount, voided] of [["cash",2000,false],["whish",4000,false],["cash",500,true]] as const) {
    const receiptNumber = await allocateBusinessIdentifier(db!, "RCPT");
    const payment = await db!.payment.create({ data: { familyId: family.id, shiftId: shift.id, paymentMethod: method, totalAmountCents: amount, receiptNumber, voidedAt: voided ? new Date() : null, items: { create: { enrollmentId: enrollment.id, amountCents: amount } } } });
    await db!.receipt.create({ data: { paymentId: payment.id, receiptNumber } });
  }
  const payment = await db!.payment.findFirstOrThrow();
  await db!.registrationAttempt.create({ data: { id: enrollment.registrationSubmissionId!, status: "COMPLETED", familyId: family.id, primaryStudentId: student.id, enrollmentId: enrollment.id, paymentId: payment.id } });
  return { family, student, season, enrollment, shift, payment };
}

describe.skipIf(!url)("production reset against disposable PostgreSQL", () => {
  beforeAll(async () => { userId = (await db!.userProfile.create({ data: { authId: actor, name: "Test owner", email: "reset-owner@example.invalid", role: "SUPER_ADMIN" } })).id; });
  afterAll(async () => { await db?.$disconnect(); });
  beforeEach(async () => {
    // Fixture cleanup, not the application reset action. Identifier ledgers persist.
    for (const table of Object.values(resetTables)) await db!.$executeRawUnsafe(`DELETE FROM public."${table}"`);
    await db!.productionResetRequest.deleteMany();
  });
  it("rejects a loopback database without the runner's matching cluster marker", async () => {
    vi.stubEnv("IPSM_DISPOSABLE_TEST_TOKEN", "0".repeat(64));
    try {
      await expect(createDisposableProductionResetTestClient()).rejects.toThrow("identity could not be verified");
      await expect(previewProductionReset(db!, actor, selection({ financialData: true }))).rejects.toMatchObject({ code: "environment" });
      await expect(run(randomUUID())).rejects.toMatchObject({ code: "environment" });
    } finally { vi.unstubAllEnvs(); }
  });
  it("deletes mixed/voided allocations and closed-shift history only with explicit financial approval", async () => {
    const f = await enrollmentFixture();
    const blocked = await previewProductionReset(db!, actor, selection({ studentsFamilies: true }));
    await expect(run(blocked.id)).rejects.toMatchObject({ code: "blocked" });
    expect((await db!.cashierShift.findUniqueOrThrow({ where: { id: f.shift.id } })).closingSnapshot).toEqual({ cash: 3000, whish: 4000 });
    const p = await previewProductionReset(db!, actor, selection({ financialData: true }));
    expect(p.preview.financial).toMatchObject({ cashPaymentsCents: 2000, whishPaymentsCents: 4000, closedShifts: 1 });
    const result = await run(p.id);
    expect(result.deleted).toMatchObject({ payment: 3, receipt: 3, paymentItem: 3, cashierShift: 1 });
    expect(await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).toMatchObject({ feeCents: 12000, discountCents: 2000, finalFeeCents: 10000, paidCents: 0, remainingCents: 10000 });
    expect(await db!.registrationAttempt.findUniqueOrThrow({ where: { id: f.enrollment.registrationSubmissionId! } })).toMatchObject({ paymentId: null, status: "COMPLETED" });
    expect(await db!.userProfile.count()).toBe(1);
    expect(await db!.auditLog.count({ where: { action: "production_reset" } })).toBeGreaterThan(0);
  });
  it("rolls back deletion, balance changes and preview consumption when audit insertion fails", async () => {
    const f = await enrollmentFixture();
    await db!.$executeRawUnsafe("CREATE FUNCTION public.test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$");
    await db!.$executeRawUnsafe("CREATE TRIGGER test_audit_failure BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.test_audit_failure()");
    try {
      const p = await previewProductionReset(db!, actor, selection({ financialData: true }));
      await expect(run(p.id)).rejects.toThrow();
      expect(await db!.payment.count()).toBe(3); expect(await db!.cashierShift.count()).toBe(1);
      expect((await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).paidCents).toBe(6000);
      expect((await db!.productionResetRequest.findUniqueOrThrow({ where: { id: p.id } })).consumedAt).toBeNull();
    } finally {
      await db!.$executeRawUnsafe("DROP TRIGGER test_audit_failure ON public.audit_logs");
      await db!.$executeRawUnsafe("DROP FUNCTION public.test_audit_failure()");
    }
  });
  it.each([0, 4000, 10000])("restores a retained enrollment with %i cents paid", async paidCents => {
    const f = await enrollmentFixture();
    await db!.enrollment.update({ where: { id: f.enrollment.id }, data: { paidCents, remainingCents: 10000 - paidCents } });
    const p = await previewProductionReset(db!, actor, selection({ financialData: true }));
    await run(p.id);
    expect(await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).toMatchObject({ feeCents: 12000, discountCents: 2000, finalFeeCents: 10000, paidCents: 0, remainingCents: 10000 });
  });
  it("preserves a fully discounted charge using the application's zero-floor calculation", async () => {
    const f = await enrollmentFixture();
    await db!.enrollment.update({ where: { id: f.enrollment.id }, data: { discountCents: 15000, finalFeeCents: 0, paidCents: 0, remainingCents: 0 } });
    const p = await previewProductionReset(db!, actor, selection({ financialData: true }));
    expect(p.preview.blocked).toEqual([]);
    await run(p.id);
    expect(await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).toMatchObject({ feeCents: 12000, discountCents: 15000, finalFeeCents: 0, paidCents: 0, remainingCents: 0 });
  });
  it("serializes competing resets; only one reviewed request can commit", async () => {
    await enrollmentFixture();
    const p1 = await previewProductionReset(db!,actor,selection({ financialData: true }));
    const p2 = await previewProductionReset(db!,actor,selection({ financialData: true }));
    const results = await Promise.allSettled([run(p1.id),run(p2.id)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });
  it("previews one MVCC snapshot without blocking concurrent financial writes, then rejects that stale preview", async () => {
    const f = await enrollmentFixture();
    const cashPayment = await db!.payment.findFirstOrThrow({ where: { paymentMethod: "cash", voidedAt: null } });
    const scopes = selection({ financialData: true });
    const before = await previewProductionReset(db!, actor, scopes);
    let reached!: () => void;
    let resume!: () => void;
    const ready = new Promise<void>(resolve => { reached = resolve; });
    const go = new Promise<void>(resolve => { resume = resolve; });
    let paused = false;
    const transaction = db!.$transaction.bind(db!);
    vi.spyOn(db!, "$transaction").mockImplementationOnce(((callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) => transaction(tx => callback(new Proxy(tx, {
        get(target, key) {
          if (key !== "$queryRawUnsafe") return Reflect.get(target, key);
          return async (sql: string) => {
            const rows = await target.$queryRawUnsafe(sql);
            if (!paused && sql.includes('public."enrollments"')) {
              paused = true;
              const strongLocks = await target.$queryRaw<Array<{ mode: string }>>`
                SELECT l.mode FROM pg_catalog.pg_locks l
                JOIN pg_catalog.pg_class c ON c.oid=l.relation
                JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                WHERE l.pid=pg_backend_pid() AND n.nspname='public'
                  AND l.mode <> 'AccessShareLock' AND l.granted`;
              expect(strongLocks).toEqual([]);
              reached(); await go;
            }
            return rows;
          };
        },
      })), options)) as PrismaClient["$transaction"]);
    const pending = previewProductionReset(db!, actor, scopes);
    await Promise.race([ready, pending.then(() => { throw new Error("Preview never reached snapshot checkpoint"); })]);
    try {
      // This commit must finish while the preview remains paused. The original
      // SHARE ROW EXCLUSIVE preview would instead fail this lock timeout.
      await db!.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '300ms'`;
        await tx.payment.update({ where: { id: cashPayment.id }, data: { totalAmountCents: { increment: 100 } } });
        await tx.enrollment.update({ where: { id: f.enrollment.id }, data: { paidCents: { increment: 100 }, remainingCents: { decrement: 100 } } });
      });
    } finally { resume(); }
    const during = await pending;
    expect(during.preview).toEqual(before.preview);
    const after = await previewProductionReset(db!, actor, scopes);
    expect(after.preview.fingerprint).not.toBe(during.preview.fingerprint);
    expect(after.preview.financial.cashPaymentsCents).toBe(before.preview.financial.cashPaymentsCents + 100);
    await expect(run(during.id)).rejects.toMatchObject({ code: "stale" });
    expect(await db!.payment.count()).toBe(3);
    expect((await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).paidCents).toBe(6100);
  });
  it("rejects a writer using a transaction started before reset", async () => {
    await enrollmentFixture();
    const p = await previewProductionReset(db!,actor,selection({ financialData: true }));
    let started!: () => void; let resume!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const go = new Promise<void>(resolve => { resume = resolve; });
    const oldWriter = db!.$transaction(async tx => {
      await tx.enrollment.findMany(); started(); await go;
      await tx.enrollment.updateMany({ data: { paidCents: 6000, remainingCents: 4000 } });
    }, { timeout: 60_000 });
    const rejected = expect(oldWriter).rejects.toThrow();
    await ready; try { await run(p.id); } finally { resume(); }
    await rejected;
    expect((await db!.enrollment.findFirstOrThrow()).paidCents).toBe(0);
  });
  it("keeps paid payroll linked and prevents duplicate postings", async () => {
    const teacher = await db!.teacher.create({ data: { fullName: "Payroll fixture" } });
    const payroll = await db!.teacherPayroll.create({ data: { teacherId: teacher.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), hourlyRateSnapshotCents: 1000, grossAmountCents: 5000, status: "PAID", paidAt: new Date() } });
    const expenseData = { payrollId: payroll.id, category: "Teacher Payroll", description: "Historical posting", amountCents: 5000, paymentMethod: "whish" };
    await db!.expense.create({ data: expenseData });
    await expect(db!.expense.create({ data: expenseData })).rejects.toThrow();
    const blocked = await previewProductionReset(db!,actor,selection({ teachers: true }));
    await expect(run(blocked.id)).rejects.toMatchObject({ code: "blocked" });
    expect(await db!.expense.count()).toBe(1);
    const allowed = await previewProductionReset(db!,actor,selection({ teachers: true, financialData: true }));
    expect(allowed.preview.financial.whishExpensesCents).toBe(5000);
    await run(allowed.id); expect(await db!.expense.count()).toBe(0); expect(await db!.teacherPayroll.count()).toBe(0);
  });
  it("detects unmodeled incoming FKs before deleting anything", async () => {
    await enrollmentFixture();
    await db!.$executeRawUnsafe("CREATE TABLE public.reset_test_external_dependency(id uuid PRIMARY KEY, payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE)");
    try {
      const p = await previewProductionReset(db!,actor,selection({ financialData: true }));
      expect(p.preview.blocked.join()).toMatch(/reset_test_external_dependency/);
      await expect(run(p.id)).rejects.toMatchObject({ code: "blocked" }); expect(await db!.payment.count()).toBe(3);
    } finally { await db!.$executeRawUnsafe("DROP TABLE public.reset_test_external_dependency"); }
  });
  it("preserves issued identifiers and rejects registration replay after deleting people", async () => {
    const f = await enrollmentFixture();
    const p = await previewProductionReset(db!,actor,selection({ financialData: true, studentsFamilies: true })); await run(p.id);
    expect(await allocateBusinessIdentifier(db!,"FAM")).not.toBe(f.family.familyCode);
    expect(await allocateBusinessIdentifier(db!,"STU")).not.toBe(f.student.studentCode);
    expect(await allocateBusinessIdentifier(db!,"RCPT")).not.toBe(f.payment.receiptNumber);
    expect(await db!.resetRegistrationSubmission.findUnique({ where: { id: f.enrollment.registrationSubmissionId! } })).not.toBeNull();
    await expect(db!.family.create({ data: { familyCode: f.family.familyCode, name: "Reuse" } })).rejects.toThrow(/already issued/);
  });
  it("counts and deletes pattern-only lessons while preserving standalone lessons", async () => {
    const f = await enrollmentFixture();
    const teacher = await db!.teacher.create({ data: { fullName: "Pattern fixture" } });
    const pattern = await db!.schedulePattern.create({ data: { enrollmentId: f.enrollment.id, teacherId: teacher.id, dayOfWeek: 1, startTime: "10:00", endTime: "11:00", startsOn: f.season.startDate, endsOn: f.season.endDate } });
    const lesson = { studentId: f.student.id, teacherId: teacher.id, sessionDate: new Date("2026-01-05"), startTime: "10:00", endTime: "11:00" };
    await db!.scheduleSession.create({ data: { ...lesson, schedulePatternId: pattern.id } });
    const standalone = await db!.scheduleSession.create({ data: { ...lesson, startTime: "11:00", endTime: "12:00" } });
    const p = await previewProductionReset(db!, actor, selection({ seasons: true, financialData: true }));
    expect(p.preview.blocked).toEqual([]);
    expect(p.preview.operations.find(row => row.model === "scheduleSession")?.count).toBe(1);
    const result = await run(p.id);
    expect(result.deleted.scheduleSession).toBe(1);
    expect(await db!.scheduleSession.findMany()).toEqual([standalone]);
  });
  it("blocks an unexpected cascading FK between known tables", async () => {
    const f = await enrollmentFixture();
    const teacher = await db!.teacher.create({ data: { fullName: "Unexpected dependency" } });
    await db!.$executeRawUnsafe("ALTER TABLE public.payments ADD COLUMN reset_test_teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE");
    try {
      await db!.$executeRaw`UPDATE public.payments SET reset_test_teacher_id = ${teacher.id}::uuid WHERE id = ${f.payment.id}::uuid`;
      const p = await previewProductionReset(db!, actor, selection({ teachers: true }));
      expect(p.preview.blocked.join()).toMatch(/public.payments references teachers/);
      await expect(run(p.id)).rejects.toMatchObject({ code: "blocked" });
      expect(await db!.payment.count()).toBe(3);
    } finally { await db!.$executeRawUnsafe("ALTER TABLE public.payments DROP COLUMN reset_test_teacher_id"); }
  });
  it("blocks changed referential actions even when FK columns are familiar", async () => {
    await enrollmentFixture();
    await db!.$executeRawUnsafe("ALTER TABLE public.registration_attempts DROP CONSTRAINT registration_attempts_payment_id_fkey, ADD CONSTRAINT registration_attempts_payment_id_fkey FOREIGN KEY(payment_id) REFERENCES public.payments(id) ON DELETE CASCADE ON UPDATE CASCADE");
    try {
      const p = await previewProductionReset(db!, actor, selection({ financialData: true }));
      expect(p.preview.blocked.join()).toMatch(/registration_attempts references payments/);
      await expect(run(p.id)).rejects.toMatchObject({ code: "blocked" });
      expect(await db!.registrationAttempt.count()).toBe(1);
    } finally {
      await db!.$executeRawUnsafe("ALTER TABLE public.registration_attempts DROP CONSTRAINT registration_attempts_payment_id_fkey, ADD CONSTRAINT registration_attempts_payment_id_fkey FOREIGN KEY(payment_id) REFERENCES public.payments(id) ON DELETE SET NULL ON UPDATE CASCADE");
    }
  });
  it("preserves reset behavior with all 22 reviewed live ON UPDATE NO ACTION variants", async () => {
    const evidence = JSON.parse(readFileSync("docs/evidence/production-reset-2026-11-07.json", "utf8")) as {
      foreign_keys: Array<{ child: string; parent: string; child_columns: string[]; parent_columns: string[]; constraint_name: string; delete_action: string; update_action: string }>;
    };
    const variants = evidence.foreign_keys.filter(row => row.update_action === "a");
    const identifier = (value: string) => {
      if (!/^[a-z_]+$/.test(value)) throw new Error("Invalid fixture identifier");
      return `"${value}"`;
    };
    const table = (value: string) => value.split(".").map(identifier).join(".");
    const replace = async (row: (typeof variants)[number], update: "CASCADE" | "NO ACTION") => {
      const deletion = ({ n: "SET NULL", c: "CASCADE", r: "RESTRICT" } as Record<string, string>)[row.delete_action];
      if (!deletion) throw new Error("Unreviewed fixture delete action");
      await db!.$executeRawUnsafe(`ALTER TABLE ${table(row.child)} DROP CONSTRAINT ${identifier(row.constraint_name)}, ADD CONSTRAINT ${identifier(row.constraint_name)} FOREIGN KEY (${row.child_columns.map(identifier).join(",")}) REFERENCES ${table(row.parent)} (${row.parent_columns.map(identifier).join(",")}) ON DELETE ${deletion} ON UPDATE ${update}`);
    };
    const changed: typeof variants = [];
    try {
      for (const row of variants) { await replace(row, "NO ACTION"); changed.push(row); }
      const f = await enrollmentFixture();
      const financial = await previewProductionReset(db!, actor, selection({ financialData: true }));
      expect(financial.preview.blocked).toEqual([]);
      await run(financial.id);
      expect(await db!.enrollment.findUniqueOrThrow({ where: { id: f.enrollment.id } })).toMatchObject({ paidCents: 0, remainingCents: 10000, feeCents: 12000, discountCents: 2000 });
      const academic = await previewProductionReset(db!, actor, selection({ studentsFamilies: true }));
      expect(academic.preview.blocked).toEqual([]);
      await run(academic.id);
      expect(await db!.family.count()).toBe(0);
      expect(await db!.student.count()).toBe(0);
      expect(await db!.userProfile.count()).toBe(1);
    } finally { for (const row of changed) await replace(row, "CASCADE"); }
  });
  it("retains issued receipt numbers during repair and prevents clearing or transferring them", async () => {
    const f = await enrollmentFixture();
    await expect(db!.payment.update({ where: { id: f.payment.id }, data: { receiptNumber: null } })).rejects.toThrow(/immutable/);
    const legacy = await db!.payment.create({ data: { familyId: f.family.id, totalAmountCents: 0, paymentMethod: "cash" } });
    const number = await allocateBusinessIdentifier(db!, "RCPT");
    await db!.receipt.create({ data: { paymentId: legacy.id, receiptNumber: number } });
    expect(await db!.$transaction(tx => ensurePaymentReceipt(tx, legacy.id))).toBe(number);
    expect((await db!.payment.findUniqueOrThrow({ where: { id: legacy.id } })).receiptNumber).toBe(number);
    const other = await db!.payment.create({ data: { familyId: f.family.id, totalAmountCents: 0, paymentMethod: "cash" } });
    await expect(db!.receipt.update({ where: { paymentId: legacy.id }, data: { paymentId: other.id } })).rejects.toThrow(/already issued/);
  });
});
