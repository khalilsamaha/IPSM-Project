import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { emptyProductionResetSelection, getProductionResetPlan, parseProductionResetSelection, previewProductionReset, executeProductionReset, productionResetScopes, resetTables, resetOptions, resetOperationalDefaults, RESET_CONFIRMATION, canonical, type ProductionResetSelection } from "@/lib/production-reset";
import type { PrismaClient } from "@prisma/client";

// Mocked clients exercise normal production authorization; they never connect.
beforeEach(() => {
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

const selection = (patch: Partial<ProductionResetSelection>) => ({ ...emptyProductionResetSelection, ...patch });
const actorId = "00000000-0000-4000-8000-000000000001";
function fixture(initial: Record<string, any[]> = {}) {
  let data: Record<string, any[]> = structuredClone(initial);
  let requests: Record<string, any> = {};
  let audit: any[] = [];
  let failure = "";
  let role = "SUPER_ADMIN";
  let status = "ACTIVE";
  const count = (table: string, field?: string) => async (args?: any) => (data[table] ?? []).filter(row => !args?.where || (field && row[field] != null)).length;
  const tx: any = {
    operationalSettings: {
      findUnique: async () => data.operational_settings?.[0] ? Object.fromEntries(Object.keys(resetOperationalDefaults).map(key => [key, data.operational_settings[0][key]])) : null,
      updateMany: async ({ data: value }: any) => { Object.assign(data.operational_settings[0], value); return { count: 1 }; },
    },
    userProfile: { findUnique: async () => ({ id: actorId, role, status, archivedAt: null }) },
    expense: { count: async () => (data.expenses ?? []).filter(row => row.payrollId != null || row.category?.toLowerCase() === "teacher payroll").length },
    enrollment: { count: count("enrollments", "teacherId") },
    scheduleSession: { count: count("schedule_sessions", "enrollmentId") },
    registrationAttempt: {
      count: count("registration_attempts", "paymentId"),
      updateMany: async () => { let count = 0; for (const row of data.registration_attempts ?? []) if (row.paymentId != null) { row.paymentId = null; count++; } return { count }; },
    },
    productionResetRequest: {
      create: async ({ data: value }: any) => { const id = `request-${Object.keys(requests).length}`; requests[id] = { ...structuredClone(value), id, consumedAt: null }; return requests[id]; },
      findUnique: async ({ where }: any) => requests[where.id] ?? null,
      update: async ({ where, data: value }: any) => Object.assign(requests[where.id], value),
    },
    auditLog: { create: async ({ data: value }: any) => { if (failure === "audit") throw new Error("audit unavailable"); audit.push(value); return value; } },
    $queryRawUnsafe: async (sql: string) => {
      const table = sql.match(/public\."(\w+)"/)![1];
      if (sql.includes(" JOIN ")) return [{ count: 0 }]; // Logical/FK joins are verified on real PostgreSQL.
      const rows = (data[table] ?? []).filter(row => (!sql.includes("season_id IS NULL") || row.seasonId == null) && (!sql.includes("season_id IS NOT NULL") || row.seasonId != null || (sql.includes("OR enrollment_id") && row.enrollmentId != null) || (sql.includes("OR schedule_pattern_id") && row.schedulePatternId != null)));
      return [{ count: rows.length, hash: createHash("sha256").update(canonical(rows)).digest("hex") }];
    },
    $queryRaw: async (strings: TemplateStringsArray) => {
      if (strings.join("").includes("pg_catalog.pg_constraint")) return data.unknownDependencies ?? [];
      if (strings.join("").includes("AS invalid")) return [{ invalid: (data.enrollments ?? []).filter(e => e.feeCents < 0 || e.discountCents < 0 || e.finalFeeCents !== Math.max(0, e.feeCents - e.discountCents)).length, changed: (data.enrollments ?? []).filter(e => e.paidCents !== 0 || e.remainingCents !== e.finalFeeCents).length }];
      return [{ cashPaymentsCents: 0, whishPaymentsCents: 0, otherPaymentsCents: 0, cashExpensesCents: 0, whishExpensesCents: 0, otherExpensesCents: 0, payrollCents: 0, closedShifts: 0 }];
    },
    $executeRawUnsafe: async (sql: string) => {
      if (!sql.startsWith("DELETE")) return 0;
      const table = sql.match(/public\."(\w+)"/)![1];
      if (failure === table) throw new Error("foreign key blocker");
      const before = data[table] ?? [];
      const retained = sql.includes("season_id IS NULL") ? before.filter(row => row.seasonId != null) : sql.includes("season_id IS NOT NULL") ? before.filter(row => row.seasonId == null && (!sql.includes("OR enrollment_id") || row.enrollmentId == null) && (!sql.includes("OR schedule_pattern_id") || row.schedulePatternId == null)) : [];
      data[table] = retained;
      return before.length - retained.length;
    },
    $executeRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join("");
      if (sql.includes("UPDATE public.enrollments")) {
        let count = 0;
        for (const e of data.enrollments ?? []) if (e.paidCents !== 0 || e.remainingCents !== e.finalFeeCents) { e.paidCents = 0; e.remainingCents = e.finalFeeCents; count++; }
        return count;
      }
      if (sql.includes("UPDATE public.production_reset_state")) data.production_reset_state = [{ generation: Math.random() }];
      if (sql.includes("INSERT INTO public.reset_registration_submissions")) data.reset_registration_submissions = [...(data.enrollments ?? []).filter(e => e.registrationSubmissionId).map(e => ({ id: e.registrationSubmissionId })), ...(data.registration_attempts ?? []).map(e => ({ id: e.id }))];
      return 0;
    },
  };
  const prisma = { $transaction: vi.fn(async (callback: any) => {
    const before = structuredClone({ data, requests, audit });
    try { return await callback(tx); } catch (error) { data = before.data; requests = before.requests; audit = before.audit; throw error; }
  }) } as unknown as PrismaClient;
  return { prisma, tx, data: () => data, requests: () => requests, audit: () => audit, fail: (value: string) => { failure = value; }, role: (value: string) => { role = value; }, status: (value: string) => { status = value; } };
}
const execute = (db: ReturnType<typeof fixture>, requestId: string, patch = {}) => executeProductionReset(db.prisma, { actorId, requestId, confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true, ...patch });

describe("production reset planner", () => {
  it.each(Array.from({ length: 64 }, (_, mask) => [mask]))("handles selection combination %i", mask => {
    const selected = Object.fromEntries(productionResetScopes.map((key, i) => [key, Boolean(mask & (1 << i))])) as ProductionResetSelection;
    if (!mask) { expect(() => getProductionResetPlan(selected)).toThrow(/Choose/); return; }
    const plan = getProductionResetPlan(selected), operations = plan.map(row => row.operation);
    expect(new Set(operations).size).toBe(operations.length);
    for (const model of ["payment", "paymentItem", "receipt", "expense", "cashierShift", "teacherPayroll", "teacherPayrollItem"]) expect(operations.includes(model as any)).toBe(selected.financialData);
    const before = (child: string, parent: string) => { if (operations.includes(child as any) && operations.includes(parent as any)) expect(operations.indexOf(child as any)).toBeLessThan(operations.indexOf(parent as any)); };
    before("expense", "teacherPayroll"); before("teacherPayrollItem", "scheduleSession"); before("schedulePattern", "enrollment"); before("registrationAttempt", "student"); before("payment", "family"); before("student", "family");
    expect(plan.every(row => Object.hasOwn(resetTables, row.model))).toBe(true);
    expect(operations).not.toContain("userProfile"); expect(operations).not.toContain("auditLog");
  });
  it("rejects arbitrary keys, repeated fields, unsupported values and empty selections", () => {
    for (const entries of [[['users','on']], [['financialData','true']], [['teachers','on'],['teachers','on']], []]) {
      const form = new FormData(); for (const [key,value] of entries) form.append(key,value);
      expect(() => parseProductionResetSelection(form)).toThrow();
    }
    const form = new FormData(); form.set("seasons","on"); expect(parseProductionResetSelection(form)).toEqual(selection({ seasons: true }));
  });
  it("deletes seasonal configuration without promoting it to global", async () => {
    const db = fixture({ course_pricings: [{ id: "global", seasonId: null }, { id: "seasonal", seasonId: "s" }], teacher_availability: [{ seasonId: null }, { seasonId: "s" }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ seasons: true }));
    await execute(db, p.id);
    expect(db.data().course_pricings).toEqual([{ id: "global", seasonId: null }]); expect(db.data().teacher_availability).toEqual([{ seasonId: null }]);
  });
});

describe("reset executor and survivors", () => {
  it.each([0, 4000, 10000])("restores balances without rewriting charges (paid %i)", async paid => {
    const original = { id: "e", feeCents: 12000, discountCents: 2000, finalFeeCents: 10000, paidCents: paid, remainingCents: 10000-paid };
    const db = fixture({ enrollments: [original], payments: [{ id: "p", voidedAt: null }, { id: "void", voidedAt: "date" }], payment_items: [{ paymentId: "p", amountCents: paid }, { paymentId: "void", amountCents: 500 }], registration_attempts: [{ id: "r", paymentId: "p", enrollmentId: "e", status: "COMPLETED" }], users: [{ id: "protected" }], audit_logs: [{ id: "history" }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ financialData: true }));
    const result = await execute(db, p.id);
    expect(db.data().enrollments[0]).toEqual({ ...original, paidCents: 0, remainingCents: 10000 });
    expect(result.deleted.payment).toBe(2); expect(result.deleted.paymentItem).toBe(2);
    expect(db.data().registration_attempts[0]).toMatchObject({ status: "COMPLETED", paymentId: null, enrollmentId: "e" });
    expect(db.data().users).toEqual([{ id: "protected" }]); expect(db.data().audit_logs).toEqual([{ id: "history" }]); expect(db.audit()).toHaveLength(1);
    await expect(execute(db, p.id)).rejects.toMatchObject({ code: "stale" });
  });
  it("blocks invalid charges instead of silently repairing historical fees", async () => {
    const db = fixture({ enrollments: [{ feeCents: 100, discountCents: 0, finalFeeCents: -1, paidCents: 0, remainingCents: -1 }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ financialData: true }));
    expect(p.preview.blocked.join()).toMatch(/original charges/); await expect(execute(db,p.id)).rejects.toMatchObject({ code: "blocked" });
  });
  it.each(["audit", "schedule_sessions"])("rolls all changes and consumption back on %s failure", async failure => {
    const db = fixture({ payments: [{ id: "p" }], schedule_sessions: [{ id: "lesson", enrollmentId: null }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ financialData: true, scheduleData: true }));
    const before = structuredClone(db.data()); db.fail(failure);
    await expect(execute(db,p.id)).rejects.toThrow();
    expect(db.data()).toEqual(before); expect(db.audit()).toHaveLength(0); expect(db.requests()[p.id].consumedAt).toBeNull();
  });
  it.each(["teachers", "scheduleData", "operationalData", "studentsFamilies", "seasons"] as const)("preserves payroll postings unless financial deletion is explicit (%s)", async key => {
    const db = fixture({ teacher_payrolls: [{ status: "PAID" }], expenses: [{ category: "Teacher Payroll", payrollId: "p" }], cashier_shifts: [{ status: "AUTO_CLOSED", closingSnapshot: { cash: 100 } }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ [key]: true }));
    expect(p.preview.blocked.join()).toMatch(/Payroll history/); await expect(execute(db,p.id)).rejects.toMatchObject({ code: "blocked" }); expect(db.data().expenses).toHaveLength(1);
  });
  it("blocks implicit financial deletion and meaningful teacher/schedule detachment", async () => {
    const db = fixture({ enrollments: [{ teacherId: "t" }], payment_items: [{}], schedule_patterns: [{}], schedule_sessions: [{ enrollmentId: "e" }] });
    for (const key of ["teachers", "scheduleData", "operationalData"] as const) {
      const p = await previewProductionReset(db.prisma, actorId, selection({ [key]: true })); expect(p.preview.blocked.length).toBeGreaterThan(0);
    }
  });
  it("detects same-count edits after preview, not just added/deleted rows", async () => {
    const db = fixture({ schedule_sessions: [{ id: "s", title: "before", enrollmentId: null }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ scheduleData: true }));
    db.data().schedule_sessions[0].title = "after";
    await expect(execute(db,p.id)).rejects.toMatchObject({ code: "stale" });
  });
  it("preserves standalone lessons during a season reset", async () => {
    const db = fixture({ schedule_sessions: [{ id: "standalone", seasonId: null, enrollmentId: null }, { id: "linked", seasonId: null, enrollmentId: "enrollment" }, { id: "pattern-linked", seasonId: null, enrollmentId: null, schedulePatternId: "pattern" }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ seasons: true }));
    await execute(db,p.id);
    expect(db.data().schedule_sessions).toEqual([{ id: "standalone", seasonId: null, enrollmentId: null }]);
  });
  it("blocks unknown live database dependencies and legacy payroll expenses", async () => {
    const db = fixture({ unknownDependencies: [{ child: "public.external_payments", parent: "payments" }] });
    const p = await previewProductionReset(db.prisma,actorId,selection({ financialData: true }));
    expect(p.preview.blocked.join()).toMatch(/Unmodeled/);
    const legacy = fixture({ expenses: [{ category: "Teacher Payroll" }] });
    const q = await previewProductionReset(legacy.prisma,actorId,selection({ teachers: true }));
    expect(q.preview.blocked.join()).toMatch(/legacy postings/);
  });
  it("rejects expired and modified stored preview effects", async () => {
    const db = fixture(); const p = await previewProductionReset(db.prisma,actorId,selection({ financialData: true }));
    db.requests()[p.id].expiresAt = new Date(0);
    await expect(execute(db,p.id)).rejects.toMatchObject({ code: "stale" });
    const q = await previewProductionReset(db.prisma,actorId,selection({ financialData: true }));
    db.requests()[q.id].preview.operations[0].count = 999;
    await expect(execute(db,q.id)).rejects.toMatchObject({ code: "stale" });
  });
  it("retains registration submission tombstones when removing registrations", async () => {
    const db = fixture({ enrollments: [{ registrationSubmissionId: "old-submission" }], registration_attempts: [{ id: "attempt" }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ operationalData: true })); await execute(db,p.id);
    expect(db.data().reset_registration_submissions).toEqual([{ id: "old-submission" }, { id: "attempt" }]);
  });
});

describe("reset server-side authorization and confirmation", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(["preview", "development", ""])("blocks direct library use from a non-production Vercel deployment (%s)", async environment => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", environment);
    const db = fixture();
    await expect(previewProductionReset(db.prisma, actorId, selection({ financialData: true }))).rejects.toMatchObject({ code: "environment" });
    await expect(execute(db, "unused")).rejects.toMatchObject({ code: "environment" });
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("uses a repeatable-read preview with only read table locks", async () => {
    const db = fixture(); const sql = vi.spyOn(db.tx, "$executeRawUnsafe");
    await previewProductionReset(db.prisma, actorId, selection({ financialData: true }));
    expect(db.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: "RepeatableRead" }));
    expect(sql).toHaveBeenCalledWith(expect.stringContaining("IN ACCESS SHARE MODE"));
    expect(sql.mock.calls.every(call => !String(call[0]).includes("SHARE ROW EXCLUSIVE"))).toBe(true);
  });
  it.each(["ADMIN", "RECEPTION"])("rejects %s for preview and execution", async role => {
    const db = fixture(); const p = await previewProductionReset(db.prisma, actorId, selection({ financialData: true })); db.role(role);
    await expect(previewProductionReset(db.prisma, actorId, selection({ teachers: true }))).rejects.toMatchObject({ code: "not-authorized" });
    await expect(execute(db,p.id)).rejects.toMatchObject({ code: "not-authorized" });
  });
  it("rejects inactive users, missing review, wrong phrases, cross-user requests and financial acknowledgement omission", async () => {
    const db = fixture(); const p = await previewProductionReset(db.prisma, actorId, selection({ financialData: true }));
    for (const patch of [{ reviewed: false }, { confirmation: "RESET" }, { financialAcknowledged: false }, { actorId: "another-user" }]) await expect(execute(db,p.id,patch)).rejects.toThrow();
    db.status("INACTIVE"); await expect(execute(db,p.id)).rejects.toMatchObject({ code: "not-authorized" });
  });
});


describe("fourteen independently selectable scopes", () => {
  it("centralizes fourteen unique labels and parses every independent option", () => {
    expect(resetOptions).toHaveLength(14);
    expect(new Set(productionResetScopes).size).toBe(14);
    for (const key of productionResetScopes) {
      const form = new FormData(); form.set(key, "on");
      expect(parseProductionResetSelection(form)).toEqual(selection({ [key]: true }));
    }
  });
  it("plans every nonempty fourteen-scope combination without duplicate deletions or unsafe ordering", () => {
    const edges = [["coursePricing", "course"], ["coursePricing", "courseLevel"], ["coursePricing", "season"], ["teacherCourse", "course"], ["teacherCourse", "courseLevel"], ["teacherAvailability", "course"], ["teacherAvailability", "season"], ["scheduleSession", "room"], ["schedulePattern", "room"], ["enrollment", "course"], ["enrollment", "courseLevel"]];
    for (let mask = 1; mask < 2 ** productionResetScopes.length; mask++) {
      const selected = Object.fromEntries(productionResetScopes.map((key, i) => [key, Boolean(mask & (1 << i))])) as ProductionResetSelection;
      const plan = getProductionResetPlan(selected), models: string[] = plan.map(row => row.model);
      if (new Set(models).size !== models.length) throw new Error(`Duplicate model at ${mask}`);
      for (const [child, parent] of edges) if (models.includes(child) && models.includes(parent) && models.indexOf(child) >= models.indexOf(parent)) throw new Error(`Unsafe ${child}/${parent} ordering at ${mask}`);
      if (models.includes("payment") !== selected.financialData) throw new Error(`Implicit financial deletion at ${mask}`);
      if (models.includes("enrollment") !== (selected.operationalData || selected.studentsFamilies || selected.seasons)) throw new Error(`Implicit enrollment deletion at ${mask}`);
    }
  });
  it("keeps independent configuration selections narrow and merges overlapping pricing/availability scopes", () => {
    for (const [scope, model] of [["courses", "course"], ["courseLevels", "courseLevel"], ["rooms", "room"], ["schoolClosures", "schoolClosure"], ["teacherAvailability", "teacherAvailability"], ["teacherCourseAssignments", "teacherCourse"]]) {
      expect(getProductionResetPlan(selection({ [scope]: true })).map(row => row.model)).toEqual([model]);
    }
    expect(getProductionResetPlan(selection({ operationalSettings: true }))).toEqual([]);
    const plan = getProductionResetPlan(selection({ seasons: true, globalCoursePricing: true, teacherAvailability: true }));
    expect(plan.filter(row => row.model === "coursePricing")).toMatchObject([{ filter: "all" }]);
    expect(plan.filter(row => row.model === "teacherAvailability")).toMatchObject([{ filter: "all" }]);
  });
  it("deletes global pricing alone and retains seasonal pricing", async () => {
    const db = fixture({ course_pricings: [{ id: "global", seasonId: null }, { id: "seasonal", seasonId: "s" }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ globalCoursePricing: true }));
    expect(p.preview.retained.find(row => row.table === "course_pricings")?.count).toBe(1);
    expect((await execute(db, p.id)).deleted.coursePricingGlobalScoped).toBe(1);
    expect(db.data().course_pricings).toEqual([{ id: "seasonal", seasonId: "s" }]);
  });
  it("audits settings before/after, preserves the row and makes repeated restoration a no-op", async () => {
    const before = { attendanceAutoFinalizeEnabled: false, attendanceFinalizeGraceMinutes: 60, allowPayableMissedLessons: true };
    const db = fixture({ operational_settings: [{ id: "school-default", ...before }] });
    const p = await previewProductionReset(db.prisma, actorId, selection({ operationalSettings: true }));
    expect(p.preview.settings).toEqual({ before, after: resetOperationalDefaults });
    expect(p.preview.totals).toEqual({ deleted: 0, updated: 1, affected: 1 });
    expect((await execute(db, p.id)).updated.operationalSettings).toBe(1);
    expect(db.data().operational_settings[0]).toMatchObject({ id: "school-default", ...resetOperationalDefaults });
    expect(db.audit()[0].metadata.preview.settings).toEqual(p.preview.settings);
    const q = await previewProductionReset(db.prisma, actorId, selection({ operationalSettings: true }));
    expect((await execute(db, q.id)).updated.operationalSettings).toBe(0);
  });
  it("uses implicit defaults for a missing settings row without inventing a deletion or update", async () => {
    const db = fixture(); const p = await previewProductionReset(db.prisma, actorId, selection({ operationalSettings: true }));
    expect(p.preview.settings).toEqual({ before: null, after: resetOperationalDefaults });
    expect((await execute(db, p.id)).totals).toEqual({ deleted: 0, updated: 0 });
  });
  it("rolls back configuration deletions and settings restoration if the audit fails", async () => {
    const db = fixture({ school_closures: [{ id: "closure" }], operational_settings: [{ id: "school-default", attendanceAutoFinalizeEnabled: false, attendanceFinalizeGraceMinutes: 0, allowPayableMissedLessons: true }] });
    const before = structuredClone(db.data());
    const p = await previewProductionReset(db.prisma, actorId, selection({ schoolClosures: true, operationalSettings: true }));
    db.fail("audit"); await expect(execute(db, p.id)).rejects.toThrow("audit unavailable");
    expect(db.data()).toEqual(before); expect(db.requests()[p.id].consumedAt).toBeNull();
  });
});
