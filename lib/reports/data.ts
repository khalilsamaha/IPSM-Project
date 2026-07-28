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

let lookupCache: { expires: number; value: Awaited<ReturnType<typeof loadReportLookupsUncached>> } | null = null;

async function loadReportLookupsUncached() {
  const families = await prisma.family.findMany({ orderBy: { name: "asc" }, select: { id: true, familyCode: true, name: true } });
  const students = await prisma.student.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, studentCode: true, firstName: true, lastName: true } });
  const seasons = await prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } });
  const teachers = await prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } });
  const courses = await prisma.course.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const levels = await prisma.courseLevel.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const rooms = await prisma.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const expenseCategories = await prisma.expense.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } });
  const paymentMethods = await prisma.payment.findMany({ distinct: ["paymentMethod"], orderBy: { paymentMethod: "asc" }, select: { paymentMethod: true } });
  return { families, students, seasons, teachers, courses, levels, rooms, expenseCategories, paymentMethods };
}

export async function getReportLookups() {
  if (lookupCache && lookupCache.expires > Date.now()) return lookupCache.value;
  const value = await loadReportLookupsUncached();
  lookupCache = { value, expires: Date.now() + 60_000 };
  return value;
}

function matchingItemWhere(filters: ReportFilters) {
  return { enrollment: enrollmentWhere(filters, true) };
}

export async function getRevenueReport(filters: ReportFilters) {
  const rows = await prisma.payment.findMany({
    where: { AND: [dateRange("paymentDate", filters), { voidedAt: null }, filters.familyId ? { familyId: filters.familyId } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}, { items: { some: matchingItemWhere(filters) } }] },
    include: { family: true, items: { where: matchingItemWhere(filters), include: { enrollment: { include: { season: true, course: true, level: true, teacher: true } } } } },
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

export async function getCourseEnrollmentReport(filters: ReportFilters & Partial<ReportPagination>) {
  const where = enrollmentWhere(filters, true);
  const totalRows = await prisma.enrollment.count({ where });
  const totals = await prisma.enrollment.aggregate({ where, _sum: { paidCents: true, remainingCents: true, finalFeeCents: true } });
  const enrollments = await prisma.enrollment.findMany({ where, select: { id: true, studentId: true, paidCents: true, remainingCents: true, finalFeeCents: true, student: { select: { familyId: true } }, season: { select: { name: true } }, course: { select: { name: true } }, courseName: true, level: { select: { name: true } } }, orderBy: [{ season: { startDate: "desc" } }, { courseName: "asc" }], skip: filters.skip ?? 0, take: filters.take ?? 25 });
  const rows = enrollments.map((e) => ({ id: e.id, season: e.season?.name ?? "No season", course: e.course?.name ?? e.courseName, level: e.level?.name ?? "—", enrollments: 1, students: 1, families: e.student.familyId ? 1 : 0, paidCents: e.paidCents, outstandingCents: e.remainingCents, finalFeeCents: e.finalFeeCents }));
  return { rows, totalRows, totalCents: totals._sum.finalFeeCents ?? 0, summary: { paidCents: totals._sum.paidCents ?? 0, outstandingCents: totals._sum.remainingCents ?? 0 } };
}

export async function getTeacherScheduleAvailabilityReport(filters: ReportFilters & Partial<ReportPagination>) {
  const where = filters.teacherId ? { id: filters.teacherId } : {};
  const totalRows = await prisma.teacher.count({ where });
  const teachers = await prisma.teacher.findMany({ where, select: { id: true, fullName: true, availability: { where: { AND: [filters.seasonId ? { OR: [{ seasonId: filters.seasonId }, { seasonId: null }] } : {}, { archivedAt: null }, { status: "ACTIVE" }] }, select: { id: true } }, scheduleSessions: { where: { AND: [dateRange("sessionDate", filters), filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.roomId ? { roomId: filters.roomId } : {}, filters.studentId ? { studentId: filters.studentId } : {}, { archivedAt: null }] }, select: { status: true, room: { select: { name: true } } } } }, orderBy: { fullName: "asc" }, skip: filters.skip ?? 0, take: filters.take ?? 25 });
  return { totalRows, rows: teachers.map((t) => ({ id: t.id, teacher: t.fullName, availabilityBlocks: t.availability.length, scheduledSessions: t.scheduleSessions.length, completedSessions: t.scheduleSessions.filter((s) => s.status === "COMPLETED").length, rooms: Array.from(new Set(t.scheduleSessions.map((s) => s.room?.name ?? "No room"))).join(", ") || "No room" })) };
}

export async function getRoomUtilizationReport(filters: ReportFilters & Partial<ReportPagination>) {
  const where = filters.roomId ? { id: filters.roomId } : {};
  const totalRows = await prisma.room.count({ where });
  const rooms = await prisma.room.findMany({ where, select: { id: true, name: true, capacity: true, scheduleSessions: { where: { AND: [dateRange("sessionDate", filters), filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.teacherId ? { teacherId: filters.teacherId } : {}, filters.studentId ? { studentId: filters.studentId } : {}, { archivedAt: null }] }, select: { status: true, teacher: { select: { fullName: true } } } } }, orderBy: { name: "asc" }, skip: filters.skip ?? 0, take: filters.take ?? 25 });
  return { totalRows, rows: rooms.map((r) => ({ id: r.id, room: r.name, capacity: r.capacity, scheduledSessions: r.scheduleSessions.length, completedSessions: r.scheduleSessions.filter((s) => s.status === "COMPLETED").length, cancelledSessions: r.scheduleSessions.filter((s) => s.status === "CANCELLED").length, teachers: Array.from(new Set(r.scheduleSessions.map((s) => s.teacher?.fullName ?? "Unassigned"))).join(", ") || "—" })) };
}


export type SeasonClosingSummary = {
  season: { id: string; name: string; startDate: Date; endDate: Date; status: string };
  totals: {
    students: number; families: number; enrollments: number; paymentsReceivedCents: number; outstandingCents: number; previousOutstandingCents: number; expenseCents: number; profitLossCents: number; completedSessions: number; cancelledSessions: number; missedSessions: number;
  };
  courses: { course: string; students: number; enrollments: number; amountDueCents: number; paidCents: number; outstandingCents: number }[];
  teachers: { teacher: string; enrollments: number; completedSessions: number; cancelledSessions: number; missedSessions: number }[];
  unpaidFamilies: { family: string; outstandingCents: number }[];
  unpaidStudents: { studentCode: string; student: string; family: string; season: string; course: string; outstandingCents: number }[];
  previousUnpaidStudents: { studentCode: string; student: string; family: string; season: string; course: string; outstandingCents: number }[];
};

export type ReportResult = { rows: any[]; totalRows: number; summary: Record<string, unknown> | SeasonClosingSummary | null; errorMessage?: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const missingSeasonMessage = "The selected season could not be found. It may have been deleted.";

function safeStudentName(student?: { firstName?: string | null; lastName?: string | null } | null) {
  const name = [student?.firstName, student?.lastName].filter(Boolean).join(" ").trim();
  return name || "Unknown student";
}
export async function getSeasonClosingReport(seasonId: string): Promise<SeasonClosingSummary | null> {
  if (!uuidPattern.test(seasonId)) return null;
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return null;
  const enrollments = await prisma.enrollment.findMany({ where: { seasonId }, select: { id: true, studentId: true, seasonId: true, courseId: true, levelId: true, teacherId: true, courseName: true, finalFeeCents: true, paidCents: true, remainingCents: true, student: { select: { id: true, studentCode: true, firstName: true, lastName: true, familyId: true, family: { select: { id: true, name: true } } } }, season: { select: { name: true } }, course: { select: { name: true } }, level: { select: { name: true } }, teacher: { select: { id: true, fullName: true } } } });
  const previousUnpaid = await prisma.enrollment.findMany({ where: { season: { startDate: { lt: season.startDate } }, remainingCents: { gt: 0 } }, select: { remainingCents: true, courseName: true, student: { select: { studentCode: true, firstName: true, lastName: true, familyId: true, family: { select: { name: true } } } }, season: { select: { name: true } }, course: { select: { name: true } } } });
  const payments = await prisma.payment.findMany({ where: { voidedAt: null, items: { some: { enrollment: { seasonId } } } }, select: { id: true, items: { where: { enrollment: { seasonId } }, select: { amountCents: true } } } });
  const expenses = await prisma.expense.findMany({ where: { archivedAt: null, expenseDate: { gte: season.startDate, lte: season.endDate } }, select: { amountCents: true } });
  const sessions = await prisma.scheduleSession.findMany({ where: { seasonId, archivedAt: null }, select: { status: true, teacher: { select: { id: true, fullName: true } }, room: { select: { id: true, name: true } } } });
  const studentIds = new Set(enrollments.map((row) => row.studentId).filter(Boolean)); const familyIds = new Set(enrollments.map((row) => row.student?.familyId).filter(Boolean)); const paymentsReceivedCents = payments.reduce((sum, payment) => sum + payment.items.reduce((itemSum, item) => itemSum + item.amountCents, 0), 0); const outstandingCents = enrollments.reduce((sum, enrollment) => sum + enrollment.remainingCents, 0); const expenseCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const courses = new Map<string, { course: string; enrollments: number; students: Set<string>; amountDueCents: number; paidCents: number; outstandingCents: number }>();
  for (const enrollment of enrollments) { const key = enrollment.course?.name ?? enrollment.courseName ?? "No activity"; const row = courses.get(key) ?? { course: key, enrollments: 0, students: new Set<string>(), amountDueCents: 0, paidCents: 0, outstandingCents: 0 }; row.enrollments += 1; if (enrollment.studentId) row.students.add(enrollment.studentId); row.amountDueCents += enrollment.finalFeeCents; row.paidCents += enrollment.paidCents; row.outstandingCents += enrollment.remainingCents; courses.set(key, row); }
  const teachers = new Map<string, { teacher: string; enrollments: number; completedSessions: number; cancelledSessions: number; missedSessions: number }>();
  for (const enrollment of enrollments) if (enrollment.teacher) { const row = teachers.get(enrollment.teacher.id) ?? { teacher: enrollment.teacher.fullName ?? "Unassigned", enrollments: 0, completedSessions: 0, cancelledSessions: 0, missedSessions: 0 }; row.enrollments += 1; teachers.set(enrollment.teacher.id, row); }
  for (const session of sessions) if (session.teacher) { const row = teachers.get(session.teacher.id) ?? { teacher: session.teacher.fullName ?? "Unassigned", enrollments: 0, completedSessions: 0, cancelledSessions: 0, missedSessions: 0 }; if (session.status === "COMPLETED") row.completedSessions += 1; if (session.status === "CANCELLED") row.cancelledSessions += 1; if (session.status === "MISSED") row.missedSessions += 1; teachers.set(session.teacher.id, row); }
  const unpaidEnrollments = enrollments.filter((enrollment) => enrollment.remainingCents > 0);
  return { season, totals: { students: studentIds.size, families: familyIds.size, enrollments: enrollments.length, paymentsReceivedCents, outstandingCents, previousOutstandingCents: previousUnpaid.reduce((s, e) => s + e.remainingCents, 0), expenseCents, profitLossCents: paymentsReceivedCents - expenseCents, completedSessions: sessions.filter((s) => s.status === "COMPLETED").length, cancelledSessions: sessions.filter((s) => s.status === "CANCELLED").length, missedSessions: sessions.filter((s) => s.status === "MISSED").length }, courses: Array.from(courses.values()).map((row) => ({ ...row, students: row.students.size })).sort((a, b) => a.course.localeCompare(b.course)), teachers: Array.from(teachers.values()).sort((a, b) => a.teacher.localeCompare(b.teacher)), unpaidFamilies: Array.from(new Map(unpaidEnrollments.map((e) => [e.student?.familyId ?? e.student?.id ?? e.studentId, { family: e.student?.family?.name ?? "Independent", outstandingCents: unpaidEnrollments.filter((row) => (row.student?.familyId ?? row.student?.id ?? row.studentId) === (e.student?.familyId ?? e.student?.id ?? e.studentId)).reduce((sum, row) => sum + row.remainingCents, 0) }])).values()), unpaidStudents: unpaidEnrollments.map((e) => ({ studentCode: e.student?.studentCode ?? "—", student: safeStudentName(e.student), family: e.student?.family?.name ?? "Independent", season: e.season?.name ?? season.name ?? "Unknown season", course: e.course?.name ?? e.courseName ?? "No activity", outstandingCents: e.remainingCents })), previousUnpaidStudents: previousUnpaid.map((e) => ({ studentCode: e.student?.studentCode ?? "—", student: safeStudentName(e.student), family: e.student?.family?.name ?? "Independent", season: (e.season?.name ?? "Unknown season"), course: e.course?.name ?? e.courseName ?? "No activity", outstandingCents: e.remainingCents })) };
}


export async function getPayrollReport(filters: ReportFilters & Partial<ReportPagination>) {
  const where = { AND: [filters.teacherId ? { teacherId: filters.teacherId } : {}, filters.dateFrom ? { periodEnd: { gte: new Date(filters.dateFrom) } } : {}, filters.dateTo ? { periodStart: { lte: new Date(filters.dateTo) } } : {}, filters.paymentStatus ? { status: filters.paymentStatus as any } : {}] };
  const totalRows = await prisma.teacherPayroll.count({ where });
  const total = await prisma.teacherPayroll.aggregate({ where, _sum: { grossAmountCents: true } });
  const rows = await prisma.teacherPayroll.findMany({ where, select: { id: true, periodStart: true, periodEnd: true, completedMinutes: true, missedPayableMinutes: true, adjustmentCents: true, grossAmountCents: true, status: true, teacher: { select: { fullName: true } } }, orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }], skip: filters.skip ?? 0, take: filters.take ?? 25 });
  return { totalRows, rows: rows.map((row) => ({ id: row.id, teacher: row.teacher?.fullName ?? "Unassigned", periodStart: row.periodStart, periodEnd: row.periodEnd, lessonHours: (row.completedMinutes + row.missedPayableMinutes) / 60, completedHours: row.completedMinutes / 60, missedHours: row.missedPayableMinutes / 60, adjustmentCents: row.adjustmentCents, grossAmountCents: row.grossAmountCents, status: row.status })), totalCents: total._sum.grossAmountCents ?? 0 };
}


export type LoadReportKind = "revenue" | "expenses" | "profit-loss" | "outstanding" | "season-closing" | "course-enrollment" | "teacher-schedule" | "room-utilization" | "payroll";
export type ReportPagination = { skip: number; take: number };

export async function getReportDashboardSummary(filters: ReportFilters) {
  const revenueWhere = { AND: [dateRange("paymentDate", filters), { voidedAt: null }, filters.familyId ? { familyId: filters.familyId } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}, { items: { some: matchingItemWhere(filters) } }] };
  const revenue = await prisma.payment.aggregate({ where: revenueWhere, _sum: { totalAmountCents: true } });
  const outstanding = await prisma.enrollment.aggregate({ where: { AND: [enrollmentWhere(filters, true), { remainingCents: { gt: 0 } }] }, _sum: { remainingCents: true } });
  const expenseWhere = { AND: [filters.includeArchived === "1" ? {} : { archivedAt: null }, dateRange("expenseDate", filters), filters.category ? { category: filters.category } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}] };
  const expenses = await prisma.expense.aggregate({ where: expenseWhere, _sum: { amountCents: true } });
  const payroll = await prisma.teacherPayroll.aggregate({ where: { AND: [filters.teacherId ? { teacherId: filters.teacherId } : {}, filters.dateFrom ? { periodEnd: { gte: new Date(filters.dateFrom) } } : {}, filters.dateTo ? { periodStart: { lte: new Date(filters.dateTo) } } : {}, filters.paymentStatus ? { status: filters.paymentStatus as any } : {}] }, _sum: { grossAmountCents: true } });
  const revenueCents = revenue._sum.totalAmountCents ?? 0;
  const expenseCents = expenses._sum.amountCents ?? 0;
  return { revenueCents, outstandingCents: outstanding._sum.remainingCents ?? 0, expenseCents, netCents: revenueCents - expenseCents, payrollCents: payroll._sum.grossAmountCents ?? 0 };
}

function pageResult(rows: any[], totalRows: number, summary: ReportResult["summary"] = {}): ReportResult { return { rows, totalRows, summary }; }

export async function loadReport(reportKind: LoadReportKind, filters: ReportFilters, pagination: ReportPagination, dashboardSummary?: Awaited<ReturnType<typeof getReportDashboardSummary>>) {
  if (reportKind === "revenue") {
    const where = { AND: [dateRange("paymentDate", filters), { voidedAt: null }, filters.familyId ? { familyId: filters.familyId } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}, { items: { some: matchingItemWhere(filters) } }] };
    const totalRows = await prisma.payment.count({ where });
    const total = await prisma.payment.aggregate({ where, _sum: { totalAmountCents: true } });
    const rows = await prisma.payment.findMany({ where, select: { id: true, paymentDate: true, paymentMethod: true, receiptNumber: true, totalAmountCents: true, family: { select: { familyCode: true, name: true } }, items: { where: matchingItemWhere(filters), select: { amountCents: true, enrollment: { select: { courseName: true, season: { select: { name: true } }, course: { select: { name: true } } } } } } }, orderBy: { paymentDate: "desc" }, skip: pagination.skip, take: pagination.take });
    return pageResult(rows.map((r) => ({ ...r, reportAmountCents: r.items.reduce((sum, i) => sum + i.amountCents, 0) || r.totalAmountCents })), totalRows, { totalCents: total._sum.totalAmountCents ?? 0 });
  }
  if (reportKind === "outstanding") {
    const where = { AND: [enrollmentWhere(filters, true), { remainingCents: { gt: 0 } }] };
    const totalRows = await prisma.enrollment.count({ where });
    const total = await prisma.enrollment.aggregate({ where, _sum: { remainingCents: true } });
    const rows = await prisma.enrollment.findMany({ where, select: { id: true, remainingCents: true, courseName: true, student: { select: { studentCode: true, firstName: true, lastName: true, family: { select: { familyCode: true, name: true } } } }, season: { select: { name: true } }, teacher: { select: { fullName: true } }, course: { select: { name: true } }, level: { select: { name: true } } }, orderBy: [{ season: { startDate: "desc" } }, { student: { lastName: "asc" } }], skip: pagination.skip, take: pagination.take });
    return pageResult(rows, totalRows, { totalCents: total._sum.remainingCents ?? 0 });
  }
  if (reportKind === "expenses") {
    const where = { AND: [filters.includeArchived === "1" ? {} : { archivedAt: null }, dateRange("expenseDate", filters), filters.category ? { category: filters.category } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}] };
    const totalRows = await prisma.expense.count({ where });
    const total = await prisma.expense.aggregate({ where, _sum: { amountCents: true } });
    const rows = await prisma.expense.findMany({ where, orderBy: { expenseDate: "desc" }, skip: pagination.skip, take: pagination.take });
    return pageResult(rows, totalRows, { totalCents: total._sum.amountCents ?? 0 });
  }
  if (reportKind === "profit-loss") { const summary = dashboardSummary ?? await getReportDashboardSummary(filters); return pageResult([], 0, { revenueCents: summary.revenueCents, expenseCents: summary.expenseCents, netCents: summary.netCents }); }
  if (reportKind === "season-closing") {
    if (!filters.seasonId) return pageResult([], 0, null);
    const summary = await getSeasonClosingReport(filters.seasonId);
    return summary ? pageResult([], 0, summary) : { ...pageResult([], 0, null), errorMessage: missingSeasonMessage };
  }
  const full = reportKind === "course-enrollment" ? await getCourseEnrollmentReport({ ...filters, ...pagination }) : reportKind === "teacher-schedule" ? await getTeacherScheduleAvailabilityReport({ ...filters, ...pagination }) : reportKind === "room-utilization" ? await getRoomUtilizationReport({ ...filters, ...pagination }) : await getPayrollReport({ ...filters, ...pagination });
  return pageResult(full.rows, (full as any).totalRows ?? full.rows.length, { totalCents: (full as any).totalCents ?? 0 });
}
