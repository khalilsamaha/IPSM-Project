import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";

const url = process.env.RESET_TEST_DATABASE_URL;
const db = url ? await createDisposableProductionResetTestClient() : null;
// Every ACL/corruption probe rolls back inside the verified disposable cluster.
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

const functions = ["allocate_business_identifier(text,integer)", "retain_business_identifier()", "guard_reset_generation()", "guard_reset_registration_submission()"];
const clients = ["anon", "authenticated", "service_role", "ipsm_fixture_acl_parent", "ipsm_fixture_public_reader", "ipsm_fixture_set_only"];
let privileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"];
let pg17 = false;

describe.skipIf(!url)("PR90 security regression and repository guard semantics (not live parity)", () => {
  beforeAll(async () => {
    const [version] = await db!.$queryRaw<Array<{ version: number }>>`SELECT current_setting('server_version_num')::integer AS version`;
    pg17 = version.version >= 170000;
    if (pg17) privileges.push("MAINTAIN");
  });
  afterAll(async () => { await db?.$disconnect(); });
  it("reproduces all real creator defaults and keeps them unchanged outside protected objects", async () => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("CREATE TABLE public.ipsm_default_acl_probe(id integer)");
      for (const role of clients) {
        if (role === "ipsm_fixture_set_only") continue;
        for (const privilege of privileges) {
          const [row] = await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT has_table_privilege('${role}','public.ipsm_default_acl_probe','${privilege}') AS allowed`);
          expect(row.allowed).toBe(true);
        }
      }
      const roles = await tx.$queryRaw<Array<{ rolname: string; rolbypassrls: boolean }>>`SELECT rolname,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname`;
      expect(roles).toEqual([{ rolname: "anon", rolbypassrls: false }, { rolname: "authenticated", rolbypassrls: false }, { rolname: "service_role", rolbypassrls: true }]);
    });
  });
  it.each(clients)("denies every effective table/function privilege to %s including PUBLIC and inherited paths", async role => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe(`GRANT CREATE ON SCHEMA public TO ${role}`); // fixture-only: isolate object ACL denial
      await tx.$executeRawUnsafe("CREATE FUNCTION public.ipsm_acl_trigger_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$");
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      for (const table of tables) {
        for (const privilege of privileges) {
          const [row] = await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT has_table_privilege(current_user,'public.${table}','${privilege}') AS allowed`);
          expect(row.allowed, `${role}.${table}.${privilege}`).toBe(false);
        }
        const key = table === "business_identifier_counters" ? "key" : table === "issued_business_identifiers" ? "kind" : "id";
        for (const sql of [
          `SELECT * FROM public.${table}`,
          `INSERT INTO public.${table} DEFAULT VALUES`,
          `UPDATE public.${table} SET ${key}=${key}`,
          `DELETE FROM public.${table}`,
          `TRUNCATE public.${table}`,
          `CREATE TRIGGER ipsm_forbidden_trigger BEFORE INSERT ON public.${table} FOR EACH STATEMENT EXECUTE FUNCTION public.ipsm_acl_trigger_probe()`,
          ...(pg17 ? [`REINDEX TABLE public.${table}`] : []),
        ]) await denied(tx, sql, "42501");
      }
      await denied(tx, "CREATE TABLE public.ipsm_forbidden_reference(id text REFERENCES public.production_reset_state(id))", "42501");
      for (const signature of functions) {
        const [row] = await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT has_function_privilege(current_user,'public.${signature}','EXECUTE') AS allowed`);
        expect(row.allowed).toBe(false);
        await denied(tx, `SELECT public.${signature.replace("text,integer", "'FAM',2097")}`, "42501");
      }
    });
  });
  it("cannot recover rights by assuming a NOINHERIT intermediary role", async () => {
    await rollback(async tx => {
      const [membership] = await tx.$queryRaw<Array<{ member: boolean; inherited: boolean }>>`SELECT pg_has_role('ipsm_fixture_set_only','ipsm_fixture_acl_parent','MEMBER') AS member, pg_has_role('ipsm_fixture_set_only','ipsm_fixture_acl_parent','USAGE') AS inherited`;
      expect(membership).toEqual({ member: true, inherited: false });
      await tx.$executeRawUnsafe("SET LOCAL ROLE ipsm_fixture_acl_parent");
      await denied(tx, "TRUNCATE public.production_reset_state", "42501");
    });
  });
  it("keeps all functions invoker-only and does not add permissive infrastructure policies", async () => {
    const rows = await db!.$queryRawUnsafe<Array<{ proname: string; prosecdef: boolean; proconfig: string[] }>>(`SELECT proname,prosecdef,proconfig FROM pg_proc WHERE oid IN (${functions.map(name => `'public.${name}'::regprocedure`).join(",")})`);
    expect(rows).toHaveLength(4);
    expect(rows.every(row => !row.prosecdef && row.proconfig.includes('search_path=""'))).toBe(true);
    expect(rows.find(row => row.proname === "guard_reset_generation")?.proconfig).toContain("row_security=off");
    const [policies] = await db!.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM pg_policy WHERE polrelid IN (${tables.map(name => `'public.${name}'::regclass`).join(",")})`);
    expect(policies.count).toBe(BigInt(0));
  });
  it("preserves ordinary registration, payment, scheduling and payroll writes for a non-superuser owner backend", async () => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("GRANT CREATE ON SCHEMA public TO ipsm_fixture_backend");
      for (const table of tables) await tx.$executeRawUnsafe(`ALTER TABLE public.${table} OWNER TO ipsm_fixture_backend`);
      for (const signature of functions) await tx.$executeRawUnsafe(`ALTER FUNCTION public.${signature} OWNER TO ipsm_fixture_backend`);
      await tx.$executeRawUnsafe("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ipsm_fixture_backend");
      await tx.$executeRawUnsafe("SET LOCAL ROLE ipsm_fixture_backend");
      const [role] = await tx.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
      expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
      const f = await fixture(tx);
      const submission = randomUUID();
      await tx.enrollment.update({ where: { id: f.enrollment.id }, data: { registrationSubmissionId: submission, feeCents: 1000, finalFeeCents: 1000, remainingCents: 1000 } });
      await tx.registrationAttempt.create({ data: { id: submission, familyId: f.family.id, primaryStudentId: f.student.id, enrollmentId: f.enrollment.id } });
      const [number] = await tx.$queryRaw<Array<{ value: string }>>`SELECT public.allocate_business_identifier('RCPT',2097) AS value`;
      const payment = await tx.payment.create({ data: { familyId: f.family.id, totalAmountCents: 1000, paymentMethod: "cash", receiptNumber: number.value, items: { create: { enrollmentId: f.enrollment.id, amountCents: 1000 } } } });
      await tx.receipt.create({ data: { paymentId: payment.id, receiptNumber: number.value } });
      const payroll = await tx.teacherPayroll.create({ data: { teacherId: f.teacher.id, periodStart: f.season.startDate, periodEnd: f.season.endDate, hourlyRateSnapshotCents: 1000, grossAmountCents: 1000, status: "PAID" } });
      await tx.expense.create({ data: { category: "Teacher Payroll", description: "Security fixture", amountCents: 1000, paymentMethod: "cash", payrollId: payroll.id } });
      expect(await tx.productionResetState.count()).toBe(1);
    });
  });
  it.each(["missing", "null", "wrong id", "multiple"])("blocks ordinary writes with %s generation state", async corruption => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("CREATE TABLE public.ipsm_generation_probe(id integer)");
      await tx.$executeRawUnsafe("CREATE TRIGGER generation_probe BEFORE INSERT ON public.ipsm_generation_probe FOR EACH STATEMENT EXECUTE FUNCTION public.guard_reset_generation()");
      if (corruption === "missing") await tx.productionResetState.deleteMany();
      else if (corruption === "null") {
        await tx.$executeRawUnsafe("ALTER TABLE public.production_reset_state ALTER COLUMN changed_at DROP NOT NULL");
        await tx.$executeRawUnsafe("UPDATE public.production_reset_state SET changed_at=NULL");
      } else {
        await tx.$executeRawUnsafe("ALTER TABLE public.production_reset_state DROP CONSTRAINT production_reset_state_singleton");
        if (corruption === "wrong id") await tx.$executeRawUnsafe("UPDATE public.production_reset_state SET id='unexpected'");
        else await tx.$executeRawUnsafe("INSERT INTO public.production_reset_state VALUES('unexpected','-infinity')");
      }
      await denied(tx, "INSERT INTO public.ipsm_generation_probe VALUES(1)", "55000");
    });
  });
  it.each([false, true])("fails closed for a client-writable table when state is inaccessible or RLS-invisible (row grants: %s)", async rowGrants => {
    await rollback(async tx => {
      await tx.$executeRawUnsafe("CREATE TABLE public.ipsm_generation_probe(id integer)");
      await tx.$executeRawUnsafe("CREATE TRIGGER generation_probe BEFORE INSERT ON public.ipsm_generation_probe FOR EACH STATEMENT EXECUTE FUNCTION public.guard_reset_generation()");
      await tx.productionResetState.update({ where: { id: "school" }, data: { changedAt: new Date("2199-01-01") } });
      if (rowGrants) await tx.$executeRawUnsafe("GRANT SELECT,UPDATE ON public.production_reset_state TO anon");
      await tx.$executeRawUnsafe("SET LOCAL ROLE anon");
      await denied(tx, "INSERT INTO public.ipsm_generation_probe VALUES(1)", rowGrants ? "row-level security policy" : "42501");
    });
  });
  it("enforces singleton and finite upper timestamp constraints", async () => {
    await rollback(async tx => {
      await denied(tx, "INSERT INTO public.production_reset_state VALUES('other','-infinity')", "23514");
      await denied(tx, "UPDATE public.production_reset_state SET changed_at='infinity'", "23514");
    });
  });
  it("holds the state row lock until an ordinary writer finishes", async () => {
    let ready!: () => void; let resume!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const writer = rollback(async tx => {
      await tx.course.create({ data: { name: randomUUID() } });
      ready(); await release;
    });
    try {
      await Promise.race([started, writer.then(() => { throw new Error("Writer did not reach lock checkpoint"); })]);
      await expect(db!.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
        await tx.$executeRawUnsafe("UPDATE public.production_reset_state SET changed_at=clock_timestamp() WHERE id='school'");
      })).rejects.toThrow("55P03");
    } finally { resume(); await writer; }
  });
  it("rejects a repeatable-read writer after a concurrently committed state change", async () => {
    let ready!: () => void; let resume!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const release = new Promise<void>(resolve => { resume = resolve; });
    const name = randomUUID();
    const writer = db!.$transaction(async tx => {
      await tx.$queryRaw`SELECT changed_at FROM public.production_reset_state`;
      ready(); await release;
      await tx.$executeRaw`INSERT INTO public.courses(id,name,updated_at) VALUES(${randomUUID()}::uuid,${name},now())`;
    }, { isolationLevel: "RepeatableRead" });
    // Attach a rejection handler before releasing the competing writer.
    const rejected = expect(writer).rejects.toThrow("40001");
    try {
      await Promise.race([started, writer]);
      await db!.$executeRaw`UPDATE public.production_reset_state SET changed_at=clock_timestamp() WHERE id='school'`;
    } finally { resume(); }
    await rejected;
    expect(await db!.course.count({ where: { name } })).toBe(0);
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
    return { family, student, teacher, course, level, assignment, availability, enrollment, session, season };
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
