import { Prisma, PrismaClient } from "@prisma/client";
import { minutesFromTime, timeWindowsOverlap } from "@/lib/schedule/validation";

export type RecurringScheduleInput = { enrollmentId: string; teacherId: string; roomId?: string | null; dayOfWeek: number; startTime: string; endTime: string; startsOn: Date; endsOn: Date };
export type ScheduleConflict = { date: Date; type: "teacher" | "student" | "room" | "availability"; message: string; conflictingSessionId?: string };
export type GeneratedLessonPreview = { candidateDates: Date[]; generatedCount: number; closureDatesSkipped: Date[]; existingDatesSkipped: Date[]; conflicts: ScheduleConflict[] };

type DateLimits = { enrollmentStart: Date; enrollmentEnd: Date; seasonStart: Date; seasonEnd: Date };
const dateOnly = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const sameDay = (a: Date, b: Date) => dateOnly(a).getTime() === dateOnly(b).getTime();

/** Generates inclusive weekly dates after intersecting pattern, enrollment, and season bounds. */
export function generateWeeklyDates(input: Pick<RecurringScheduleInput, "dayOfWeek" | "startsOn" | "endsOn">, limits: DateLimits) {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) throw new Error("Weekday must be between Sunday (0) and Saturday (6).");
  const start = dateOnly(new Date(Math.max(dateOnly(input.startsOn).getTime(), dateOnly(limits.enrollmentStart).getTime(), dateOnly(limits.seasonStart).getTime())));
  const end = dateOnly(new Date(Math.min(dateOnly(input.endsOn).getTime(), dateOnly(limits.enrollmentEnd).getTime(), dateOnly(limits.seasonEnd).getTime())));
  if (start > end) return [];
  start.setUTCDate(start.getUTCDate() + (input.dayOfWeek - start.getUTCDay() + 7) % 7);
  const dates: Date[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) dates.push(new Date(cursor));
  return dates;
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function previewRecurringSchedule(db: Db, input: RecurringScheduleInput, patternId?: string): Promise<GeneratedLessonPreview> {
  if (minutesFromTime(input.endTime) <= minutesFromTime(input.startTime)) throw new Error("End time must be after start time.");
  const enrollment = await db.enrollment.findUnique({ where: { id: input.enrollmentId }, include: { season: true } });
  if (!enrollment || enrollment.archivedAt) throw new Error("Enrollment was not found or is archived.");
  const candidateDates = generateWeeklyDates(input, { enrollmentStart: enrollment.enrollmentStartDate, enrollmentEnd: enrollment.enrollmentEndDate, seasonStart: enrollment.season.startDate, seasonEnd: enrollment.season.endDate });
  if (!candidateDates.length) return { candidateDates, generatedCount: 0, closureDatesSkipped: [], existingDatesSkipped: [], conflicts: [] };
  const first = candidateDates[0]; const last = candidateDates[candidateDates.length - 1];
  const [closures, sessions, availability] = await Promise.all([
    db.schoolClosure.findMany({ where: { archivedAt: null, startDate: { lte: last }, endDate: { gte: first } } }),
    db.scheduleSession.findMany({ where: { archivedAt: null, sessionDate: { in: candidateDates }, status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] } }, select: { id: true, sessionDate: true, startTime: true, endTime: true, teacherId: true, studentId: true, roomId: true, schedulePatternId: true } }),
    db.teacherAvailability.findMany({ where: { teacherId: input.teacherId, dayOfWeek: input.dayOfWeek, status: "ACTIVE", archivedAt: null, OR: [{ seasonId: null }, { seasonId: enrollment.seasonId }] } }),
  ]);
  const closureDatesSkipped: Date[] = []; const existingDatesSkipped: Date[] = []; const conflicts: ScheduleConflict[] = [];
  for (const date of candidateDates) {
    if (closures.some((closure) => date >= dateOnly(closure.startDate) && date <= dateOnly(closure.endDate))) { closureDatesSkipped.push(date); continue; }
    if (sessions.some((session) => session.schedulePatternId === patternId && sameDay(session.sessionDate, date))) { existingDatesSkipped.push(date); continue; }
    const window = { startTime: input.startTime, endTime: input.endTime };
    const available = availability.some((rule) => (!rule.effectiveFrom || date >= dateOnly(rule.effectiveFrom)) && (!rule.effectiveTo || date <= dateOnly(rule.effectiveTo)) && minutesFromTime(rule.startTime) <= minutesFromTime(input.startTime) && minutesFromTime(rule.endTime) >= minutesFromTime(input.endTime));
    if (!available) conflicts.push({ date, type: "availability", message: "Teacher is not available for the full lesson window." });
    for (const session of sessions.filter((row) => sameDay(row.sessionDate, date) && timeWindowsOverlap(window, row))) {
      if (session.schedulePatternId === patternId) continue;
      if (session.teacherId === input.teacherId) conflicts.push({ date, type: "teacher", message: "Teacher is already booked.", conflictingSessionId: session.id });
      if (session.studentId === enrollment.studentId) conflicts.push({ date, type: "student", message: "Student is already booked.", conflictingSessionId: session.id });
      if (input.roomId && session.roomId === input.roomId) conflicts.push({ date, type: "room", message: "Room is already booked.", conflictingSessionId: session.id });
    }
  }
  const blocked = new Set(conflicts.map((conflict) => dateOnly(conflict.date).getTime()));
  return { candidateDates, closureDatesSkipped, existingDatesSkipped, conflicts, generatedCount: candidateDates.filter((date) => !closureDatesSkipped.some((closed) => sameDay(closed, date)) && !existingDatesSkipped.some((existing) => sameDay(existing, date)) && !blocked.has(dateOnly(date).getTime())).length };
}

export async function createPatternAndGenerate(prisma: PrismaClient, input: RecurringScheduleInput) {
  return prisma.$transaction(async (tx) => {
    // Validation deliberately runs inside the write transaction: previews are advisory.
    const preview = await previewRecurringSchedule(tx, input);
    if (preview.conflicts.length) throw new Error(`Schedule has ${preview.conflicts.length} unresolved conflict(s).`);
    const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: input.enrollmentId } });
    const pattern = await tx.schedulePattern.create({ data: { ...input, roomId: input.roomId ?? null } });
    const skip = new Set([...preview.closureDatesSkipped, ...preview.existingDatesSkipped].map((date) => dateOnly(date).getTime()));
    const dates = preview.candidateDates.filter((date) => !skip.has(dateOnly(date).getTime()));
    if (dates.length) await tx.scheduleSession.createMany({ data: dates.map((sessionDate) => ({ studentId: enrollment.studentId, teacherId: input.teacherId, enrollmentId: enrollment.id, seasonId: enrollment.seasonId, roomId: input.roomId ?? null, title: enrollment.courseName, sessionDate, startTime: input.startTime, endTime: input.endTime, schedulePatternId: pattern.id })) });
    return { pattern, createdCount: dates.length, preview };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function generateMissingLessons(prisma: PrismaClient, patternId: string) {
  return prisma.$transaction(async (tx) => {
    const pattern = await tx.schedulePattern.findUniqueOrThrow({ where: { id: patternId } });
    if (pattern.status !== "ACTIVE" || pattern.archivedAt) throw new Error("Archived patterns cannot generate lessons.");
    const input: RecurringScheduleInput = pattern;
    const preview = await previewRecurringSchedule(tx, input, pattern.id);
    if (preview.conflicts.length) throw new Error(`Schedule has ${preview.conflicts.length} unresolved conflict(s).`);
    const enrollment = await tx.enrollment.findUniqueOrThrow({ where: { id: pattern.enrollmentId } });
    const skipped = new Set([...preview.closureDatesSkipped, ...preview.existingDatesSkipped].map((date) => dateOnly(date).getTime()));
    const dates = preview.candidateDates.filter((date) => !skipped.has(dateOnly(date).getTime()));
    if (dates.length) await tx.scheduleSession.createMany({ data: dates.map((sessionDate) => ({ studentId: enrollment.studentId, teacherId: pattern.teacherId, enrollmentId: enrollment.id, seasonId: enrollment.seasonId, roomId: pattern.roomId, title: enrollment.courseName, sessionDate, startTime: pattern.startTime, endTime: pattern.endTime, schedulePatternId: pattern.id })), skipDuplicates: true });
    return { createdCount: dates.length, preview };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
