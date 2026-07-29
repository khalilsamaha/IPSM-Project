import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DeletableEntityType = "student" | "family" | "teacher";
export type DependencyCount = { key: string; label: string; count: number; severity: "blocking" | "removable"; explanation: string };
export type DeletionPreview = { entityType: DeletableEntityType; entityId: string; displayName: string; referenceCode: string | null; archived: boolean; canDelete: boolean; blockers: DependencyCount[]; removableDependencies: DependencyCount[]; recommendedAction: "archive" | "delete" | "restore" };
type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { actorId: string; createdById?: string | null };

export class SafeDeletionError extends Error {
  constructor(public code: "missing" | "active" | "changed" | "confirmation" | "constraint", message: string) { super(message); }
}
const dep = (key: string, label: string, count: number, severity: DependencyCount["severity"], explanation: string): DependencyCount => ({ key, label, count, severity, explanation });
const finish = (base: Omit<DeletionPreview, "canDelete" | "recommendedAction">): DeletionPreview => ({ ...base, canDelete: base.archived && base.blockers.every((x) => x.count === 0), recommendedAction: !base.archived ? "archive" : base.blockers.some((x) => x.count > 0) ? "archive" : "delete" });

export async function getStudentDeletionPreview(id: string, db: Db = prisma): Promise<DeletionPreview | null> {
  const row = await db.student.findUnique({ where: { id }, select: { id: true, studentCode: true, firstName: true, lastName: true, status: true, archivedAt: true } });
  if (!row) return null;
  const [enrollments, patterns, sessions, allocations, payrollLessons] = await Promise.all([
    db.enrollment.count({ where: { studentId: id } }), db.schedulePattern.count({ where: { enrollment: { studentId: id } } }),
    db.scheduleSession.count({ where: { studentId: id } }), db.paymentItem.count({ where: { enrollment: { studentId: id } } }),
    db.scheduleSession.count({ where: { studentId: id, payrollItems: { some: {} } } }),
  ]);
  return finish({ entityType: "student", entityId: id, displayName: `${row.firstName} ${row.lastName}`, referenceCode: row.studentCode, archived: row.status === "INACTIVE" || !!row.archivedAt,
    blockers: [dep("enrollments", "Enrollments", enrollments, "blocking", "Enrollment and balance history is retained."), dep("schedulePatterns", "Schedule patterns", patterns, "blocking", "Recurring schedule configuration belongs to an enrollment."), dep("sessions", "Lesson sessions", sessions, "blocking", "Attendance and lesson history is retained."), dep("paymentAllocations", "Payment allocations", allocations, "blocking", "Posted and voided financial history is retained."), dep("payrollLessons", "Payroll-linked lessons", payrollLessons, "blocking", "Payroll history is retained.")], removableDependencies: [] });
}

export async function getFamilyDeletionPreview(id: string, db: Db = prisma): Promise<DeletionPreview | null> {
  const row = await db.family.findUnique({ where: { id }, select: { id: true, familyCode: true, name: true, status: true, archivedAt: true } });
  if (!row) return null;
  const [students, payments, receipts, enrollments] = await Promise.all([db.student.count({ where: { familyId: id } }), db.payment.count({ where: { familyId: id } }), db.receipt.count({ where: { payment: { familyId: id } } }), db.enrollment.count({ where: { student: { familyId: id } } })]);
  return finish({ entityType: "family", entityId: id, displayName: row.name, referenceCode: row.familyCode, archived: row.status === "INACTIVE" || !!row.archivedAt,
    blockers: [dep("students", "Students", students, "blocking", "Students must be handled independently."), dep("payments", "Payments", payments, "blocking", "Posted and voided payments are retained."), dep("receipts", "Receipts", receipts, "blocking", "Receipt history is retained."), dep("enrollments", "Enrollment relationships", enrollments, "blocking", "Historical balances are retained.")], removableDependencies: [] });
}

export async function getTeacherDeletionPreview(id: string, db: Db = prisma): Promise<DeletionPreview | null> {
  const row = await db.teacher.findUnique({ where: { id }, select: { id: true, fullName: true, status: true, archivedAt: true } });
  if (!row) return null;
  const [enrollments, patterns, sessions, completed, payrolls, payrollLessons, courses, availability] = await Promise.all([db.enrollment.count({ where: { teacherId: id } }), db.schedulePattern.count({ where: { teacherId: id } }), db.scheduleSession.count({ where: { teacherId: id } }), db.scheduleSession.count({ where: { teacherId: id, status: "COMPLETED" } }), db.teacherPayroll.count({ where: { teacherId: id } }), db.scheduleSession.count({ where: { teacherId: id, payrollItems: { some: {} } } }), db.teacherCourse.count({ where: { teacherId: id } }), db.teacherAvailability.count({ where: { teacherId: id } })]);
  return finish({ entityType: "teacher", entityId: id, displayName: row.fullName, referenceCode: null, archived: row.status === "ARCHIVED" || !!row.archivedAt,
    blockers: [dep("enrollments", "Enrollments", enrollments, "blocking", "Teaching assignments are retained."), dep("schedulePatterns", "Schedule patterns", patterns, "blocking", "Recurring schedules are retained."), dep("sessions", "Lessons", sessions, "blocking", "Lesson and attendance history is retained."), dep("completedLessons", "Completed lessons", completed, "blocking", "Completed teaching history is retained."), dep("payrolls", "Payroll records", payrolls, "blocking", "Payroll history is retained."), dep("payrollLessons", "Payroll-linked lessons", payrollLessons, "blocking", "Payroll-linked lessons are retained.")],
    removableDependencies: [dep("courseAssignments", "Course assignments", courses, "removable", "Configuration only; removed with the teacher."), dep("availabilityRules", "Availability rules", availability, "removable", "Configuration only; removed with the teacher.")] });
}

const requiredConfirmation = (preview: DeletionPreview) => `DELETE ${preview.referenceCode ?? preview.displayName}`;
async function auditBlocked(type: DeletableEntityType, id: string, actor: Actor, preview: DeletionPreview | null) { await prisma.auditLog.create({ data: { action: "entity_delete_blocked", entity: type, entityId: id, actorId: actor.actorId, createdById: actor.createdById, metadata: { entityType: type, entityId: id, referenceCode: preview?.referenceCode, blockers: preview?.blockers.map(({ key, count }) => ({ key, count })) ?? [], removable: preview?.removableDependencies.map(({ key, count }) => ({ key, count })) ?? [] } } }); }

async function safely(type: DeletableEntityType, id: string, confirmation: string, actor: Actor) {
  const getter = type === "student" ? getStudentDeletionPreview : type === "family" ? getFamilyDeletionPreview : getTeacherDeletionPreview;
  const advisory = await getter(id);
  if (!advisory) throw new SafeDeletionError("missing", "This record was already deleted.");
  if (confirmation.trim() !== requiredConfirmation(advisory)) { await auditBlocked(type, id, actor, advisory); throw new SafeDeletionError("confirmation", `Type ${requiredConfirmation(advisory)} exactly to confirm permanent deletion.`); }
  try {
    await prisma.$transaction(async (tx) => {
      const preview = await getter(id, tx);
      if (!preview) throw new SafeDeletionError("missing", "This record was already deleted.");
      if (!preview.archived) throw new SafeDeletionError("active", `Archive this ${type} before permanent deletion.`);
      if (!preview.canDelete) throw new SafeDeletionError("changed", "This record changed after the deletion preview. Review its dependencies and try again.");
      if (type === "teacher") { await tx.teacherCourse.deleteMany({ where: { teacherId: id } }); await tx.teacherAvailability.deleteMany({ where: { teacherId: id } }); }
      if (type === "student") await tx.student.delete({ where: { id } });
      else if (type === "family") await tx.family.delete({ where: { id } });
      else await tx.teacher.delete({ where: { id } });
      await tx.auditLog.create({ data: { action: "entity_delete", entity: type, entityId: id, actorId: actor.actorId, createdById: actor.createdById, metadata: { entityType: type, entityId: id, referenceCode: preview.referenceCode, blockers: [], removable: preview.removableDependencies.map(({ key, count }) => ({ key, count })) } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof SafeDeletionError) { await auditBlocked(type, id, actor, await getter(id)); throw error; }
    await auditBlocked(type, id, actor, await getter(id));
    throw new SafeDeletionError("constraint", "The record changed while deletion was being processed. Review its dependencies and try again.");
  }
}
export const deleteStudentSafely = (id: string, confirmation: string, actor: Actor) => safely("student", id, confirmation, actor);
export const deleteFamilySafely = (id: string, confirmation: string, actor: Actor) => safely("family", id, confirmation, actor);
export const deleteTeacherSafely = (id: string, confirmation: string, actor: Actor) => safely("teacher", id, confirmation, actor);
export const deletionConfirmation = requiredConfirmation;
