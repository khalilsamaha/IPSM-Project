import { prisma } from "@/lib/prisma";
import { calculateProfitLossCents, estimateTeacherSalaryCents, sumExpenseCents, sumOutstandingCents, sumRevenueCents } from "./calculations";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  seasonId?: string;
  familyId?: string;
  studentId?: string;
  studentCode?: string;
  teacherId?: string;
  courseId?: string;
  levelId?: string;
  roomId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  category?: string;
  includeArchived?: string;
};

const dateRange = (field: "paymentDate" | "expenseDate" | "sessionDate", filters: ReportFilters) => ({
  ...(filters.dateFrom ? { [field]: { gte: new Date(filters.dateFrom) } } : {}),
  ...(filters.dateTo ? { [field]: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } } : {}),
});

const studentWhere = (filters: ReportFilters) => ({
  ...(filters.familyId ? { familyId: filters.familyId } : {}),
  ...(filters.studentCode ? { studentCode: { contains: filters.studentCode, mode: "insensitive" as const } } : {}),
});

const enrollmentWhere = (filters: ReportFilters, includePaymentStatus = false) => ({
  AND: [
    filters.familyId || filters.studentCode ? { student: studentWhere(filters) } : {},
    filters.studentId ? { studentId: filters.studentId } : {},
    filters.seasonId ? { seasonId: filters.seasonId } : {},
    filters.teacherId ? { teacherId: filters.teacherId } : {},
    filters.courseId ? { courseId: filters.courseId } : {},
    filters.levelId ? { levelId: filters.levelId } : {},
    includePaymentStatus && filters.paymentStatus === "paid" ? { remainingCents: 0 } : {},
    includePaymentStatus && filters.paymentStatus === "outstanding" ? { remainingCents: { gt: 0 } } : {},
    includePaymentStatus && filters.paymentStatus === "unpaid" ? { paidCents: 0, remainingCents: { gt: 0 } } : {},
    includePaymentStatus && filters.paymentStatus === "partial" ? { paidCents: { gt: 0 }, remainingCents: { gt: 0 } } : {},
  ],
});

export async function getReportLookups() {
  const [families, students, seasons, teachers, courses, levels, rooms, expenseCategories, paymentMethods] = await Promise.all([
    prisma.family.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, studentCode: true, firstName: true, lastName: true } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.course.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.courseLevel.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.expense.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    prisma.payment.findMany({ distinct: ["paymentMethod"], orderBy: { paymentMethod: "asc" }, select: { paymentMethod: true } }),
  ]);
  return { families, students, seasons, teachers, courses, levels, rooms, expenseCategories, paymentMethods };
}

function matchingItemWhere(filters: ReportFilters) {
  return { enrollment: enrollmentWhere(filters, true) };
}

export async function getRevenueReport(filters: ReportFilters) {
  const rows = await prisma.payment.findMany({
    where: { AND: [dateRange("paymentDate", filters), { voidedAt: null }, filters.familyId ? { familyId: filters.familyId } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}, { items: { some: matchingItemWhere(filters) } }] },
    include: { family: true, items: { where: matchingItemWhere(filters), include: { enrollment: { include: { season: true, student: true, course: true, level: true, teacher: true } } } } },
    orderBy: { paymentDate: "desc" },
  });
  const totalCents = rows.reduce((sum, payment) => sum + payment.items.reduce((itemSum, item) => itemSum + item.amountCents, 0), 0);
  return { rows: rows.map((row) => ({ ...row, reportAmountCents: row.items.reduce((sum, item) => sum + item.amountCents, 0) })), totalCents };
}

export async function getOutstandingReport(filters: ReportFilters) {
  const rows = await prisma.enrollment.findMany({ where: { AND: [enrollmentWhere(filters, true), { remainingCents: { gt: 0 } }] }, include: { student: { include: { family: true } }, season: true, teacher: true, course: true, level: true }, orderBy: [{ season: { startDate: "desc" } }, { student: { lastName: "asc" } }] });
  return { rows, totalCents: sumOutstandingCents(rows) };
}

export async function getExpenseReport(filters: ReportFilters) {
  const season = filters.seasonId ? await prisma.season.findUnique({ where: { id: filters.seasonId } }) : null;
  const seasonExpenseDate = season ? { expenseDate: { gte: season.startDate, lte: season.endDate } } : {};
  const rows = await prisma.expense.findMany({ where: { AND: [filters.includeArchived === "1" ? {} : { archivedAt: null }, dateRange("expenseDate", filters), seasonExpenseDate, filters.category ? { category: filters.category } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}] }, orderBy: { expenseDate: "desc" } });
  return { rows, totalCents: sumExpenseCents(rows, filters.includeArchived === "1") };
}

export async function getProfitLossReport(filters: ReportFilters) { const [revenue, expenses] = await Promise.all([getRevenueReport(filters), getExpenseReport(filters)]); return { revenueCents: revenue.totalCents, expenseCents: expenses.totalCents, netCents: calculateProfitLossCents(revenue.rows.map((r) => ({ ...r, totalAmountCents: r.reportAmountCents })), expenses.rows, filters.includeArchived === "1") }; }

export async function getTeacherSalaryReport(filters: ReportFilters) {
  const rows = await prisma.teacher.findMany({ where: filters.teacherId ? { id: filters.teacherId } : {}, include: { enrollments: { where: enrollmentWhere(filters, true), include: { student: { include: { family: true } }, season: true, course: true, level: true } } }, orderBy: { fullName: "asc" } });
  const mapped = rows.map((teacher) => ({ ...teacher, estimatedHours: null as number | null, estimatedSalaryCents: estimateTeacherSalaryCents(teacher.hourlyRateCents, null) }));
  return { rows: mapped, totalCents: mapped.reduce((sum, teacher) => sum + teacher.estimatedSalaryCents, 0) };
}

export async function getCourseEnrollmentReport(filters: ReportFilters) {
  const enrollments = await prisma.enrollment.findMany({ where: enrollmentWhere(filters, true), include: { student: { include: { family: true } }, season: true, course: true, level: true, teacher: true } });
  const groups = new Map<string, any>();
  for (const e of enrollments) { const courseName = e.course?.name ?? e.courseName; const key = `${e.seasonId}|${e.courseId ?? courseName}|${e.levelId ?? ""}`; const row = groups.get(key) ?? { id: key, season: e.season.name, course: courseName, level: e.level?.name ?? "—", enrollments: 0, students: new Set<string>(), families: new Set<string>(), paidCents: 0, outstandingCents: 0, finalFeeCents: 0 }; row.enrollments++; row.students.add(e.studentId); if (e.student.familyId) row.families.add(e.student.familyId); row.paidCents += e.paidCents; row.outstandingCents += e.remainingCents; row.finalFeeCents += e.finalFeeCents; groups.set(key, row); }
  return { rows: Array.from(groups.values()).map((r) => ({ ...r, students: r.students.size, families: r.families.size })).sort((a, b) => `${a.season} ${a.course}`.localeCompare(`${b.season} ${b.course}`)) };
}

export async function getTeacherScheduleAvailabilityReport(filters: ReportFilters) {
  const teachers = await prisma.teacher.findMany({ where: filters.teacherId ? { id: filters.teacherId } : {}, include: { availability: { where: { AND: [filters.seasonId ? { OR: [{ seasonId: filters.seasonId }, { seasonId: null }] } : {}, { archivedAt: null }, { status: "ACTIVE" }] } }, scheduleSessions: { where: { AND: [dateRange("sessionDate", filters), filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.roomId ? { roomId: filters.roomId } : {}, filters.studentId ? { studentId: filters.studentId } : {}, { archivedAt: null }] }, include: { room: true, season: true } } }, orderBy: { fullName: "asc" } });
  return { rows: teachers.map((t) => ({ id: t.id, teacher: t.fullName, availabilityBlocks: t.availability.length, scheduledSessions: t.scheduleSessions.length, completedSessions: t.scheduleSessions.filter((s) => s.status === "COMPLETED").length, rooms: Array.from(new Set(t.scheduleSessions.map((s) => s.room?.name).filter(Boolean))).join(", ") || "—" })) };
}

export async function getRoomUtilizationReport(filters: ReportFilters) {
  const rooms = await prisma.room.findMany({ where: filters.roomId ? { id: filters.roomId } : {}, include: { scheduleSessions: { where: { AND: [dateRange("sessionDate", filters), filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.teacherId ? { teacherId: filters.teacherId } : {}, filters.studentId ? { studentId: filters.studentId } : {}, { archivedAt: null }] }, include: { teacher: true, season: true } } }, orderBy: { name: "asc" } });
  return { rows: rooms.map((r) => ({ id: r.id, room: r.name, capacity: r.capacity, scheduledSessions: r.scheduleSessions.length, completedSessions: r.scheduleSessions.filter((s) => s.status === "COMPLETED").length, cancelledSessions: r.scheduleSessions.filter((s) => s.status === "CANCELLED").length, teachers: Array.from(new Set(r.scheduleSessions.map((s) => s.teacher.fullName))).join(", ") || "—" })) };
}

export async function getSeasonClosingReport(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found");
  const [enrollments, previousUnpaid, payments, expenses, sessions] = await Promise.all([
    prisma.enrollment.findMany({ where: { seasonId }, include: { student: { include: { family: true } }, season: true, course: true, level: true, teacher: true } }),
    prisma.enrollment.findMany({ where: { season: { startDate: { lt: season.startDate } }, remainingCents: { gt: 0 } }, include: { student: { include: { family: true } }, season: true, course: true } }),
    prisma.payment.findMany({ where: { voidedAt: null, items: { some: { enrollment: { seasonId } } } }, include: { family: true, items: { where: { enrollment: { seasonId } }, include: { enrollment: { include: { student: { include: { family: true } }, season: true } } } } } }),
    prisma.expense.findMany({ where: { archivedAt: null, expenseDate: { gte: season.startDate, lte: season.endDate } } }),
    prisma.scheduleSession.findMany({ where: { seasonId, archivedAt: null }, include: { teacher: true, room: true } }),
  ]);
  const studentIds = new Set(enrollments.map((row) => row.studentId)); const familyIds = new Set(enrollments.map((row) => row.student.familyId).filter(Boolean)); const paymentsReceivedCents = payments.reduce((sum, payment) => sum + payment.items.reduce((itemSum, item) => itemSum + item.amountCents, 0), 0); const outstandingCents = enrollments.reduce((sum, enrollment) => sum + enrollment.remainingCents, 0); const expenseCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const courses = new Map<string, { course: string; enrollments: number; students: Set<string>; amountDueCents: number; paidCents: number; outstandingCents: number }>();
  for (const enrollment of enrollments) { const key = enrollment.course?.name ?? enrollment.courseName; const row = courses.get(key) ?? { course: key, enrollments: 0, students: new Set<string>(), amountDueCents: 0, paidCents: 0, outstandingCents: 0 }; row.enrollments += 1; row.students.add(enrollment.studentId); row.amountDueCents += enrollment.finalFeeCents; row.paidCents += enrollment.paidCents; row.outstandingCents += enrollment.remainingCents; courses.set(key, row); }
  const teachers = new Map<string, { teacher: string; enrollments: number; completedSessions: number; cancelledSessions: number; missedSessions: number }>();
  for (const enrollment of enrollments) if (enrollment.teacher) { const row = teachers.get(enrollment.teacher.id) ?? { teacher: enrollment.teacher.fullName, enrollments: 0, completedSessions: 0, cancelledSessions: 0, missedSessions: 0 }; row.enrollments += 1; teachers.set(enrollment.teacher.id, row); }
  for (const session of sessions) if (session.teacher) { const row = teachers.get(session.teacher.id) ?? { teacher: session.teacher.fullName, enrollments: 0, completedSessions: 0, cancelledSessions: 0, missedSessions: 0 }; if (session.status === "COMPLETED") row.completedSessions += 1; if (session.status === "CANCELLED") row.cancelledSessions += 1; if (session.status === "MISSED") row.missedSessions += 1; teachers.set(session.teacher.id, row); }
  const unpaidEnrollments = enrollments.filter((enrollment) => enrollment.remainingCents > 0);
  return { season, totals: { students: studentIds.size, families: familyIds.size, enrollments: enrollments.length, paymentsReceivedCents, outstandingCents, previousOutstandingCents: previousUnpaid.reduce((s, e) => s + e.remainingCents, 0), expenseCents, profitLossCents: paymentsReceivedCents - expenseCents, completedSessions: sessions.filter((s) => s.status === "COMPLETED").length, cancelledSessions: sessions.filter((s) => s.status === "CANCELLED").length, missedSessions: sessions.filter((s) => s.status === "MISSED").length }, courses: Array.from(courses.values()).map((row) => ({ ...row, students: row.students.size })).sort((a, b) => a.course.localeCompare(b.course)), teachers: Array.from(teachers.values()).sort((a, b) => a.teacher.localeCompare(b.teacher)), unpaidFamilies: Array.from(new Map(unpaidEnrollments.map((e) => [e.student.familyId ?? e.student.id, { family: e.student.family?.name ?? "Independent", outstandingCents: unpaidEnrollments.filter((row) => (row.student.familyId ?? row.student.id) === (e.student.familyId ?? e.student.id)).reduce((sum, row) => sum + row.remainingCents, 0) }])).values()), unpaidStudents: unpaidEnrollments.map((e) => ({ studentCode: e.student.studentCode, student: `${e.student.firstName} ${e.student.lastName}`, family: e.student.family?.name ?? "Independent", season: e.season?.name ?? season.name, course: e.course?.name ?? e.courseName, outstandingCents: e.remainingCents })), previousUnpaidStudents: previousUnpaid.map((e) => ({ studentCode: e.student.studentCode, student: `${e.student.firstName} ${e.student.lastName}`, family: e.student.family?.name ?? "Independent", season: e.season.name, course: e.course?.name ?? e.courseName, outstandingCents: e.remainingCents })) };
}
