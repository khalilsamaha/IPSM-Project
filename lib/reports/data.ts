import { prisma } from "@/lib/dashboard/data";
import { calculateProfitLossCents, estimateTeacherSalaryCents, sumExpenseCents, sumOutstandingCents, sumRevenueCents } from "./calculations";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  seasonId?: string;
  familyId?: string;
  studentId?: string;
  teacherId?: string;
  paymentMethod?: string;
  category?: string;
  includeArchived?: string;
};

const dateRange = (field: "paymentDate" | "expenseDate", filters: ReportFilters) => ({
  ...(filters.dateFrom ? { [field]: { gte: new Date(filters.dateFrom) } } : {}),
  ...(filters.dateTo ? { [field]: { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), lte: new Date(filters.dateTo) } } : {}),
});

export async function getReportLookups() {
  const [families, students, seasons, teachers, expenseCategories, paymentMethods] = await Promise.all([
    prisma.family.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.season.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
    prisma.expense.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    prisma.payment.findMany({ distinct: ["paymentMethod"], orderBy: { paymentMethod: "asc" }, select: { paymentMethod: true } }),
  ]);
  return { families, students, seasons, teachers, expenseCategories, paymentMethods };
}

export async function getRevenueReport(filters: ReportFilters) {
  const rows = await prisma.payment.findMany({
    where: { AND: [dateRange("paymentDate", filters), { voidedAt: null }, filters.familyId ? { familyId: filters.familyId } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}, filters.seasonId ? { items: { some: { enrollment: { seasonId: filters.seasonId } } } } : {}] },
    include: { family: true, items: { include: { enrollment: { include: { season: true, student: true } } } } },
    orderBy: { paymentDate: "desc" },
  });
  return { rows, totalCents: sumRevenueCents(rows) };
}

export async function getOutstandingReport(filters: ReportFilters) {
  const rows = await prisma.enrollment.findMany({
    where: { AND: [filters.familyId ? { student: { familyId: filters.familyId } } : {}, filters.studentId ? { studentId: filters.studentId } : {}, filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.teacherId ? { teacherId: filters.teacherId } : {}, { remainingCents: { gt: 0 } }] },
    include: { student: { include: { family: true } }, season: true, teacher: true },
    orderBy: [{ season: { startDate: "desc" } }, { student: { lastName: "asc" } }],
  });
  return { rows, totalCents: sumOutstandingCents(rows) };
}

export async function getExpenseReport(filters: ReportFilters) {
  const rows = await prisma.expense.findMany({
    where: { AND: [filters.includeArchived === "1" ? {} : { archivedAt: null }, dateRange("expenseDate", filters), filters.category ? { category: filters.category } : {}, filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}] },
    orderBy: { expenseDate: "desc" },
  });
  return { rows, totalCents: sumExpenseCents(rows, filters.includeArchived === "1") };
}

export async function getProfitLossReport(filters: ReportFilters) {
  const [revenue, expenses] = await Promise.all([getRevenueReport(filters), getExpenseReport(filters)]);
  return { revenueCents: revenue.totalCents, expenseCents: expenses.totalCents, netCents: calculateProfitLossCents(revenue.rows, expenses.rows, filters.includeArchived === "1") };
}

export async function getTeacherSalaryReport(filters: ReportFilters) {
  const rows = await prisma.teacher.findMany({
    where: filters.teacherId ? { id: filters.teacherId } : {},
    include: { enrollments: { where: { AND: [filters.seasonId ? { seasonId: filters.seasonId } : {}, filters.studentId ? { studentId: filters.studentId } : {}, filters.familyId ? { student: { familyId: filters.familyId } } : {}] }, include: { student: { include: { family: true } }, season: true } } },
    orderBy: { fullName: "asc" },
  });
  const mapped = rows.map((teacher) => ({ ...teacher, estimatedHours: null as number | null, estimatedSalaryCents: estimateTeacherSalaryCents(teacher.hourlyRateCents, null) }));
  return { rows: mapped, totalCents: mapped.reduce((sum, teacher) => sum + teacher.estimatedSalaryCents, 0) };
}
