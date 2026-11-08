import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { guardInstallSql, guardSql, teacherGuards } from "./helpers/teacher-guard-bodies";

const url = process.env.RESET_TEST_DATABASE_URL;
const db = url ? await createDisposableProductionResetTestClient() : null;
const migration = readFileSync("prisma/migrations/20261107000000_teacher_guard_parity/migration.sql", "utf8");
// Preserve every actual migration statement while allowing fixture rollback.
const parity = migration.replace(/^BEGIN;\n/, "").replace(/\nCOMMIT;\s*$/, "");
function run(sql: string) {
  if (!db) throw new Error("Verified disposable database required");
  return spawnSync("psql", [url!, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
}
const functionNames = teacherGuards.map(g => `'${g.name}'`).join(",");
const snapshot = `SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('xmin',p.xmin::text) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN (${functionNames})),
 'triggers',(SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('xmin',t.xmin::text) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgfoid IN (SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${functionNames})))) AS value`;

describe.skipIf(!url)("exact teacher guard preservation and behavior on disposable PostgreSQL", () => {
  afterAll(async () => { await db?.$disconnect(); });
  it.each(["canonical", "live"] as const)("preserves all %s definitions, attributes, ACLs, OIDs and catalog versions", variant => {
    const hashes = teacherGuards.map(g => `IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.${g.name}()'::regprocedure)<>'${variant === "live" ? g.liveMd5 : g.canonicalMd5}' THEN RAISE EXCEPTION 'PostgreSQL prosrc hash mismatch'; END IF;`).join("\n");
    const result = run(`BEGIN; ${guardInstallSql(variant)}
      DO $$ BEGIN ${hashes} END $$;
      GRANT EXECUTE ON FUNCTION public.validate_schedule_teacher_availability() TO ipsm_fixture_public_reader;
      CREATE TEMP TABLE guard_before AS ${snapshot};
      CREATE FUNCTION public.ipsm_forbid_guard_rewrite() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Existing guard rewrite attempted'; END $$;
      CREATE EVENT TRIGGER ipsm_forbid_guard_rewrite ON ddl_command_start
        WHEN TAG IN ('CREATE FUNCTION','ALTER FUNCTION','DROP FUNCTION','CREATE TRIGGER','ALTER TRIGGER','DROP TRIGGER') EXECUTE FUNCTION public.ipsm_forbid_guard_rewrite();
      ${parity}
      DO $$ BEGIN IF (SELECT value FROM guard_before) IS DISTINCT FROM (${snapshot}) THEN RAISE EXCEPTION 'Guard metadata changed'; END IF; END $$;
      SELECT 'approved-guards-preserved'; ROLLBACK;`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("approved-guards-preserved");
  });
  const guard = "public.validate_schedule_teacher_availability()";
  it.each([
    ["extra comment", guardSql("validate_schedule_teacher_availability", teacherGuards[1].live + "\n-- not reviewed\n"), "Teacher guard differs"],
    ["executable change", guardSql("validate_schedule_teacher_availability", teacherGuards[1].live.replace("ta.start_time <= NEW.start_time", "ta.start_time < NEW.start_time")), "Teacher guard differs"],
    ["security definer", `ALTER FUNCTION ${guard} SECURITY DEFINER`, "Teacher guard differs"],
    ["search path", `ALTER FUNCTION ${guard} SET search_path=public`, "Teacher guard differs"],
    ["volatility", `ALTER FUNCTION ${guard} STABLE`, "Teacher guard differs"],
    ["strict", `ALTER FUNCTION ${guard} STRICT`, "Teacher guard differs"],
    ["parallel", `ALTER FUNCTION ${guard} PARALLEL SAFE`, "Teacher guard differs"],
    ["cost", `ALTER FUNCTION ${guard} COST 101`, "Teacher guard differs"],
    ["owner", `GRANT CREATE ON SCHEMA public TO ipsm_fixture_backend; ALTER FUNCTION ${guard} OWNER TO ipsm_fixture_backend`, "Teacher guard differs"],
    ["overload", "CREATE FUNCTION public.validate_schedule_teacher_availability(integer) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$", "Unreviewed teacher guard overload"],
    ["disabled trigger", "ALTER TABLE public.schedule_sessions DISABLE TRIGGER schedule_teacher_availability_guard", "Teacher guard trigger differs"],
    ["missing trigger", "DROP TRIGGER schedule_teacher_availability_guard ON public.schedule_sessions", "Teacher guard trigger differs"],
    ["conditional trigger", "DROP TRIGGER schedule_teacher_availability_guard ON public.schedule_sessions; CREATE TRIGGER schedule_teacher_availability_guard BEFORE INSERT OR UPDATE OF enrollment_id,teacher_id,session_date,start_time,end_time ON public.schedule_sessions FOR EACH ROW WHEN (NEW.enrollment_id IS NOT NULL) EXECUTE FUNCTION public.validate_schedule_teacher_availability()", "Teacher guard trigger differs"],
    ["missing enrollment prerequisite", "DROP FUNCTION public.validate_enrollment_teacher_availability() CASCADE", "Teacher guard prerequisite missing"],
    ["enum variant", "ALTER TYPE public.\"TeacherCompensationBasis\" ADD VALUE 'UNREVIEWED'", "Teacher parity enum differs"],
    ["column default", "ALTER TABLE public.teachers ALTER COLUMN session_unit_minutes SET DEFAULT 60", "Teacher parity column differs"],
    ["column nullability", "ALTER TABLE public.teachers ALTER COLUMN session_unit_minutes DROP NOT NULL", "Teacher parity column differs"],
    ["column type", "ALTER TABLE public.teachers ALTER COLUMN session_rate_cents TYPE bigint", "Teacher parity column differs"],
    ["snapshot default", "ALTER TABLE public.teacher_payrolls ALTER COLUMN rate_unit_minutes_snapshot SET DEFAULT 60", "Teacher parity column differs"],
    ["check expression", "ALTER TABLE public.teachers DROP CONSTRAINT teachers_session_unit_positive; ALTER TABLE public.teachers ADD CONSTRAINT teachers_session_unit_positive CHECK(session_unit_minutes >= 0)", "Teacher parity constraint differs"],
    ["unvalidated check", "ALTER TABLE public.teachers DROP CONSTRAINT teachers_session_unit_positive; ALTER TABLE public.teachers ADD CONSTRAINT teachers_session_unit_positive CHECK(session_unit_minutes > 0) NOT VALID", "Teacher parity constraint differs"],
    ["FK action", "ALTER TABLE public.teacher_availability DROP CONSTRAINT teacher_availability_course_id_fkey; ALTER TABLE public.teacher_availability ADD CONSTRAINT teacher_availability_course_id_fkey FOREIGN KEY(course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE SET NULL", "Teacher parity constraint differs"],
    ["ordinary index keys", "DROP INDEX public.teacher_availability_course_id_idx; CREATE INDEX teacher_availability_course_id_idx ON public.teacher_availability(teacher_id)", "Teacher parity index differs"],
    ["partial uniqueness", "DROP INDEX public.teacher_courses_teacher_course_all_levels_key; CREATE INDEX teacher_courses_teacher_course_all_levels_key ON public.teacher_courses(teacher_id,course_id) WHERE level_id IS NULL", "Teacher parity index differs"],
  ])("rejects %s rather than rewriting or silently accepting it", (_name, change, message) => {
    const result = run(`BEGIN; ${change}; ${parity} COMMIT;`);
    expect(result.status, result.stderr).toBe(3);
    expect(result.stderr).toContain(message);
    // Connection exit must have rolled back both injected drift and migration DDL.
    const clean = run(`BEGIN; ${parity} ROLLBACK;`);
    expect(clean.status, clean.stderr).toBe(0);
  });
  it("adds only missing non-function parity objects with the reviewed definitions", () => {
    const result = run(`BEGIN;
      ALTER TABLE public.teacher_payroll_items DROP COLUMN rate_unit_minutes_snapshot;
      ALTER TABLE public.teachers DROP CONSTRAINT teachers_rates_nonnegative;
      DROP INDEX public.teacher_courses_teacher_course_all_levels_key;
      ${parity}
      SELECT count(*) FROM pg_constraint WHERE conrelid='public.teachers'::regclass AND conname='teachers_rates_nonnegative' AND convalidated;
      ROLLBACK;`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("1");
  });

  async function fixture(tx: Prisma.TransactionClient) {
    const family = await tx.family.create({ data: { familyCode: `guard-${randomUUID()}`, name: "Guard fixture" } });
    const student = await tx.student.create({ data: { familyId: family.id, studentCode: `guard-${randomUUID()}`, firstName: "Guard", lastName: "Fixture" } });
    const season = await tx.season.create({ data: { name: randomUUID(), startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
    const otherSeason = await tx.season.create({ data: { name: randomUUID(), startDate: season.startDate, endDate: season.endDate } });
    const teacher = await tx.teacher.create({ data: { fullName: "Guard fixture" } });
    const otherTeacher = await tx.teacher.create({ data: { fullName: "Other fixture" } });
    const course = await tx.course.create({ data: { name: randomUUID() } });
    const otherCourse = await tx.course.create({ data: { name: randomUUID() } });
    const level = await tx.courseLevel.create({ data: { name: randomUUID() } });
    const otherLevel = await tx.courseLevel.create({ data: { name: randomUUID() } });
    const assignment = await tx.teacherCourse.create({ data: { teacherId: teacher.id, courseId: course.id } });
    await tx.teacherCourse.create({ data: { teacherId: teacher.id, courseId: otherCourse.id } });
    const availability = await tx.teacherAvailability.create({ data: { teacherId: teacher.id, courseId: course.id, seasonId: season.id, dayOfWeek: 1, startTime: "09:00", endTime: "12:00", effectiveFrom: new Date("2026-06-01"), effectiveTo: new Date("2026-06-30") } });
    const enrollment = await tx.enrollment.create({ data: { studentId: student.id, teacherId: teacher.id, seasonId: season.id, courseId: course.id, levelId: level.id, courseName: "Guard fixture", enrollmentStartDate: season.startDate, enrollmentEndDate: season.endDate } });
    const session = await tx.scheduleSession.create({ data: { studentId: student.id, teacherId: teacher.id, enrollmentId: enrollment.id, seasonId: season.id, sessionDate: new Date("2026-06-01"), startTime: "09:00", endTime: "12:00" } });
    return { season, otherSeason, teacher, otherTeacher, course, otherCourse, level, otherLevel, assignment, availability, enrollment, session };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  type Case = { name: string; table: "enrollments" | "schedule_sessions" | "teacher_availability"; change: string | ((f: Fixture) => string); accepted: boolean; error?: string; setup?: (tx: Prisma.TransactionClient, f: Fixture) => Promise<unknown> };
  const cases: Case[] = [
    { name: "enrollment full season with June-only occurrence", table: "enrollments", change: "teacher_id=teacher_id", accepted: true },
    { name: "enrollment single valid weekday boundary", table: "enrollments", change: "enrollment_start_date='2026-06-01',enrollment_end_date='2026-06-01'", accepted: true },
    { name: "enrollment no weekday occurrence", table: "enrollments", change: "enrollment_start_date='2026-06-02',enrollment_end_date='2026-06-02'", accepted: false, error: "No teacher availability occurrence" },
    { name: "enrollment no effective-date overlap", table: "enrollments", change: "enrollment_start_date='2026-05-01',enrollment_end_date='2026-05-31'", accepted: false, error: "No teacher availability occurrence" },
    { name: "enrollment before season", table: "enrollments", change: "enrollment_start_date='2025-12-31'", accepted: false, error: "dates must remain inside" },
    { name: "enrollment after season", table: "enrollments", change: "enrollment_end_date='2027-01-01'", accepted: false, error: "dates must remain inside" },
    { name: "NULL teacher early return", table: "enrollments", change: "teacher_id=NULL,enrollment_start_date='2025-12-31'", accepted: true },
    { name: "NULL course with assigned teacher", table: "enrollments", change: "course_id=NULL", accepted: false, error: "not actively assigned" },
    { name: "NULL level with all-level assignment", table: "enrollments", change: "level_id=NULL", accepted: true },
    { name: "exact-level assignment", table: "enrollments", change: "teacher_id=teacher_id", accepted: true, setup: (tx,f) => tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { levelId: f.level.id } }) },
    { name: "different level", table: "enrollments", change: "teacher_id=teacher_id", accepted: false, error: "not actively assigned", setup: (tx,f) => tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { levelId: f.otherLevel.id } }) },
    { name: "archived assignment status", table: "enrollments", change: "teacher_id=teacher_id", accepted: false, error: "not actively assigned", setup: (tx,f) => tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { status: "ARCHIVED" } }) },
    { name: "archived assignment timestamp", table: "enrollments", change: "teacher_id=teacher_id", accepted: false, error: "not actively assigned", setup: (tx,f) => tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { archivedAt: new Date() } }) },
    { name: "unassigned teacher", table: "enrollments", change: f => `teacher_id='${f.otherTeacher.id}'`, accepted: false, error: "not actively assigned" },
    { name: "schedule inclusive time bounds", table: "schedule_sessions", change: "start_time='09:00',end_time='12:00'", accepted: true },
    { name: "schedule inner time window", table: "schedule_sessions", change: "start_time='09:30',end_time='11:30'", accepted: true },
    { name: "schedule early start", table: "schedule_sessions", change: "start_time='08:59'", accepted: false, error: "Teacher is not available" },
    { name: "schedule late end", table: "schedule_sessions", change: "end_time='12:01'", accepted: false, error: "Teacher is not available" },
    { name: "schedule wrong weekday", table: "schedule_sessions", change: "session_date='2026-06-02'", accepted: false, error: "Teacher is not available" },
    { name: "schedule before effective date", table: "schedule_sessions", change: "session_date='2026-05-25'", accepted: false, error: "Teacher is not available" },
    { name: "schedule after effective date", table: "schedule_sessions", change: "session_date='2026-07-06'", accepted: false, error: "Teacher is not available" },
    { name: "schedule effective-to inclusive", table: "schedule_sessions", change: "session_date='2026-06-01'", accepted: true, setup: (tx,f) => tx.teacherAvailability.update({ where: { id: f.availability.id }, data: { effectiveTo: new Date("2026-06-01") } }) },
    { name: "NULL enrollment early return", table: "schedule_sessions", change: "enrollment_id=NULL,start_time='08:00'", accepted: true },
    { name: "NULL session season uses enrollment scope", table: "schedule_sessions", change: "season_id=NULL,start_time=start_time", accepted: true },
    { name: "cancelled archived session still validates time", table: "schedule_sessions", change: "status='CANCELLED',archived_at=now(),start_time='08:00'", accepted: false, error: "Teacher is not available" },
    { name: "schedule teacher without availability", table: "schedule_sessions", change: f => `teacher_id='${f.otherTeacher.id}'`, accepted: false, error: "Teacher is not available" },
    { name: "schedule does not recheck assignment", table: "schedule_sessions", change: "start_time=start_time", accepted: true, setup: (tx,f) => tx.teacherCourse.update({ where: { id: f.assignment.id }, data: { status: "ARCHIVED" } }) },
    { name: "schedule does not enforce enrollment period", table: "schedule_sessions", change: "session_date='2026-06-08'", accepted: true, setup: (tx,f) => tx.enrollment.update({ where: { id: f.enrollment.id }, data: { enrollmentStartDate: new Date("2026-06-01"), enrollmentEndDate: new Date("2026-06-01") } }) },
    { name: "seasonal availability requires dates", table: "teacher_availability", change: "effective_from=NULL", accepted: false, error: "requires both effective dates" },
    { name: "seasonal availability rejects reversed dates", table: "teacher_availability", change: "effective_to='2026-05-31'", accepted: false, error: "must remain inside" },
    { name: "seasonal availability rejects out-of-season dates", table: "teacher_availability", change: "effective_to='2027-01-01'", accepted: false, error: "must remain inside" },
    { name: "global availability permits NULL dates", table: "teacher_availability", change: "season_id=NULL,course_id=NULL,effective_from=NULL,effective_to=NULL", accepted: true },
    { name: "availability rejects unassigned teacher", table: "teacher_availability", change: f => `teacher_id='${f.otherTeacher.id}'`, accepted: false, error: "not actively assigned" },
  ];
  for (const table of ["enrollments", "schedule_sessions"] as const) {
    for (const kind of ["archived status", "archived timestamp", "different course", "different season", "global"] as const) {
      cases.push({ name: `${table} availability: ${kind}`, table, change: table === "enrollments" ? "teacher_id=teacher_id" : "start_time=start_time", accepted: kind === "global", error: table === "enrollments" ? "No teacher availability occurrence" : "Teacher is not available", setup: (tx,f) => tx.teacherAvailability.update({ where: { id: f.availability.id }, data: kind === "archived status" ? { status: "ARCHIVED" } : kind === "archived timestamp" ? { archivedAt: new Date() } : kind === "different course" ? { courseId: f.otherCourse.id } : kind === "different season" ? { seasonId: f.otherSeason.id } : { courseId: null, seasonId: null, effectiveFrom: null, effectiveTo: null } }) });
    }
  }
  async function outcome(variant: "canonical" | "live", scenario: Case) {
    const done = new Error("fixture rollback");
    let result = { accepted: false, code: "", message: "" };
    try {
      await db!.$transaction(async tx => {
        for (const guard of teacherGuards) {
          await tx.$executeRawUnsafe(guardSql(guard.name, guard[variant]));
          const [hash] = await tx.$queryRawUnsafe<Array<{ hash: string }>>(`SELECT md5(prosrc) AS hash FROM pg_proc WHERE oid='public.${guard.name}()'::regprocedure`);
          expect(hash.hash).toBe(variant === "live" ? guard.liveMd5 : guard.canonicalMd5);
        }
        const f = await fixture(tx);
        await scenario.setup?.(tx,f);
        await tx.$executeRawUnsafe("SAVEPOINT guard_probe");
        const id = scenario.table === "enrollments" ? f.enrollment.id : scenario.table === "schedule_sessions" ? f.session.id : f.availability.id;
        try {
          await tx.$executeRawUnsafe(`UPDATE public.${scenario.table} SET ${typeof scenario.change === "string" ? scenario.change : scenario.change(f)} WHERE id='${id}'`);
          result.accepted = true;
        } catch (error) {
          const meta = (error as { meta?: { code?: string; message?: string } }).meta;
          result = { accepted: false, code: meta?.code ?? "missing", message: meta?.message ?? String(error) };
        }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT guard_probe");
        throw done;
      });
    } catch (error) { if (error !== done) throw error; }
    return result;
  }
  it.each(cases)("identical canonical/live behavior: $name", async scenario => {
    const canonical = await outcome("canonical", scenario);
    const live = await outcome("live", scenario);
    expect(live).toEqual(canonical);
    expect(live.accepted).toBe(scenario.accepted);
    if (!scenario.accepted) {
      expect(live.code).toBe("P0001");
      expect(live.message).toContain(scenario.error);
    }
  });
});
