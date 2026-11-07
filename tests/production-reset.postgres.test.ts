import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { previewProductionReset, executeProductionReset, emptyProductionResetSelection, RESET_CONFIRMATION, resetTables } from "@/lib/production-reset";
import { allocateBusinessIdentifier } from "@/lib/business-identifiers";

const url = process.env.RESET_TEST_DATABASE_URL;
if (url && (process.env.IPSM_DISPOSABLE_TEST_DATABASE !== "1" || new URL(url).hostname !== "127.0.0.1" || new URL(url).pathname !== "/ipsm_reset_integrity_test")) throw new Error("Only the disposable migration runner may run PostgreSQL reset tests");
// Importing the normal test suite cannot connect to any configured application DB.
const db = url ? new PrismaClient({ datasources: { db: { url } }, transactionOptions: { isolationLevel: "Serializable" } }) : null;
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
  it("serializes competing resets; only one reviewed request can commit", async () => {
    await enrollmentFixture();
    const p1 = await previewProductionReset(db!,actor,selection({ financialData: true }));
    const p2 = await previewProductionReset(db!,actor,selection({ financialData: true }));
    const results = await Promise.allSettled([run(p1.id),run(p2.id)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
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
});
