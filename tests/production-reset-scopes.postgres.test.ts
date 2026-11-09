import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { emptyProductionResetSelection, executeProductionReset, previewProductionReset, productionResetScopes, resetOperationalDefaults, resetTables, RESET_CONFIRMATION, type ProductionResetSelection } from "@/lib/production-reset";
import { allocateBusinessIdentifier } from "./helpers/legacy-identifiers";

const enabled = Boolean(process.env.RESET_TEST_DATABASE_URL);
const db = enabled ? await createDisposableProductionResetTestClient() : null;
const actorId = randomUUID();
const selection = (patch: Partial<ProductionResetSelection>) => ({ ...emptyProductionResetSelection, ...patch });
const preview = (patch: Partial<ProductionResetSelection>) => previewProductionReset(db!, actorId, selection(patch));
const execute = (requestId: string, patch = {}) => executeProductionReset(db!, { actorId, requestId, confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true, ...patch });
const startDate = new Date("2026-01-01"), endDate = new Date("2026-12-31");
async function catalogue() {
  const teacher = await db!.teacher.create({ data: { fullName: "Synthetic teacher" } });
  const course = await db!.course.create({ data: { name: randomUUID() } });
  const level = await db!.courseLevel.create({ data: { name: randomUUID(), order: 3 } });
  const season = await db!.season.create({ data: { name: randomUUID(), startDate, endDate } });
  const room = await db!.room.create({ data: { name: "Synthetic room" } });
  const assignment = await db!.teacherCourse.create({ data: { teacherId: teacher.id, courseId: course.id, levelId: level.id } });
  const globalAvailability = await db!.teacherAvailability.create({ data: { teacherId: teacher.id, courseId: course.id, dayOfWeek: 1, startTime: "09:00", endTime: "12:00" } });
  const seasonalAvailability = await db!.teacherAvailability.create({ data: { teacherId: teacher.id, courseId: course.id, seasonId: season.id, effectiveFrom: startDate, effectiveTo: endDate, dayOfWeek: 2, startTime: "09:00", endTime: "12:00" } });
  const globalPrice = await db!.coursePricing.create({ data: { courseId: course.id, levelId: level.id, priceCents: 1000 } });
  const seasonalPrice = await db!.coursePricing.create({ data: { courseId: course.id, levelId: level.id, seasonId: season.id, priceCents: 2000 } });
  return { teacher, course, level, season, room, assignment, globalAvailability, seasonalAvailability, globalPrice, seasonalPrice };
}
async function academic() {
  const c = await catalogue();
  const family = await db!.family.create({ data: { familyCode: await allocateBusinessIdentifier(db!, "FAM"), name: "Synthetic family" } });
  const student = await db!.student.create({ data: { familyId: family.id, studentCode: await allocateBusinessIdentifier(db!, "STU"), firstName: "Synthetic", lastName: "Student" } });
  const enrollment = await db!.enrollment.create({ data: { studentId: student.id, seasonId: c.season.id, teacherId: c.teacher.id, courseId: c.course.id, levelId: c.level.id, courseName: c.course.name, pricingSourceId: c.globalPrice.id, configuredPriceCents: 1000, finalFeeCents: 1000, feeCents: 1000, remainingCents: 1000, enrollmentStartDate: startDate, enrollmentEndDate: endDate, registrationSubmissionId: randomUUID() } });
  const pattern = await db!.schedulePattern.create({ data: { enrollmentId: enrollment.id, teacherId: c.teacher.id, roomId: c.room.id, dayOfWeek: 1, startTime: "10:00", endTime: "11:00", startsOn: startDate, endsOn: endDate } });
  const lesson = await db!.scheduleSession.create({ data: { studentId: student.id, teacherId: c.teacher.id, enrollmentId: enrollment.id, seasonId: c.season.id, schedulePatternId: pattern.id, roomId: c.room.id, sessionDate: new Date("2026-01-05"), startTime: "10:00", endTime: "11:00" } });
  return { ...c, family, student, enrollment, pattern, lesson };
}
async function clean() {
  for (const table of Object.values(resetTables)) await db!.$executeRawUnsafe(`DELETE FROM public."${table}"`);
  await db!.operationalSettings.deleteMany();
  await db!.productionResetRequest.deleteMany();
}

describe.skipIf(!enabled)("eight additional scopes on disposable PostgreSQL", () => {
  beforeAll(async () => { await db!.userProfile.create({ data: { authId: actorId, name: "Scopes owner", email: `${actorId}@example.invalid`, role: "SUPER_ADMIN" } }); });
  beforeEach(clean);
  afterAll(async () => { if (db) { await clean(); await db.$disconnect(); } });

  it.each(productionResetScopes.slice(6))("executes %s independently with empty tables", async scope => {
    const p = await preview({ [scope]: true });
    expect(p.preview.blocked).toEqual([]);
    expect((await execute(p.id)).totals).toEqual({ deleted: 0, updated: 0 });
  });
  it.each(["courses", "courseLevels", "rooms", "schoolClosures"] as const)("deletes active and archived %s without changing unrelated configuration", async scope => {
    for (const archivedAt of [null, new Date("2025-01-01")]) {
      if (scope === "courses") await db!.course.create({ data: { name: randomUUID(), archivedAt } });
      if (scope === "courseLevels") await db!.courseLevel.create({ data: { name: randomUUID(), order: 4, archivedAt } });
      if (scope === "rooms") await db!.room.create({ data: { name: randomUUID(), archivedAt } });
      if (scope === "schoolClosures") await db!.schoolClosure.create({ data: { name: "Past holiday", startDate, endDate, archivedAt } });
    }
    const teacher = await db!.teacher.create({ data: { fullName: "Preserved" } });
    const p = await preview({ [scope]: true });
    expect(p.preview.blocked).toEqual([]);
    expect((await execute(p.id)).totals.deleted).toBe(2);
    expect(await db!.teacher.findUnique({ where: { id: teacher.id } })).not.toBeNull();
  });
  it("deletes global prices only, including archived rows; retains seasonal prices and all other configuration", async () => {
    const c = await catalogue();
    await db!.coursePricing.update({ where: { id: c.globalPrice.id }, data: { status: "ARCHIVED" } });
    const p = await preview({ globalCoursePricing: true });
    expect(p.preview.blocked).toEqual([]);
    expect(p.preview.retained.find(row => row.table === "course_pricings")?.count).toBe(1);
    expect((await execute(p.id)).deleted.coursePricingGlobalScoped).toBe(1);
    expect(await db!.coursePricing.findMany()).toEqual([c.seasonalPrice]);
    expect(await db!.teacherAvailability.count()).toBe(2);
  });
  it("clears all availability independently and preserves teachers, assignments and prices", async () => {
    const c = await catalogue();
    await db!.teacherAvailability.update({ where: { id: c.seasonalAvailability.id }, data: { archivedAt: new Date() } });
    const p = await preview({ teacherAvailability: true });
    expect(p.preview.blocked).toEqual([]);
    expect((await execute(p.id)).deleted.teacherAvailability).toBe(2);
    expect(await db!.teacherCourse.count()).toBe(1); expect(await db!.teacher.count()).toBe(1);
    expect(await db!.coursePricing.count()).toBe(2);
  });
  it("clears archived teacher assignments alone when no eligibility depends on them", async () => {
    const c = await catalogue(); await db!.teacherAvailability.deleteMany();
    await db!.teacherCourse.update({ where: { id: c.assignment.id }, data: { archivedAt: new Date() } });
    const p = await preview({ teacherCourseAssignments: true });
    expect(p.preview.blocked).toEqual([]);
    expect((await execute(p.id)).deleted.teacherCourse).toBe(1);
    expect(await db!.teacher.count()).toBe(1); expect(await db!.course.count()).toBe(1);
  });
  it.each(["courses", "courseLevels", "rooms", "globalCoursePricing", "teacherAvailability", "teacherCourseAssignments"] as const)("blocks %s when academic survivors depend on it, including archived enrollments", async scope => {
    const a = await academic();
    await db!.enrollment.update({ where: { id: a.enrollment.id }, data: { archivedAt: new Date() } });
    const p = await preview({ [scope]: true });
    expect(p.preview.blocked.length).toBeGreaterThan(0);
    await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    expect(await db!.enrollment.findUnique({ where: { id: a.enrollment.id } })).toMatchObject({ courseId: a.course.id, levelId: a.level.id, teacherId: a.teacher.id, pricingSourceId: a.globalPrice.id, finalFeeCents: 1000 });
    expect(await db!.scheduleSession.findUnique({ where: { id: a.lesson.id } })).toMatchObject({ roomId: a.room.id });
  });
  it("blocks pricing cascades and assignment detachment even without enrollments", async () => {
    await catalogue();
    for (const scope of ["courses", "courseLevels", "teacherCourseAssignments"] as const) {
      const p = await preview({ [scope]: true });
      expect(p.preview.blocked.join(" ")).toMatch(/course_pricings|teacher_availability|teacher_courses/);
      await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    }
    expect(await db!.coursePricing.count()).toBe(2);
  });
  it("protects a lesson using its enrollment season when the lesson season and enrollment teacher are NULL", async () => {
    const a = await academic();
    await db!.schedulePattern.deleteMany();
    await db!.enrollment.update({ where: { id: a.enrollment.id }, data: { teacherId: null } });
    await db!.teacherAvailability.update({ where: { id: a.globalAvailability.id }, data: { seasonId: a.season.id, effectiveFrom: startDate, effectiveTo: endDate } });
    await db!.scheduleSession.update({ where: { id: a.lesson.id }, data: { seasonId: null } });
    const p = await preview({ teacherAvailability: true });
    expect(p.preview.blocked.join(" ")).toMatch(/retained schedule_sessions/);
    await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    expect(await db!.teacherAvailability.count()).toBe(2);
  });
  it("protects recurring teacher eligibility even when the enrollment has no assigned teacher or generated lessons", async () => {
    const a = await academic();
    await db!.scheduleSession.deleteMany();
    await db!.enrollment.update({ where: { id: a.enrollment.id }, data: { teacherId: null } });
    const p = await preview({ teacherAvailability: true, teacherCourseAssignments: true });
    expect(p.preview.blocked.join(" ")).toMatch(/retained schedule_patterns/);
    await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    expect(await db!.schedulePattern.findMany()).toEqual([a.pattern]);
  });
  it("requires seasonal pricing selection too before deleting a catalogue", async () => {
    await catalogue();
    const p = await preview({ courses: true, courseLevels: true, globalCoursePricing: true, teacherAvailability: true, teacherCourseAssignments: true });
    expect(p.preview.blocked.join(" ")).toMatch(/retained course_pricings/);
    await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    const q = await preview({ courses: true, courseLevels: true, globalCoursePricing: true, teacherAvailability: true, teacherCourseAssignments: true, seasons: true });
    expect(q.preview.blocked).toEqual([]);
    const result = await execute(q.id);
    expect(result.deleted).toMatchObject({ coursePricing: 2, teacherAvailability: 2, teacherCourse: 1, course: 1, courseLevel: 1, season: 1 });
    expect(await db!.teacher.count()).toBe(1); expect(await db!.room.count()).toBe(1);
  });
  it("does not promote seasonal availability to global or invalidate retained standalone lessons", async () => {
    const a = await academic();
    await db!.scheduleSession.create({ data: { studentId: a.student.id, teacherId: a.teacher.id, roomId: a.room.id, sessionDate: new Date("2026-01-05"), startTime: "11:00", endTime: "12:00" } });
    const p = await preview({ seasons: true, teacherAvailability: true });
    expect(p.preview.blocked.join(" ")).toMatch(/retained schedule_sessions/);
    await expect(execute(p.id)).rejects.toMatchObject({ code: "blocked" });
    const q = await preview({ seasons: true });
    expect(q.preview.blocked).toEqual([]); await execute(q.id);
    expect(await db!.teacherAvailability.findMany()).toEqual([a.globalAvailability]);
    expect(await db!.scheduleSession.count()).toBe(1);
  });
  it("removes closures without changing lessons, attendance or patterns", async () => {
    const a = await academic();
    await db!.schoolClosure.create({ data: { name: "Historical closure", startDate, endDate, archivedAt: new Date() } });
    const p = await preview({ schoolClosures: true });
    expect(p.preview.consequences.join(" ")).toMatch(/does not regenerate/);
    await execute(p.id);
    expect(await db!.scheduleSession.findMany()).toEqual([a.lesson]);
    expect(await db!.schedulePattern.findMany()).toEqual([a.pattern]);
  });
  it("restores settings with exact before/after audit and idempotent actual counts", async () => {
    const before = { attendanceAutoFinalizeEnabled: false, attendanceFinalizeGraceMinutes: 60, allowPayableMissedLessons: true };
    await db!.operationalSettings.create({ data: { id: "school-default", ...before } });
    const unrelated = await db!.operationalSettings.create({ data: { id: "unrelated", ...before } });
    const p = await preview({ operationalSettings: true });
    expect(p.preview.settings).toEqual({ before, after: resetOperationalDefaults });
    expect((await execute(p.id)).updated.operationalSettings).toBe(1);
    const after = await db!.operationalSettings.findUniqueOrThrow({ where: { id: "school-default" } });
    expect(after).toMatchObject(resetOperationalDefaults);
    expect(after.updatedById).not.toBeNull();
    expect(await db!.operationalSettings.findUnique({ where: { id: unrelated.id } })).toEqual(unrelated);
    const audit = await db!.auditLog.findFirstOrThrow({ where: { actorId, action: "production_reset" }, orderBy: { createdAt: "desc" } });
    expect(audit.metadata).toMatchObject({ preview: { settings: p.preview.settings }, result: { updated: { operationalSettings: 1 } } });
    const q = await preview({ operationalSettings: true });
    expect((await execute(q.id)).updated.operationalSettings).toBe(0);
    expect(await db!.operationalSettings.findUnique({ where: { id: "school-default" } })).toEqual(after);
  });
  it("executes all fourteen groups and protects users, audits, identifiers and registration reservations", async () => {
    const a = await academic();
    const receiptNumber = await allocateBusinessIdentifier(db!, "RCPT");
    await db!.payment.create({ data: { familyId: a.family.id, receiptNumber, totalAmountCents: 1000, paymentMethod: "cash", items: { create: { enrollmentId: a.enrollment.id, amountCents: 1000 } }, receipt: { create: { receiptNumber } } } });
    await db!.schoolClosure.create({ data: { name: "Closure", startDate, endDate } });
    await db!.operationalSettings.create({ data: { id: "school-default", attendanceFinalizeGraceMinutes: 0 } });
    const users = await db!.userProfile.findMany();
    const audits = await db!.auditLog.count();
    const ledger = await db!.$queryRaw`SELECT md5(string_agg(to_jsonb(i)::text, ',' ORDER BY to_jsonb(i)::text)) AS hash FROM public.issued_business_identifiers i`;
    const p = await preview(Object.fromEntries(productionResetScopes.map(key => [key, true])));
    expect(p.preview.blocked).toEqual([]);
    const result = await execute(p.id);
    expect(result.totals).toEqual({ deleted: p.preview.totals.deleted, updated: p.preview.totals.updated });
    for (const table of Object.values(resetTables)) expect(await db!.$queryRawUnsafe(`SELECT count(*)::integer AS count FROM public."${table}"`)).toEqual([{ count: 0 }]);
    expect(await db!.userProfile.findMany()).toEqual(users);
    expect(await db!.auditLog.count()).toBe(audits + 1);
    expect(await db!.$queryRaw`SELECT md5(string_agg(to_jsonb(i)::text, ',' ORDER BY to_jsonb(i)::text)) AS hash FROM public.issued_business_identifiers i`).toEqual(ledger);
    expect(await db!.resetRegistrationSubmission.findUnique({ where: { id: a.enrollment.registrationSubmissionId! } })).not.toBeNull();
    expect(await db!.operationalSettings.findUnique({ where: { id: "school-default" } })).toMatchObject(resetOperationalDefaults);
  });
  it("rejects same-count settings changes, wrong confirmations, expiry and reused previews", async () => {
    await db!.operationalSettings.create({ data: { id: "school-default", attendanceFinalizeGraceMinutes: 0 } });
    const p = await preview({ operationalSettings: true });
    await expect(execute(p.id, { confirmation: "RESET" })).rejects.toMatchObject({ code: "confirmation" });
    await db!.operationalSettings.update({ where: { id: "school-default" }, data: { attendanceFinalizeGraceMinutes: 1 } });
    await expect(execute(p.id)).rejects.toMatchObject({ code: "stale" });
    const q = await preview({ operationalSettings: true });
    await db!.productionResetRequest.update({ where: { id: q.id }, data: { expiresAt: new Date(0) } });
    await expect(execute(q.id)).rejects.toMatchObject({ code: "stale" });
    const r = await preview({ operationalSettings: true }); await execute(r.id);
    await expect(execute(r.id)).rejects.toMatchObject({ code: "stale" });
  });
  it("serializes overlapping configuration resets", async () => {
    await db!.room.create({ data: { name: "Concurrent room" } });
    const p = await preview({ rooms: true }), q = await preview({ rooms: true, operationalSettings: true });
    const outcomes = await Promise.allSettled([execute(p.id), execute(q.id)]);
    expect(outcomes.filter(row => row.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(row => row.status === "rejected")).toHaveLength(1);
  });
  it("rolls back settings and configuration when audit insertion fails", async () => {
    const settings = await db!.operationalSettings.create({ data: { id: "school-default", attendanceFinalizeGraceMinutes: 0 } });
    const room = await db!.room.create({ data: { name: "Rollback room" } });
    await db!.$executeRawUnsafe("CREATE FUNCTION public.scopes_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'scope audit failure'; END $$");
    await db!.$executeRawUnsafe("CREATE TRIGGER scopes_fail_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.scopes_fail_audit()");
    try {
      const p = await preview({ rooms: true, operationalSettings: true });
      await expect(execute(p.id)).rejects.toThrow();
      expect(await db!.room.findMany()).toEqual([room]);
      expect(await db!.operationalSettings.findMany()).toEqual([settings]);
      expect((await db!.productionResetRequest.findUniqueOrThrow({ where: { id: p.id } })).consumedAt).toBeNull();
    } finally {
      await db!.$executeRawUnsafe("DROP TRIGGER scopes_fail_audit ON public.audit_logs");
      await db!.$executeRawUnsafe("DROP FUNCTION public.scopes_fail_audit()");
    }
  });
});
