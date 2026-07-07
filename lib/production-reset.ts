import type { PrismaClient } from "@prisma/client";

export const productionResetScopes = ["operationalData", "financialData", "scheduleData", "studentsFamilies", "teachers", "seasons"] as const;
export type ProductionResetScope = (typeof productionResetScopes)[number];
export type ProductionResetSelection = Record<ProductionResetScope, boolean>;

export type ProductionResetCounts = {
  families: number;
  students: number;
  teachers: number;
  seasons: number;
  enrollments: number;
  scheduleSessions: number;
  payments: number;
  paymentItems: number;
  receipts: number;
  expenses: number;
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

export function getProductionResetPlan(selection: ProductionResetSelection): string[] {
  const plan: string[] = [];
  const needsPayments = selection.financialData || selection.operationalData || selection.studentsFamilies;
  const needsSchedule = selection.scheduleData || selection.operationalData || selection.studentsFamilies || selection.teachers || selection.seasons;
  const needsEnrollments = selection.operationalData || selection.studentsFamilies || selection.seasons;

  if (needsPayments) plan.push("receipt", "paymentItem", "payment");
  if (selection.financialData) plan.push("expense");
  if (needsSchedule) plan.push("scheduleSession");
  if (needsEnrollments) plan.push("enrollment");
  if (selection.teachers || selection.seasons) plan.push("teacherAvailability");
  if (selection.teachers) plan.push("teacherCourse", "teacher");
  if (selection.studentsFamilies) plan.push("student", "family");
  if (selection.seasons) plan.push("season");

  return [...new Set(plan)];
}

export async function getProductionResetCounts(prisma: Pick<PrismaClient, "family" | "student" | "teacher" | "season" | "enrollment" | "scheduleSession" | "payment" | "paymentItem" | "receipt" | "expense">): Promise<ProductionResetCounts> {
  const [families, students, teachers, seasons, enrollments, scheduleSessions, payments, paymentItems, receipts, expenses] = await Promise.all([
    prisma.family.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.season.count(),
    prisma.enrollment.count(),
    prisma.scheduleSession.count(),
    prisma.payment.count(),
    prisma.paymentItem.count(),
    prisma.receipt.count(),
    prisma.expense.count(),
  ]);
  return { families, students, teachers, seasons, enrollments, scheduleSessions, payments, paymentItems, receipts, expenses };
}

export async function executeProductionReset(prisma: PrismaClient, input: { actorId: string; createdById?: string | null; selection: ProductionResetSelection }) {
  const countsBefore = await getProductionResetCounts(prisma);
  const plan = getProductionResetPlan(input.selection);

  await prisma.$transaction(async (tx) => {
    for (const model of plan) {
      if (model === "receipt") await tx.receipt.deleteMany({});
      if (model === "paymentItem") await tx.paymentItem.deleteMany({});
      if (model === "payment") await tx.payment.deleteMany({});
      if (model === "expense") await tx.expense.deleteMany({});
      if (model === "scheduleSession") await tx.scheduleSession.deleteMany({});
      if (model === "enrollment") await tx.enrollment.deleteMany({});
      if (model === "teacherAvailability") await tx.teacherAvailability.deleteMany({});
      if (model === "teacherCourse") await tx.teacherCourse.deleteMany({});
      if (model === "teacher") await tx.teacher.deleteMany({});
      if (model === "student") await tx.student.deleteMany({});
      if (model === "family") await tx.family.deleteMany({});
      if (model === "season") await tx.season.deleteMany({});
    }
    await tx.auditLog.create({
      data: {
        action: "production_reset",
        entity: "System",
        entityId: null,
        actorId: input.actorId,
        createdById: input.createdById ?? null,
        metadata: { selection: input.selection, plan, countsBefore, preserved: ["users", "roles", "courses", "course_levels", "course_pricings", "rooms", "settings", "supabase_auth_users"] },
      },
    });
  });

  return { countsBefore, plan };
}
