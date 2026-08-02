import type { PrismaClient } from "@prisma/client";

export const productionResetScopes = [
  "operationalData",
  "financialData",
  "scheduleData",
  "studentsFamilies",
  "teachers",
  "seasons",
] as const;
export type ProductionResetScope = (typeof productionResetScopes)[number];
export type ProductionResetSelection = Record<ProductionResetScope, boolean>;

export const productionResetOperations = [
  "receipt",
  "paymentItem",
  "payment",
  "expense",
  "cashierShift",
  "teacherPayrollItem",
  "teacherPayroll",
  "scheduleSession",
  "schedulePattern",
  "registrationAttempt",
  "enrollment",
  "teacherAvailabilitySeasonScoped",
  "teacherAvailability",
  "teacherCourse",
  "teacher",
  "student",
  "family",
  "coursePricingSeasonScoped",
  "season",
] as const;
export type ProductionResetOperation = (typeof productionResetOperations)[number];

export type ProductionResetCounts = {
  families: number;
  students: number;
  teachers: number;
  seasons: number;
  enrollments: number;
  registrationAttempts: number;
  schedulePatterns: number;
  scheduleSessions: number;
  teacherPayrolls: number;
  teacherPayrollItems: number;
  payments: number;
  paymentItems: number;
  receipts: number;
  expenses: number;
  cashierShifts: number;
  teacherAvailability: number;
  teacherCourses: number;
  seasonCoursePricings: number;
};

export const emptyProductionResetSelection: ProductionResetSelection = {
  operationalData: false,
  financialData: false,
  scheduleData: false,
  studentsFamilies: false,
  teachers: false,
  seasons: false,
};

export function parseProductionResetSelection(formData: FormData): ProductionResetSelection {
  return {
    operationalData: formData.get("operationalData") === "on",
    financialData: formData.get("financialData") === "on",
    scheduleData: formData.get("scheduleData") === "on",
    studentsFamilies: formData.get("studentsFamilies") === "on",
    teachers: formData.get("teachers") === "on",
    seasons: formData.get("seasons") === "on",
  };
}

export function hasProductionResetSelection(selection: ProductionResetSelection) {
  return productionResetScopes.some((scope) => selection[scope]);
}

export function getProductionResetPlan(
  selection: ProductionResetSelection,
): ProductionResetOperation[] {
  const plan: ProductionResetOperation[] = [];
  const needsPayments =
    selection.financialData ||
    selection.operationalData ||
    selection.studentsFamilies ||
    selection.seasons;
  const needsExpenses = selection.financialData || selection.operationalData;
  const needsCashierShifts = selection.financialData || selection.operationalData;
  const needsPayroll =
    selection.financialData ||
    selection.operationalData ||
    selection.scheduleData ||
    selection.studentsFamilies ||
    selection.teachers ||
    selection.seasons;
  const needsSchedule =
    selection.scheduleData ||
    selection.operationalData ||
    selection.studentsFamilies ||
    selection.teachers ||
    selection.seasons;
  const needsRegistrationAttempts =
    selection.operationalData || selection.studentsFamilies || selection.seasons;
  const needsEnrollments =
    selection.operationalData || selection.studentsFamilies || selection.seasons;

  if (needsPayments) plan.push("receipt", "paymentItem", "payment");
  if (needsExpenses) plan.push("expense");
  if (needsCashierShifts) plan.push("cashierShift");
  if (needsPayroll) plan.push("teacherPayrollItem", "teacherPayroll");
  if (needsSchedule) plan.push("scheduleSession", "schedulePattern");
  if (needsRegistrationAttempts) plan.push("registrationAttempt");
  if (needsEnrollments) plan.push("enrollment");

  if (selection.teachers) {
    plan.push("teacherAvailability", "teacherCourse", "teacher");
  } else if (selection.seasons) {
    // Prevent season-specific availability from becoming global through ON DELETE SET NULL.
    plan.push("teacherAvailabilitySeasonScoped");
  }

  if (selection.studentsFamilies) plan.push("student", "family");
  if (selection.seasons) {
    // Prevent season-specific prices from silently becoming global prices.
    plan.push("coursePricingSeasonScoped", "season");
  }

  return [...new Set(plan)];
}

type CountStore = Pick<
  PrismaClient,
  | "family"
  | "student"
  | "teacher"
  | "season"
  | "enrollment"
  | "registrationAttempt"
  | "schedulePattern"
  | "scheduleSession"
  | "teacherPayroll"
  | "teacherPayrollItem"
  | "payment"
  | "paymentItem"
  | "receipt"
  | "expense"
  | "cashierShift"
  | "teacherAvailability"
  | "teacherCourse"
  | "coursePricing"
>;

export async function getProductionResetCounts(
  prisma: CountStore,
): Promise<ProductionResetCounts> {
  const [
    families,
    students,
    teachers,
    seasons,
    enrollments,
    registrationAttempts,
    schedulePatterns,
    scheduleSessions,
    teacherPayrolls,
    teacherPayrollItems,
    payments,
    paymentItems,
    receipts,
    expenses,
    cashierShifts,
    teacherAvailability,
    teacherCourses,
    seasonCoursePricings,
  ] = await Promise.all([
    prisma.family.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.season.count(),
    prisma.enrollment.count(),
    prisma.registrationAttempt.count(),
    prisma.schedulePattern.count(),
    prisma.scheduleSession.count(),
    prisma.teacherPayroll.count(),
    prisma.teacherPayrollItem.count(),
    prisma.payment.count(),
    prisma.paymentItem.count(),
    prisma.receipt.count(),
    prisma.expense.count(),
    prisma.cashierShift.count(),
    prisma.teacherAvailability.count(),
    prisma.teacherCourse.count(),
    prisma.coursePricing.count({ where: { seasonId: { not: null } } }),
  ]);

  return {
    families,
    students,
    teachers,
    seasons,
    enrollments,
    registrationAttempts,
    schedulePatterns,
    scheduleSessions,
    teacherPayrolls,
    teacherPayrollItems,
    payments,
    paymentItems,
    receipts,
    expenses,
    cashierShifts,
    teacherAvailability,
    teacherCourses,
    seasonCoursePricings,
  };
}

export async function executeProductionReset(
  prisma: PrismaClient,
  input: {
    actorId: string;
    createdById?: string | null;
    selection: ProductionResetSelection;
  },
) {
  const countsBefore = await getProductionResetCounts(prisma);
  const plan = getProductionResetPlan(input.selection);

  const deleted = await prisma.$transaction(async (tx) => {
    const results: Partial<Record<ProductionResetOperation, number>> = {};

    for (const operation of plan) {
      if (operation === "receipt") results[operation] = (await tx.receipt.deleteMany({})).count;
      if (operation === "paymentItem") results[operation] = (await tx.paymentItem.deleteMany({})).count;
      if (operation === "payment") results[operation] = (await tx.payment.deleteMany({})).count;
      if (operation === "expense") results[operation] = (await tx.expense.deleteMany({})).count;
      if (operation === "cashierShift") results[operation] = (await tx.cashierShift.deleteMany({})).count;
      if (operation === "teacherPayrollItem") results[operation] = (await tx.teacherPayrollItem.deleteMany({})).count;
      if (operation === "teacherPayroll") results[operation] = (await tx.teacherPayroll.deleteMany({})).count;
      if (operation === "scheduleSession") results[operation] = (await tx.scheduleSession.deleteMany({})).count;
      if (operation === "schedulePattern") results[operation] = (await tx.schedulePattern.deleteMany({})).count;
      if (operation === "registrationAttempt") results[operation] = (await tx.registrationAttempt.deleteMany({})).count;
      if (operation === "enrollment") results[operation] = (await tx.enrollment.deleteMany({})).count;
      if (operation === "teacherAvailabilitySeasonScoped") {
        results[operation] = (await tx.teacherAvailability.deleteMany({
          where: { seasonId: { not: null } },
        })).count;
      }
      if (operation === "teacherAvailability") results[operation] = (await tx.teacherAvailability.deleteMany({})).count;
      if (operation === "teacherCourse") results[operation] = (await tx.teacherCourse.deleteMany({})).count;
      if (operation === "teacher") results[operation] = (await tx.teacher.deleteMany({})).count;
      if (operation === "student") results[operation] = (await tx.student.deleteMany({})).count;
      if (operation === "family") results[operation] = (await tx.family.deleteMany({})).count;
      if (operation === "coursePricingSeasonScoped") {
        results[operation] = (await tx.coursePricing.deleteMany({
          where: { seasonId: { not: null } },
        })).count;
      }
      if (operation === "season") results[operation] = (await tx.season.deleteMany({})).count;
    }

    await tx.auditLog.create({
      data: {
        action: "production_reset",
        entity: "System",
        entityId: null,
        actorId: input.actorId,
        createdById: input.createdById ?? null,
        metadata: {
          selection: input.selection,
          plan,
          countsBefore,
          deleted: results,
          preserved: [
            "users",
            "roles",
            "courses",
            "course_levels",
            "global_course_pricings",
            "rooms",
            "school_closures",
            "operational_settings",
            "supabase_auth_users",
          ],
        },
      },
    });

    return results;
  }, {
    maxWait: 10_000,
    timeout: 60_000,
  });

  return { countsBefore, plan, deleted };
}
