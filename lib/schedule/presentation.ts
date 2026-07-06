import { minutesFromTime, timeWindowsOverlap, type TimeWindow } from "./validation";

export type LessonLike = {
  id: string;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  status: string;
  studentId: string;
  teacherId?: string | null;
  roomId?: string | null;
  seasonId?: string | null;
  enrollmentId?: string | null;
  student?: { id: string; studentCode?: string | null; firstName: string; lastName: string; family?: { name: string } | null } | null;
  teacher?: { id: string; fullName: string } | null;
  room?: { id: string; name: string } | null;
  season?: { id: string; name: string } | null;
  enrollment?: {
    id: string;
    studentId: string;
    teacherId?: string | null;
    seasonId?: string | null;
    courseName?: string | null;
    status?: string | null;
    enrollmentStartDate?: Date | null;
    enrollmentEndDate?: Date | null;
    course?: { id: string; name: string } | null;
    level?: { name: string } | null;
    season?: { id: string; name: string; startDate?: Date; endDate?: Date } | null;
    teacher?: { id: string; fullName: string } | null;
  } | null;
};

export type EnrollmentLike = {
  id: string;
  studentId: string;
  teacherId?: string | null;
  seasonId?: string | null;
  enrollmentStartDate: Date;
  enrollmentEndDate: Date;
  courseName?: string | null;
  course?: { name: string } | null;
  level?: { name: string } | null;
  season?: { id: string; name: string; startDate: Date; endDate: Date } | null;
  teacher?: { id: string; fullName: string } | null;
};

export function lessonInstrument(row: LessonLike) {
  return row.enrollment?.course?.name ?? row.enrollment?.courseName ?? "Unassigned instrument";
}

export function lessonLevel(row: LessonLike) {
  return row.enrollment?.level?.name ?? "—";
}

export function lessonHours(row: Pick<LessonLike, "startTime" | "endTime">) {
  return Math.max(0, (minutesFromTime(row.endTime) - minutesFromTime(row.startTime)) / 60);
}

export function groupLessonsByTeacher(rows: LessonLike[]) {
  return Object.values(rows.reduce<Record<string, { teacherId: string; teacherName: string; lessons: LessonLike[]; totalHours: number }>>((acc, row) => {
    const teacherId = row.teacher?.id ?? row.teacherId ?? "unassigned";
    const teacherName = row.teacher?.fullName ?? "Unassigned teacher";
    acc[teacherId] ??= { teacherId, teacherName, lessons: [], totalHours: 0 };
    acc[teacherId].lessons.push(row);
    acc[teacherId].totalHours += lessonHours(row);
    return acc;
  }, {})).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
}

export function filterLessonsForInstrument(rows: LessonLike[], instrument: string) {
  const normalized = instrument.trim().toLowerCase();
  if (!normalized) return [];
  return rows.filter((row) => lessonInstrument(row).toLowerCase() === normalized || row.enrollment?.course?.id === instrument);
}

export function filterLessonsForStudent(rows: LessonLike[], studentId: string) {
  return rows.filter((row) => row.studentId === studentId || row.student?.id === studentId);
}

export function filterEnrollmentsForStudent(enrollments: EnrollmentLike[], studentId: string) {
  return enrollments.filter((enrollment) => enrollment.studentId === studentId);
}

export function deriveBookingFromEnrollment(enrollment: EnrollmentLike) {
  if (!enrollment.teacherId) throw new Error("This enrollment has no teacher assigned. Please edit the enrollment and assign a teacher before booking lessons.");
  return { studentId: enrollment.studentId, enrollmentId: enrollment.id, seasonId: enrollment.seasonId ?? enrollment.season?.id ?? null, teacherId: enrollment.teacherId };
}

export function bookingDateRange(enrollment: EnrollmentLike) {
  const seasonStart = enrollment.season?.startDate ?? enrollment.enrollmentStartDate;
  const seasonEnd = enrollment.season?.endDate ?? enrollment.enrollmentEndDate;
  return {
    min: seasonStart > enrollment.enrollmentStartDate ? seasonStart : enrollment.enrollmentStartDate,
    max: seasonEnd < enrollment.enrollmentEndDate ? seasonEnd : enrollment.enrollmentEndDate,
  };
}

export function assertNoLessonConflict(existing: LessonLike[], candidate: LessonLike, resource: "teacher" | "student" | "room") {
  const sameDate = (date: Date) => date.toISOString().slice(0, 10) === candidate.sessionDate.toISOString().slice(0, 10);
  const hasConflict = existing.some((row) => {
    if (!sameDate(row.sessionDate) || row.id === candidate.id || row.status === "CANCELLED") return false;
    if (resource === "teacher" && row.teacherId !== candidate.teacherId) return false;
    if (resource === "student" && row.studentId !== candidate.studentId) return false;
    if (resource === "room" && (!candidate.roomId || row.roomId !== candidate.roomId)) return false;
    return timeWindowsOverlap(row as TimeWindow, candidate as TimeWindow);
  });
  if (hasConflict) throw new Error(`${resource[0].toUpperCase()}${resource.slice(1)} is already booked.`);
}

export function groupSeasonLessons(rows: LessonLike[], groupBy: "date" | "teacher" | "room" | "instrument" = "date") {
  return rows.reduce<Record<string, LessonLike[]>>((acc, row) => {
    const key = groupBy === "date" ? row.sessionDate.toISOString().slice(0, 10) : groupBy === "teacher" ? row.teacher?.fullName ?? "Unassigned teacher" : groupBy === "room" ? row.room?.name ?? "No room" : lessonInstrument(row);
    acc[key] ??= [];
    acc[key].push(row);
    acc[key].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime() || a.startTime.localeCompare(b.startTime));
    return acc;
  }, {});
}
