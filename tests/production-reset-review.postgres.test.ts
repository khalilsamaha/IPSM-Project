import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";

const url = process.env.RESET_TEST_DATABASE_URL;
const db = url ? await createDisposableProductionResetTestClient() : null;
// Every characterization, including the deliberate TRUNCATE exposure, rolls back.
async function rollback(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  const done = new Error("review fixture rollback");
  try { await db!.$transaction(async tx => { await work(tx); throw done; }); }
  catch (error) { if (error !== done) throw error; }
}
async function denied(tx: Prisma.TransactionClient, sql: string, message: string) {
  await tx.$executeRawUnsafe("SAVEPOINT expected_failure");
  let failure: unknown;
  try { await tx.$executeRawUnsafe(sql); } catch (error) { failure = error; }
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT expected_failure");
  expect(String(failure)).toContain(message);
}
const tables = ["production_reset_requests", "production_reset_state", "reset_registration_submissions", "business_identifier_counters", "issued_business_identifiers"];

describe.skipIf(!url)("PR90 security and repository guard characterization (not live parity)", () => {
  afterAll(async () => { await db?.$disconnect(); });
  it.each(["anon", "authenticated"])("%s cannot read or insert protected rows or invoke the allocator under broad defaults", async role => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      for (const table of tables) {
        const [row] = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM public.${table}`);
        expect(row.count).toBe(BigInt(0));
      }
      await denied(tx, "INSERT INTO public.reset_registration_submissions(id) VALUES(gen_random_uuid())", "row-level security");
      await denied(tx, "SELECT public.allocate_business_identifier('FAM',2097)", "permission denied for function");
      expect(await tx.$executeRawUnsafe("UPDATE public.production_reset_state SET changed_at=now() WHERE id='school'")).toBe(0);
      expect(await tx.$executeRawUnsafe("DELETE FROM public.production_reset_state WHERE id='school'")).toBe(0);
    });
  });
  it.each(["anon", "authenticated"])("documents the unresolved %s TRUNCATE exposure; RLS is not sufficient", async role => {
    await rollback(async tx => {
      await tx.resetRegistrationSubmission.create({ data: { id: randomUUID() } });
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      for (const table of tables) {
        const [rights] = await tx.$queryRawUnsafe<Array<{ allowed: boolean; references: boolean; trigger: boolean }>>(`SELECT has_table_privilege(current_user,'public.${table}','TRUNCATE') AS allowed, has_table_privilege(current_user,'public.${table}','REFERENCES') AS references, has_table_privilege(current_user,'public.${table}','TRIGGER') AS trigger`);
        expect(rights).toEqual({ allowed: true, references: true, trigger: true });
        await tx.$executeRawUnsafe(`TRUNCATE public.${table}`);
      }
      await tx.$executeRawUnsafe("RESET ROLE");
      expect(await tx.productionResetState.count()).toBe(0);
      expect(await tx.resetRegistrationSubmission.count()).toBe(0);
    });
    expect(await db!.productionResetState.count()).toBe(1);
  });
  it("documents that a BYPASSRLS service role retaining default grants can read state and execute the allocator", async () => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE ipsm_fixture_service");
      expect(await tx.productionResetState.count()).toBe(1);
      const [row] = await tx.$queryRaw<Array<{ value: string }>>`SELECT public.allocate_business_identifier('FAM',2097) AS value`;
      expect(row.value).toMatch(/^FAM-2097-\d+$/);
    });
  });
  it("documents the generation-guard gap when a client-writable table's invoker cannot see reset state", async () => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("CREATE TABLE public.ipsm_generation_visibility_probe(id integer)");
      await tx.$executeRawUnsafe("CREATE TRIGGER generation_probe BEFORE INSERT ON public.ipsm_generation_visibility_probe FOR EACH STATEMENT EXECUTE FUNCTION public.guard_reset_generation()");
      await tx.productionResetState.update({ where: { id: "school" }, data: { changedAt: new Date("2199-01-01") } });
      await denied(tx, "INSERT INTO public.ipsm_generation_visibility_probe VALUES(1)", "Data changed during production reset");
      await tx.$executeRawUnsafe("SET LOCAL ROLE anon");
      // RLS hides state from the invoker; NULL >= transaction_timestamp() is not true.
      expect(await tx.$executeRawUnsafe("INSERT INTO public.ipsm_generation_visibility_probe VALUES(2)")).toBe(1);
    });
  });

  async function fixture(tx: Prisma.TransactionClient) {
    const family = await tx.family.create({ data: { familyCode: `review-${randomUUID()}`, name: "Guard fixture" } });
    const student = await tx.student.create({ data: { familyId: family.id, studentCode: `review-${randomUUID()}`, firstName: "Guard", lastName: "Fixture" } });
    const season = await tx.season.create({ data: { name: randomUUID(), startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
    const teacher = await tx.teacher.create({ data: { fullName: "Guard fixture" } });
    const course = await tx.course.create({ data: { name: randomUUID() } });
    const level = await tx.courseLevel.create({ data: { name: randomUUID() } });
    const assignment = await tx.teacherCourse.create({ data: { teacherId: teacher.id, courseId: course.id } });
    const availability = await tx.teacherAvailability.create({ data: { teacherId: teacher.id, courseId: course.id, seasonId: season.id, dayOfWeek: 1, startTime: "09:00", endTime: "12:00", effectiveFrom: new Date("2026-06-01"), effectiveTo: new Date("2026-06-30") } });
    const enrollment = await tx.enrollment.create({ data: { studentId: student.id, teacherId: teacher.id, seasonId: season.id, courseId: course.id, levelId: level.id, courseName: "Guard fixture", enrollmentStartDate: season.startDate, enrollmentEndDate: season.endDate } });
    const session = await tx.scheduleSession.create({ data: { studentId: student.id, teacherId: teacher.id, enrollmentId: enrollment.id, seasonId: season.id, sessionDate: new Date("2026-06-01"), startTime: "09:00", endTime: "12:00" } });
    return { teacher, course, level, assignment, availability, enrollment, session, season };
  }
  it.each([
    ["wrong weekday", "session_date='2026-06-02'"],
    ["before effective range", "session_date='2026-05-25'"],
    ["after effective range", "session_date='2026-07-06'"],
    ["early start", "start_time='08:59'"],
    ["late end", "end_time='12:01'"],
  ])("repository schedule guard rejects %s", async (_label, change) => {
    await rollback(async tx => {
      const f = await fixture(tx);
      await denied(tx, `UPDATE public.schedule_sessions SET ${change} WHERE id='${f.session.id}'`, "Teacher is not available");
    });
  });
  it.each(["status='ARCHIVED'", "archived_at=now()", "course_id=NULL, season_id=NULL"])("repository schedule guard handles availability %s", async change => {
    await rollback(async tx => {
      const f = await fixture(tx);
      await tx.$executeRawUnsafe(`UPDATE public.teacher_availability SET ${change} WHERE id='${f.availability.id}'`);
      const update = `UPDATE public.schedule_sessions SET start_time='09:00' WHERE id='${f.session.id}'`;
      if (change.includes("course_id")) expect(await tx.$executeRawUnsafe(update)).toBe(1);
      else await denied(tx, update, "Teacher is not available");
    });
  });
  it("documents NULL enrollment bypass and lack of schedule assignment/level revalidation", async () => {
    await rollback(async tx => {
      const f = await fixture(tx);
      await tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { status: "ARCHIVED" } });
      expect(await tx.$executeRawUnsafe(`UPDATE public.schedule_sessions SET start_time='09:01' WHERE id='${f.session.id}'`)).toBe(1);
      expect(await tx.$executeRawUnsafe(`UPDATE public.schedule_sessions SET enrollment_id=NULL,start_time='08:00' WHERE id='${f.session.id}'`)).toBe(1);
    });
  });
  it.each(["course", "season"])("rejects availability for a different %s in both enrollment and schedule guards", async scope => {
    await rollback(async tx => {
      const f = await fixture(tx);
      if (scope === "course") {
        const other = await tx.course.create({ data: { name: randomUUID() } });
        await tx.teacherCourse.create({ data: { teacherId: f.teacher.id, courseId: other.id } });
        await tx.teacherAvailability.update({ where: { id: f.availability.id }, data: { courseId: other.id } });
      } else {
        const other = await tx.season.create({ data: { name: randomUUID(), startDate: f.season.startDate, endDate: f.season.endDate } });
        await tx.teacherAvailability.update({ where: { id: f.availability.id }, data: { seasonId: other.id } });
      }
      await denied(tx, `UPDATE public.enrollments SET teacher_id=teacher_id WHERE id='${f.enrollment.id}'`, "No teacher availability occurrence");
      await denied(tx, `UPDATE public.schedule_sessions SET start_time=start_time WHERE id='${f.session.id}'`, "Teacher is not available");
    });
  });
  it("requires at least one weekday occurrence, not full enrollment-range coverage", async () => {
    await rollback(async tx => {
      const f = await fixture(tx); // full year accepted with June-only availability
      await denied(tx, `UPDATE public.enrollments SET enrollment_start_date='2026-06-02',enrollment_end_date='2026-06-02' WHERE id='${f.enrollment.id}'`, "No teacher availability occurrence");
      expect(await tx.$executeRawUnsafe(`UPDATE public.enrollments SET enrollment_start_date='2026-06-01',enrollment_end_date='2026-06-01' WHERE id='${f.enrollment.id}'`)).toBe(1);
      await denied(tx, `UPDATE public.enrollments SET enrollment_start_date='2025-12-31' WHERE id='${f.enrollment.id}'`, "Enrollment dates must remain inside");
    });
  });
  it("checks active level assignment for enrollment changes, while NULL teacher bypasses this guard", async () => {
    await rollback(async tx => {
      const f = await fixture(tx);
      const other = await tx.courseLevel.create({ data: { name: randomUUID() } });
      await tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { levelId: other.id } });
      await denied(tx, `UPDATE public.enrollments SET teacher_id=teacher_id WHERE id='${f.enrollment.id}'`, "not actively assigned");
      await tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { levelId: f.level.id } });
      expect(await tx.$executeRawUnsafe(`UPDATE public.enrollments SET teacher_id=teacher_id WHERE id='${f.enrollment.id}'`)).toBe(1);
      await tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { status: "ARCHIVED" } });
      await denied(tx, `UPDATE public.enrollments SET teacher_id=teacher_id WHERE id='${f.enrollment.id}'`, "not actively assigned");
      expect(await tx.$executeRawUnsafe(`UPDATE public.enrollments SET teacher_id=NULL WHERE id='${f.enrollment.id}'`)).toBe(1);
    });
  });
  it("availability requires seasonal bounds and an active course assignment", async () => {
    await rollback(async tx => {
      const f = await fixture(tx);
      await denied(tx, `UPDATE public.teacher_availability SET effective_from=NULL WHERE id='${f.availability.id}'`, "requires both effective dates");
      await denied(tx, `UPDATE public.teacher_availability SET effective_to='2027-01-01' WHERE id='${f.availability.id}'`, "must remain inside");
      await tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { archivedAt: new Date() } });
      await denied(tx, `UPDATE public.teacher_availability SET course_id=course_id WHERE id='${f.availability.id}'`, "not actively assigned");
    });
  });
});
