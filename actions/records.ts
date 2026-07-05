"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, ScheduleSessionStatus, SeasonStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { calculateProratedFeeCents } from "@/lib/enrollments/proration";
import { minutesFromTime, roomSchema, scheduleSessionSchema, teacherAvailabilitySchema, timeWindowsOverlap } from "@/lib/schedule/validation";
import { logServerError } from "@/lib/server-log";
import { createStudentWithCode } from "@/lib/students";
import { buildStudentCreateData } from "@/lib/registration/independent-student";
import { academicPricingUrl, isUniqueConstraintError, normalizeName } from "@/lib/academic-pricing";

async function requireRecordsWrite() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, createdById: user?.id };
}

async function requireAdminAction() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, createdById: user?.id };
}

async function audit(action: string, entity: string, entityId: string | null, metadata?: unknown) {
  const { createdById, session } = await requireRecordsWrite();
  await prisma.auditLog.create({ data: { action, entity, entityId, createdById, actorId: session.userId, metadata: metadata as object } });
}

const optionalEmail = z.string().trim().email().or(z.literal("")).optional().transform((v) => v || null);
const optionalString = z.string().trim().optional().transform((v) => v || null);
const id = z.string().uuid();

const familySchema = z.object({ id: id.optional(), name: z.string().trim().min(1), email: optionalEmail, phone: optionalString, fatherFirstName: optionalString, fatherLastName: optionalString, fatherJob: optionalString, fatherPhone: optionalString, fatherEmail: optionalEmail, motherFirstName: optionalString, motherLastName: optionalString, motherJob: optionalString, motherPhone: optionalString, motherEmail: optionalEmail, address: optionalString, emergencyContactName: optionalString, emergencyContactPhone: optionalString, status: z.enum(["ACTIVE", "INACTIVE"]), notes: optionalString });
export async function saveFamily(formData: FormData) {
  await requireRecordsWrite();
  const data = familySchema.parse(Object.fromEntries(formData));
  const row = data.id ? await prisma.family.update({ where: { id: data.id }, data }) : await prisma.family.create({ data });
  await audit(data.id ? "update" : "create", "Family", row.id, data);
  revalidatePath("/families");
}
export async function archiveFamily(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.family.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "INACTIVE", archivedAt: new Date() } });
  await audit("archive", "Family", row.id);
  revalidatePath("/families");
}
export async function restoreFamily(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.family.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Family", row.id);
  revalidatePath("/families");
}

const studentSchema = z.object({ id: id.optional(), familyId: id.or(z.literal("")).optional().transform((v) => v || null), firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: optionalEmail, phone: optionalString, dateOfBirth: z.string().optional().transform((v) => v ? new Date(v) : null), status: z.enum(["ACTIVE", "INACTIVE"])});
export async function saveStudent(formData: FormData) {
  await requireRecordsWrite();
  const parsed = studentSchema.parse(Object.fromEntries(formData));
  const { id: studentId, familyId, ...studentData } = parsed;
  const data = familyId ? { ...studentData, family: { connect: { id: familyId } } } : { ...studentData, family: { disconnect: true } };
  try {
    const row = studentId ? await prisma.student.update({ where: { id: studentId }, data: data as any }) : await createStudentWithCode(prisma.student, familyId ? data as any : studentData as any);
    await audit(studentId ? "update" : "create", "Student", row.id, data);
    revalidatePath("/students");
  } catch (error) {
    logServerError("student.save", error, { studentId, familyId });
    redirect(`/students?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save student. Please check the form and try again.")}`);
  }
}
export async function archiveStudent(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.student.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "INACTIVE", archivedAt: new Date() } });
  await audit("archive", "Student", row.id);
  revalidatePath("/students");
}
export async function restoreStudent(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.student.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Student", row.id);
  revalidatePath("/students");
}

export async function deleteArchivedStudentCascade(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const studentId = id.parse(formData.get("id"));
  const confirmation = String(formData.get("confirm") ?? "");
  const redirectTo = `/students/${studentId}`;
  if (confirmation !== "DELETE") redirect(`${redirectTo}?error=${encodeURIComponent("Type DELETE to confirm permanent student deletion.")}`);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({ where: { id: studentId }, include: { enrollments: { select: { id: true } } } });
      if (!student) throw new Error("Student not found.");
      if (student.status !== "INACTIVE" && !student.archivedAt) throw new Error("Archive the student before permanent deletion.");
      const enrollmentIds = student.enrollments.map((e) => e.id);
      const paymentIds = enrollmentIds.length ? Array.from(new Set((await tx.paymentItem.findMany({ where: { enrollmentId: { in: enrollmentIds } }, select: { paymentId: true } })).map((i) => i.paymentId))) : [];
      const deletedSessions = await tx.scheduleSession.deleteMany({ where: { studentId } });
      const deletedPaymentItems = enrollmentIds.length ? await tx.paymentItem.deleteMany({ where: { enrollmentId: { in: enrollmentIds } } }) : { count: 0 };
      const orphanPayments = paymentIds.length ? await tx.payment.findMany({ where: { id: { in: paymentIds }, items: { none: {} } }, select: { id: true } }) : [];
      const orphanPaymentIds = orphanPayments.map((p) => p.id);
      const deletedReceipts = orphanPaymentIds.length ? await tx.receipt.deleteMany({ where: { paymentId: { in: orphanPaymentIds } } }) : { count: 0 };
      const deletedPayments = orphanPaymentIds.length ? await tx.payment.deleteMany({ where: { id: { in: orphanPaymentIds } } }) : { count: 0 };
      const deletedEnrollments = enrollmentIds.length ? await tx.enrollment.deleteMany({ where: { id: { in: enrollmentIds } } }) : { count: 0 };
      await tx.student.delete({ where: { id: studentId } });
      const metadata = { studentId, studentCode: student.studentCode, name: `${student.firstName} ${student.lastName}`, deletedEnrollmentCount: deletedEnrollments.count, deletedSessionCount: deletedSessions.count, deletedPaymentItemCount: deletedPaymentItems.count, deletedOrphanPaymentCount: deletedPayments.count, deletedReceiptCount: deletedReceipts.count };
      await tx.auditLog.create({ data: { action: "delete", entity: "Student", entityId: studentId, createdById, actorId: session.userId, metadata } });
      return metadata;
    });
    revalidatePath("/students");
    redirect(`/students?status=archived&success=${encodeURIComponent(`Student permanently deleted. Removed ${result.deletedEnrollmentCount} enrollment(s), ${result.deletedSessionCount} session(s), and ${result.deletedOrphanPaymentCount} orphan payment(s).`)}`);
  } catch (error) {
    logServerError("student.deleteCascade", error, { studentId });
    redirect(`${redirectTo}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to delete student safely.")}`);
  }
}

const teacherSchema = z.object({ id: id.optional(), fullName: z.string().trim().min(1), email: optionalEmail, phone: optionalString, hourlyRate: z.string().default("0"), status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]), notes: optionalString });
export async function saveTeacher(formData: FormData) {
  await requireRecordsWrite();
  const parsed = teacherSchema.parse(Object.fromEntries(formData));
  const { hourlyRate, ...rest } = parsed;
  const data = { ...rest, hourlyRateCents: dollarsToCents(hourlyRate) };
  const row = data.id ? await prisma.teacher.update({ where: { id: data.id }, data }) : await prisma.teacher.create({ data });
  await audit(data.id ? "update" : "create", "Teacher", row.id, data);
  revalidatePath("/teachers");
}
export async function archiveTeacher(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.teacher.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await audit("archive", "Teacher", row.id);
  revalidatePath("/teachers");
}
export async function restoreTeacher(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.teacher.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Teacher", row.id);
  revalidatePath("/teachers");
}

const teacherCourseSchema = z.object({ id: id.optional(), teacherId: id, courseId: id, levelId: id.or(z.literal("")).optional().transform((v) => v || null), status: z.enum(["ACTIVE", "ARCHIVED"]) });
export async function saveTeacherCourse(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const data = teacherCourseSchema.parse(Object.fromEntries(formData));
  const duplicate = await prisma.teacherCourse.findFirst({ where: { teacherId: data.teacherId, courseId: data.courseId, levelId: data.levelId, ...(data.id ? { NOT: { id: data.id } } : {}) } });
  if (duplicate) redirect(`/teachers/${data.teacherId}/edit?error=${encodeURIComponent("This teacher already has that course and level assignment.")}`);
  const row = data.id ? await prisma.teacherCourse.update({ where: { id: data.id }, data }) : await prisma.teacherCourse.create({ data });
  await prisma.auditLog.create({ data: { action: data.id ? "update" : "create", entity: "TeacherCourse", entityId: row.id, createdById, actorId: session.userId, metadata: data } });
  revalidatePath(`/teachers/${data.teacherId}/edit`);
}
export async function archiveTeacherCourse(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const row = await prisma.teacherCourse.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: "archive", entity: "TeacherCourse", entityId: row.id, createdById, actorId: session.userId } });
  revalidatePath(`/teachers/${row.teacherId}/edit`);
}
export async function restoreTeacherCourse(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const row = await prisma.teacherCourse.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await prisma.auditLog.create({ data: { action: "restore", entity: "TeacherCourse", entityId: row.id, createdById, actorId: session.userId } });
  revalidatePath(`/teachers/${row.teacherId}/edit`);
}

const seasonSchema = z.object({ id: id.optional(), name: z.string().trim().min(1), startDate: z.string().min(1).transform((v) => new Date(v)), endDate: z.string().min(1).transform((v) => new Date(v)), status: z.enum(["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"]) }).refine((v) => v.endDate >= v.startDate, "End date must be after start date");
export async function saveSeason(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const data = seasonSchema.parse(Object.fromEntries(formData));
  const duplicate = await prisma.season.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(data.id ? { NOT: { id: data.id } } : {}) } });
  if (duplicate) redirect(`/seasons?error=${encodeURIComponent("A season with this name already exists.")}`);
  let row;
  try {
    row = data.id ? await prisma.season.update({ where: { id: data.id }, data }) : await prisma.season.create({ data });
  } catch (error) {
    if (isUniqueConstraintError(error)) redirect(`/seasons?error=${encodeURIComponent("A season with this name already exists.")}`);
    throw error;
  }
  await prisma.auditLog.create({ data: { action: data.id ? "update" : "create", entity: "Season", entityId: row.id, createdById, actorId: session.userId, metadata: data } });
  revalidatePath("/seasons");
}
async function setSeasonLifecycleStatus(formData: FormData, status: SeasonStatus, action: string) {
  const { session, createdById } = await requireAdminAction();
  const seasonId = id.parse(formData.get("id"));
  const row = await prisma.season.update({ where: { id: seasonId }, data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null } });
  await prisma.auditLog.create({ data: { action, entity: "Season", entityId: row.id, createdById, actorId: session.userId, metadata: { status } } });
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${row.id}/closing-report`);
}
export async function activateSeason(formData: FormData) { await setSeasonLifecycleStatus(formData, "ACTIVE", "activate"); }
export async function closeSeason(formData: FormData) { await setSeasonLifecycleStatus(formData, "CLOSED", "close"); }
export async function archiveSeason(formData: FormData) { await setSeasonLifecycleStatus(formData, "ARCHIVED", "archive"); }
export async function restoreSeason(formData: FormData) { await setSeasonLifecycleStatus(formData, "ACTIVE", "restore"); }
export async function deleteSeason(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const seasonId = id.parse(formData.get("id"));
  const [enrollments, sessions, pricings, paymentItems] = await Promise.all([
    prisma.enrollment.count({ where: { seasonId } }),
    prisma.scheduleSession.count({ where: { OR: [{ seasonId }, { enrollment: { seasonId } }] } }),
    prisma.coursePricing.count({ where: { seasonId } }),
    prisma.paymentItem.count({ where: { enrollment: { seasonId } } }),
  ]);
  if (enrollments || sessions || pricings || paymentItems) {
    await prisma.auditLog.create({ data: { action: "delete_blocked", entity: "Season", entityId: seasonId, createdById, actorId: session.userId, metadata: { enrollments, sessions, pricings, paymentItems } } });
    redirect(`/seasons?error=${encodeURIComponent("This season is already used by enrollments, schedules, prices, or payments. Archive or close it instead.")}`);
  }
  await prisma.season.delete({ where: { id: seasonId } });
  await prisma.auditLog.create({ data: { action: "delete", entity: "Season", entityId: seasonId, createdById, actorId: session.userId } });
  revalidatePath("/seasons");
  redirect(`/seasons?success=${encodeURIComponent("Season deleted.")}`);
}

const enrollmentSchema = z.object({ id: id.optional(), studentId: id, seasonId: id, teacherId: id.or(z.literal("")).transform((v) => v || null), courseName: z.string().trim().min(1), courseId: id.or(z.literal("")).optional().transform((v) => v || null), levelId: id.or(z.literal("")).optional().transform((v) => v || null), enrollmentStartDate: z.string().optional(), enrollmentEndDate: z.string().optional(), fee: z.string().default("0"), discount: z.string().default("0"), status: z.enum(["ACTIVE", "PAUSED", "ENDED", "CANCELLED"]) });
export async function saveEnrollment(formData: FormData) {
  await requireRecordsWrite();
  const parsed = enrollmentSchema.parse(Object.fromEntries(formData));
  const season = await prisma.season.findUnique({ where: { id: parsed.seasonId }, select: { startDate: true, endDate: true, status: true } });
  if (!season) throw new Error("Choose a valid season.");
  if (!parsed.id && !["PLANNED", "ACTIVE"].includes(season.status)) throw new Error("Only planned or active seasons accept new enrollments. Payments toward existing balances are still allowed from Payments.");
  const enrollmentStartDate = parsed.enrollmentStartDate ? new Date(parsed.enrollmentStartDate) : season.startDate;
  const enrollmentEndDate = parsed.enrollmentEndDate ? new Date(parsed.enrollmentEndDate) : season.endDate;
  if (enrollmentStartDate < season.startDate || enrollmentEndDate > season.endDate || enrollmentEndDate < enrollmentStartDate) throw new Error("Enrollment dates must stay inside the selected season.");
  const feeCents = dollarsToCents(parsed.fee);
  const discountCents = dollarsToCents(parsed.discount);
  const finalFeeCents = Math.max(0, feeCents - discountCents);
  const existing = parsed.id ? await prisma.enrollment.findUnique({ where: { id: parsed.id }, include: { paymentItems: true, scheduleSessions: { where: { archivedAt: null }, select: { sessionDate: true } } } }) : null;
  if (parsed.id && !existing) throw new Error("Enrollment not found.");
  const duplicate = await prisma.enrollment.findFirst({ where: { studentId: parsed.studentId, seasonId: parsed.seasonId, courseId: parsed.courseId, levelId: parsed.levelId, archivedAt: null, ...(parsed.id ? { NOT: { id: parsed.id } } : {}) } });
  if (duplicate) throw new Error("This student is already enrolled in that course and level for the selected season.");
  if (existing?.scheduleSessions.some((session) => session.sessionDate < enrollmentStartDate || session.sessionDate > enrollmentEndDate)) throw new Error("Enrollment dates must include all already scheduled lessons.");
  const paidCents = existing?.paidCents ?? 0;
  const data = { studentId: parsed.studentId, seasonId: parsed.seasonId, teacherId: parsed.teacherId, courseName: parsed.courseName, courseId: parsed.courseId, levelId: parsed.levelId, enrollmentStartDate, enrollmentEndDate, status: parsed.status, feeCents, discountCents, finalFeeCents, paidCents, remainingCents: Math.max(0, finalFeeCents - paidCents) };
  let row;
  try {
    row = parsed.id ? await prisma.enrollment.update({ where: { id: parsed.id }, data }) : await prisma.enrollment.create({ data });
  } catch (error) {
    logServerError("enrollment.save", error, { enrollmentId: parsed.id });
    redirect(`${parsed.id ? `/enrollments/${parsed.id}/edit` : "/enrollments"}?error=${encodeURIComponent("Unable to save enrollment. Please check the form and try again.")}`);
  }
  await audit(parsed.id ? "update" : "create", "Enrollment", row.id, data);
  revalidatePath("/enrollments");
  revalidatePath(`/enrollments/${row.id}/edit`);
  if (parsed.id) redirect(`/enrollments/${row.id}/edit?success=${encodeURIComponent("Enrollment updated safely.")}`);
}
export async function archiveEnrollment(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.enrollment.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ENDED", archivedAt: new Date() } });
  await audit("archive", "Enrollment", row.id);
  revalidatePath("/enrollments");
}
export async function restoreEnrollment(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.enrollment.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Enrollment", row.id);
  revalidatePath("/enrollments");
}


export async function saveRoom(formData: FormData) {
  await requireAdminAction();
  const data = roomSchema.parse(Object.fromEntries(formData));
  const row = data.id ? await prisma.room.update({ where: { id: data.id }, data }) : await prisma.room.create({ data });
  await audit(data.id ? "update" : "create", "Room", row.id, data);
  revalidatePath("/rooms");
  revalidatePath("/schedule");
}
export async function archiveRoom(formData: FormData) {
  await requireAdminAction();
  const row = await prisma.room.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await audit("archive", "Room", row.id);
  revalidatePath("/rooms");
  revalidatePath("/schedule");
}
export async function restoreRoom(formData: FormData) {
  await requireAdminAction();
  const row = await prisma.room.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Room", row.id);
  revalidatePath("/rooms");
  revalidatePath("/schedule");
}

export async function deleteRoom(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const roomId = id.parse(formData.get("id"));
  const sessions = await prisma.scheduleSession.count({ where: { roomId } });
  if (sessions > 0) {
    await prisma.auditLog.create({ data: { action: "delete_blocked", entity: "Room", entityId: roomId, createdById, actorId: session.userId, metadata: { sessions } } });
    redirect(`/rooms?status=archived&error=${encodeURIComponent("This room is already used by scheduled lessons. Archive it instead.")}`);
  }
  await prisma.room.delete({ where: { id: roomId } });
  await prisma.auditLog.create({ data: { action: "delete", entity: "Room", entityId: roomId, createdById, actorId: session.userId } });
  revalidatePath("/rooms");
  revalidatePath("/schedule");
  redirect(`/rooms?status=archived&success=${encodeURIComponent("Room deleted.")}`);
}

export async function saveTeacherAvailability(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const data = teacherAvailabilitySchema.parse(Object.fromEntries(formData));
  const availabilityData = data as Prisma.TeacherAvailabilityUncheckedCreateInput & Prisma.TeacherAvailabilityUncheckedUpdateInput;
  const row = data.id ? await prisma.teacherAvailability.update({ where: { id: data.id }, data: availabilityData }) : await prisma.teacherAvailability.create({ data: availabilityData as Prisma.TeacherAvailabilityUncheckedCreateInput });
  await prisma.auditLog.create({ data: { action: data.id ? "update" : "create", entity: "TeacherAvailability", entityId: row.id, createdById, actorId: session.userId, metadata: data } });
  revalidatePath("/teacher-availability");
  revalidatePath("/schedule");
}
export async function archiveTeacherAvailability(formData: FormData) {
  const { session, createdById } = await requireAdminAction();
  const row = await prisma.teacherAvailability.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: "archive", entity: "TeacherAvailability", entityId: row.id, createdById, actorId: session.userId } });
  revalidatePath("/teacher-availability");
  revalidatePath("/schedule");
}

const paymentSchema = z.object({ familyId: id.or(z.literal("")).optional().transform((v) => v || null), studentId: id.or(z.literal("")).optional().transform((v) => v || null), paymentDate: z.string().min(1).transform((v) => new Date(v)), paymentMethod: z.string().trim().min(1), notes: optionalString });

export async function createPayment(formData: FormData) {
  const { createdById, session } = await requireRecordsWrite();
  const parsed = paymentSchema.parse(Object.fromEntries(formData));
  const rawEnrollmentIds = formData.getAll("enrollmentId").map(String);
  const amounts = formData.getAll("amount").map((value) => dollarsToCents(String(value)));
  const allocations = rawEnrollmentIds.map((enrollmentId, index) => ({ enrollmentId, amountCents: amounts[index] ?? 0 }));
  const { createPaymentWithAllocations } = await import("@/lib/payments/payment-service");

  let payment;
  try {
    payment = await createPaymentWithAllocations(prisma, { ...parsed, createdById, actorId: session.userId, allocations });
  } catch (error) {
    logServerError("payment.create", error, { familyId: parsed.familyId });
    redirect(`/payments/new?${parsed.studentId ? `payerType=student&studentId=${parsed.studentId}` : `familyId=${parsed.familyId ?? ""}`}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create payment. Please check allocations and try again.")}`);
  }
  revalidatePath("/payments");
  revalidatePath("/payments/allocation");
  revalidatePath("/enrollments");
  revalidatePath(`/payments/${payment.id}`);
}

export async function voidPayment(formData: FormData) {
  const session = await requireSession();
  if (!hasPermission(session.role, "finance:delete")) redirect("/payments?error=Not%20authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const paymentId = id.parse(formData.get("id"));
  const { voidPaymentWithReversal } = await import("@/lib/payments/payment-service");

  try {
    await voidPaymentWithReversal(prisma, { paymentId, createdById: user?.id, actorId: session.userId });
  } catch (error) {
    logServerError("payment.void", error, { paymentId });
    redirect(`/payments/${paymentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to void payment.")}`);
  }
  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/enrollments");
}


export async function generateMissingReceiptNumber(formData: FormData) {
  const session = await requireSession();
  if (!hasPermission(session.role, "finance:delete")) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const paymentId = id.parse(formData.get("id"));
  const { ensurePaymentReceiptWithRetry } = await import("@/lib/payments/receipt-repair");
  try {
    const receiptNumber = await ensurePaymentReceiptWithRetry(prisma, paymentId);
    await prisma.auditLog.create({ data: { action: "generate_receipt_number", entity: "Payment", entityId: paymentId, createdById: user?.id, actorId: session.userId, metadata: { receiptNumber } } });
  } catch (error) {
    logServerError("receipt.repair", error, { paymentId });
    redirect(`/payments?error=${encodeURIComponent("Unable to repair receipt metadata. Please try again.")}`);
  }
  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
}

const blockingStatuses: ScheduleSessionStatus[] = ["SCHEDULED", "COMPLETED", "MISSED"];

async function assertScheduleSessionIsValid(data: z.infer<typeof scheduleSessionSchema>) {
  const enrollment = data.enrollmentId ? await prisma.enrollment.findUnique({ where: { id: data.enrollmentId }, select: { studentId: true, teacherId: true, seasonId: true, enrollmentStartDate: true, enrollmentEndDate: true } }) : null;
  if (data.enrollmentId && !enrollment) throw new Error("Choose a valid enrollment.");
  if (!enrollment) throw new Error("Select an enrollment before booking a lesson.");
  if (enrollment.studentId !== data.studentId) throw new Error("Selected enrollment does not belong to this student.");
  if (!enrollment.teacherId) throw new Error("This enrollment has no teacher assigned. Edit the enrollment before booking.");
  if (data.seasonId && enrollment.seasonId !== data.seasonId) throw new Error("Season must come from the selected enrollment.");
  if (data.teacherId && enrollment.teacherId !== data.teacherId) throw new Error("Teacher must come from the selected enrollment.");
  data.seasonId = enrollment.seasonId;
  data.teacherId = enrollment.teacherId;
  const effectiveSeasonId = enrollment.seasonId;
  const season = await prisma.season.findUnique({ where: { id: effectiveSeasonId }, select: { startDate: true, endDate: true, status: true } });
  if (season?.status === "CLOSED" && !data.id) throw new Error("Closed seasons do not accept new lesson bookings.");
  if (season && (data.sessionDate < season.startDate || data.sessionDate > season.endDate)) throw new Error("Lesson date must be inside the season date range.");
  if (data.sessionDate < enrollment.enrollmentStartDate || data.sessionDate > enrollment.enrollmentEndDate) throw new Error("Lesson date must be inside the enrollment date range.");
  const where = { sessionDate: data.sessionDate, archivedAt: null, status: { in: blockingStatuses }, ...(data.id ? { NOT: { id: data.id } } : {}) };
  const availabilitySeasonId = effectiveSeasonId;
  const [teacherSessions, studentSessions, roomSessions, availabilityRows] = await Promise.all([
    prisma.scheduleSession.findMany({ where: { ...where, teacherId: data.teacherId }, select: { startTime: true, endTime: true } }),
    prisma.scheduleSession.findMany({ where: { ...where, studentId: data.studentId }, select: { startTime: true, endTime: true } }),
    data.roomId ? prisma.scheduleSession.findMany({ where: { ...where, roomId: data.roomId }, select: { startTime: true, endTime: true } }) : Promise.resolve([]),
    prisma.teacherAvailability.findMany({ where: { teacherId: data.teacherId, dayOfWeek: data.sessionDate.getUTCDay(), status: "ACTIVE", archivedAt: null, OR: availabilitySeasonId ? [{ seasonId: null }, { seasonId: availabilitySeasonId }] : [{ seasonId: null }] }, select: { startTime: true, endTime: true, effectiveFrom: true, effectiveTo: true } }),
  ]);
  const matchingAvailability = availabilityRows.filter((row) => (!row.effectiveFrom || data.sessionDate >= row.effectiveFrom) && (!row.effectiveTo || data.sessionDate <= row.effectiveTo));
  if (!matchingAvailability.some((row) => minutesFromTime(row.startTime) <= minutesFromTime(data.startTime) && minutesFromTime(data.endTime) <= minutesFromTime(row.endTime))) throw new Error("Teacher is not available.");
  if (teacherSessions.some((session) => timeWindowsOverlap(session, data))) throw new Error("Teacher is already booked.");
  if (studentSessions.some((session) => timeWindowsOverlap(session, data))) throw new Error("Student is already booked.");
  if (roomSessions.some((session) => timeWindowsOverlap(session, data))) throw new Error("Room is already booked.");
}

function scheduleErrorRedirect(formData: FormData, message: string): never {
  const query = new URLSearchParams();
  query.set("error", message);
  query.set("view", "calendar");
  for (const key of ["studentId", "teacherId", "roomId", "enrollmentId", "seasonId", "title", "sessionDate", "startTime", "endTime", "status", "notes"] as const) {
    const value = formData.get(key);
    if (typeof value === "string" && value) query.set(key === "sessionDate" ? "date" : `form_${key}`, value);
  }
  redirect(`/schedule?${query.toString()}#session-form`);
}

export async function saveScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  let data: z.infer<typeof scheduleSessionSchema>;
  try {
    data = scheduleSessionSchema.parse(Object.fromEntries(formData));
    await assertScheduleSessionIsValid(data);
  } catch (error) {
    if (error instanceof z.ZodError) scheduleErrorRedirect(formData, error.issues[0]?.message ?? "Please check the required schedule fields.");
    if (error instanceof Error) scheduleErrorRedirect(formData, error.message);
    scheduleErrorRedirect(formData, "Please check the required schedule fields.");
  }
  const writeData = data as Prisma.ScheduleSessionUncheckedCreateInput & Prisma.ScheduleSessionUncheckedUpdateInput;
  const row = data.id ? await prisma.scheduleSession.update({ where: { id: data.id }, data: writeData }) : await prisma.scheduleSession.create({ data: writeData as Prisma.ScheduleSessionUncheckedCreateInput });
  await audit(data.id ? "update" : "create", "ScheduleSession", row.id, data);
  revalidatePath("/schedule");
}

export async function archiveScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.scheduleSession.update({ where: { id: id.parse(formData.get("id")) }, data: { archivedAt: new Date() } });
  await audit("archive", "ScheduleSession", row.id);
  revalidatePath("/schedule");
}
export async function restoreScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.scheduleSession.update({ where: { id: id.parse(formData.get("id")) }, data: { archivedAt: null } });
  await audit("restore", "ScheduleSession", row.id);
  revalidatePath("/schedule");
}

export async function cancelScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.scheduleSession.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "CANCELLED" } });
  await audit("cancel", "ScheduleSession", row.id);
  revalidatePath("/schedule");
}

const registrationStudentInputSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: optionalEmail,
  phone: optionalString,
  dateOfBirth: z.string().optional().transform((v) => v ? new Date(v) : null),
});

const registrationSchema = z.object({
  studentId: id.or(z.literal("new")).optional().default("new"),
  registrationType: z.enum(["independent_student", "new_family_group", "existing_family_group", "existing_student", "independent", "existing-family", "new-family"]).default("independent_student"),
  familyId: id.or(z.literal("")).optional().transform((v) => v || null),
  createFamilyFromStudent: z.string().optional(),
  familyName: z.string().trim().optional(),
  familyEmail: optionalEmail,
  familyPhone: optionalString,
  familyNotes: optionalString,
  fatherFirstName: optionalString,
  fatherLastName: optionalString,
  fatherJob: optionalString,
  fatherPhone: optionalString,
  fatherEmail: optionalEmail,
  motherFirstName: optionalString,
  motherLastName: optionalString,
  motherJob: optionalString,
  motherPhone: optionalString,
  motherEmail: optionalEmail,
  address: optionalString,
  emergencyContactName: optionalString,
  emergencyContactPhone: optionalString,
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: optionalEmail,
  phone: optionalString,
  primaryStudentIndex: z.string().default("0"),
  seasonId: id,
  courseId: id,
  levelId: id,
  courseName: z.string().trim().optional(),
  teacherId: id.or(z.literal("")).optional().transform((v) => v || null),
  enrollmentStartDate: z.string().optional(),
  enrollmentEndDate: z.string().optional(),
  fee: z.string().default("0"),
  discount: z.string().default("0"),
  initialPayment: z.string().default("0"),
  paymentMethod: z.string().default("cash"),
  bookFirstSession: z.string().optional(),
  sessionDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

function registrationErrorRedirect(message: string): never {
  redirect(`/register-student?error=${encodeURIComponent(message)}`);
}

function getRegistrationStudents(formData: FormData) {
  const firstNames = formData.getAll("studentFirstName").map(String);
  const lastNames = formData.getAll("studentLastName").map(String);
  const emails = formData.getAll("studentEmail").map(String);
  const phones = formData.getAll("studentPhone").map(String);
  const datesOfBirth = formData.getAll("studentDateOfBirth").map(String);
  const rows = firstNames.map((firstName, index) => registrationStudentInputSchema.parse({ firstName, lastName: lastNames[index] ?? "", email: emails[index] ?? "", phone: phones[index] ?? "", dateOfBirth: datesOfBirth[index] ?? "" }))
    .filter((row) => row.firstName || row.lastName || row.email || row.phone);
  return rows;
}

export async function registerStudentWorkflow(formData: FormData) {
  const { createdById, session } = await requireRecordsWrite();
  let parsed: z.infer<typeof registrationSchema>;
  try {
    parsed = registrationSchema.parse(Object.fromEntries(formData));
  } catch (error) {
    registrationErrorRedirect(error instanceof z.ZodError ? error.issues[0]?.message ?? "Please check the registration form." : "Please check the registration form.");
  }
  const [course, season] = await Promise.all([prisma.course.findUnique({ where: { id: parsed.courseId }, select: { name: true } }), prisma.season.findUnique({ where: { id: parsed.seasonId }, select: { startDate: true, endDate: true, status: true } })]);
  if (!course) registrationErrorRedirect("Choose a valid course.");
  if (!season) registrationErrorRedirect("Choose a valid season.");
  if (!["PLANNED", "ACTIVE"].includes(season.status)) registrationErrorRedirect("Only planned or active seasons accept new registrations. Payments toward existing balances are still allowed from Payments.");
  const courseName = course.name;
  const enrollmentStartDate = parsed.enrollmentStartDate ? new Date(parsed.enrollmentStartDate) : season.startDate;
  const enrollmentEndDate = parsed.enrollmentEndDate ? new Date(parsed.enrollmentEndDate) : season.endDate;
  if (enrollmentStartDate < season.startDate || enrollmentEndDate > season.endDate || enrollmentEndDate < enrollmentStartDate) registrationErrorRedirect("Enrollment dates must stay inside the selected season.");
  const feeCents = dollarsToCents(parsed.fee);
  const discountCents = dollarsToCents(parsed.discount);
  const finalFeeCents = Math.max(0, feeCents - discountCents);
  const initialPaymentCents = dollarsToCents(parsed.initialPayment);
  if (parsed.bookFirstSession) {
    if (!parsed.teacherId) registrationErrorRedirect("Choose a teacher before booking the first lesson.");
    if (!parsed.sessionDate) registrationErrorRedirect("First lesson date is required when booking the first lesson.");
    const firstLessonDate = new Date(parsed.sessionDate);
    if (firstLessonDate < enrollmentStartDate || firstLessonDate > enrollmentEndDate) registrationErrorRedirect("First lesson date must be inside the enrollment date range.");
    if (firstLessonDate < season.startDate || firstLessonDate > season.endDate) registrationErrorRedirect("First lesson date must be inside the enrollment date range.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const normalizedRegistrationType = parsed.registrationType === "independent" ? "independent_student" : parsed.registrationType === "existing-family" ? "existing_family_group" : parsed.registrationType === "new-family" ? "new_family_group" : parsed.registrationType;
      let familyId = normalizedRegistrationType === "existing_family_group" ? parsed.familyId : null;
      const createdStudentIds: string[] = [];
      let primaryStudentId = normalizedRegistrationType === "existing_student" && parsed.studentId !== "new" ? parsed.studentId : null;

      if (normalizedRegistrationType === "existing_student" && !primaryStudentId) throw new Error("Choose the existing student receiving this new enrollment.");
      if (normalizedRegistrationType === "existing_family_group" && !familyId) throw new Error("Choose an existing Family / Group or switch registration type.");
      if (normalizedRegistrationType === "new_family_group") {
        if (!parsed.familyName) throw new Error("Family / Group name is required for a new family registration.");
        const family = await tx.family.create({ data: { name: parsed.familyName, email: parsed.familyEmail, phone: parsed.familyPhone, notes: parsed.familyNotes, fatherFirstName: parsed.fatherFirstName, fatherLastName: parsed.fatherLastName, fatherJob: parsed.fatherJob, fatherPhone: parsed.fatherPhone, fatherEmail: parsed.fatherEmail, motherFirstName: parsed.motherFirstName, motherLastName: parsed.motherLastName, motherJob: parsed.motherJob, motherPhone: parsed.motherPhone, motherEmail: parsed.motherEmail, address: parsed.address, emergencyContactName: parsed.emergencyContactName, emergencyContactPhone: parsed.emergencyContactPhone } });
        familyId = family.id;
        await tx.auditLog.create({ data: { action: "create", entity: "Family", entityId: family.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow", explicitFamilyFields: true } } });
      }

      const studentRows = getRegistrationStudents(formData);
      if (normalizedRegistrationType !== "existing_student" && !primaryStudentId && studentRows.length === 0 && (parsed.firstName || parsed.lastName)) studentRows.push({ firstName: parsed.firstName, lastName: parsed.lastName, email: parsed.email, phone: parsed.phone, dateOfBirth: null });
      if (normalizedRegistrationType !== "existing_student" && !primaryStudentId && studentRows.length === 0) throw new Error("Add at least one student before confirming registration.");
      if (normalizedRegistrationType === "independent_student" && studentRows.length > 1) throw new Error("Multiple students require an existing or new Family / Group.");
      if (normalizedRegistrationType === "existing_student" && studentRows.length > 0) throw new Error("Existing student registration creates a new enrollment only. Edit student profiles from the Students page.");

      if (!familyId && parsed.createFamilyFromStudent && studentRows[0]) {
        const family = await tx.family.create({ data: { name: `${studentRows[0].lastName} Family / Group`, email: studentRows[0].email, phone: studentRows[0].phone } });
        familyId = family.id;
        await tx.auditLog.create({ data: { action: "create", entity: "Family", entityId: family.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow", legacyCreateFamilyFromStudent: true } } });
      }

      for (const row of studentRows) {
        if (!row.firstName || !row.lastName) throw new Error("Each added student needs a first and last name.");
        const studentData = buildStudentCreateData({ firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, dateOfBirth: row.dateOfBirth }, familyId);
        const student = await createStudentWithCode(tx.student, studentData as any);
        createdStudentIds.push(student.id);
        await tx.auditLog.create({ data: { action: "create", entity: "Student", entityId: student.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow", familyId } } });
      }

      if (!primaryStudentId) {
        const requestedIndex = Math.max(0, Number.parseInt(parsed.primaryStudentIndex, 10) || 0);
        primaryStudentId = createdStudentIds[Math.min(requestedIndex, createdStudentIds.length - 1)];
      }
      if (!primaryStudentId) throw new Error("Choose which student should receive the enrollment.");

      const duplicate = await tx.enrollment.findFirst({ where: { studentId: primaryStudentId, seasonId: parsed.seasonId, courseId: parsed.courseId, levelId: parsed.levelId, archivedAt: null } });
      if (duplicate) throw new Error("This student is already enrolled in that course and level for the selected season.");
      const enrollment = await tx.enrollment.create({ data: { studentId: primaryStudentId, seasonId: parsed.seasonId, teacherId: parsed.teacherId, courseId: parsed.courseId, levelId: parsed.levelId, courseName, enrollmentStartDate, enrollmentEndDate, feeCents, discountCents, finalFeeCents, remainingCents: finalFeeCents } });
      await tx.auditLog.create({ data: { action: "create", entity: "Enrollment", entityId: enrollment.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow", registrationType: normalizedRegistrationType, primaryStudentId, additionalStudentIds: createdStudentIds.filter((studentId) => studentId !== primaryStudentId) } } });

      let sessionRow = null;
      if (parsed.bookFirstSession) {
        if (!parsed.teacherId) throw new Error("Choose a teacher before booking the first lesson.");
        if (!parsed.sessionDate || !parsed.startTime || !parsed.endTime) throw new Error("Date, start time, and end time are required to book the first lesson.");
        const sessionData = scheduleSessionSchema.parse({ studentId: primaryStudentId, teacherId: parsed.teacherId, enrollmentId: enrollment.id, seasonId: parsed.seasonId, sessionDate: parsed.sessionDate, startTime: parsed.startTime, endTime: parsed.endTime, status: "SCHEDULED", title: courseName });
        await assertScheduleSessionIsValid(sessionData);
        sessionRow = await tx.scheduleSession.create({ data: sessionData as Prisma.ScheduleSessionUncheckedCreateInput });
        await tx.auditLog.create({ data: { action: "create", entity: "ScheduleSession", entityId: sessionRow.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow" } } });
      }

      return { enrollmentId: enrollment.id, sessionId: sessionRow?.id ?? null, needsPayment: initialPaymentCents > 0, familyId, studentId: primaryStudentId, createdStudentCount: createdStudentIds.length };
    });

    let paymentId: string | null = null;
    if (result.needsPayment) {
      const familyId = result.familyId;
      const studentId = familyId ? null : result.studentId;
      const { createPaymentWithAllocations } = await import("@/lib/payments/payment-service");
      const payment = await createPaymentWithAllocations(prisma, { familyId, studentId, paymentDate: new Date(), paymentMethod: parsed.paymentMethod, notes: "Initial payment from registration workflow", createdById, actorId: session.userId, allocations: [{ enrollmentId: result.enrollmentId, amountCents: initialPaymentCents }] });
      paymentId = payment.id;
      await prisma.auditLog.create({ data: { action: "create", entity: "Payment", entityId: payment.id, createdById, actorId: session.userId, metadata: { source: "registration_workflow", enrollmentId: result.enrollmentId, amountCents: initialPaymentCents } } });
    }

    revalidatePath("/register-student");
    revalidatePath("/students");
    revalidatePath("/enrollments");
    revalidatePath("/schedule");
    const successUrl = `/register-student?success=1&enrollmentId=${result.enrollmentId}&students=${result.createdStudentCount}${result.sessionId ? `&sessionId=${result.sessionId}` : ""}${paymentId ? `&paymentId=${paymentId}` : ""}`;
    redirect(successUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    logServerError("registration.workflow", error, {});
    registrationErrorRedirect(error instanceof Error ? error.message : "Unable to register student. Please check the form and try again.");
  }
}

async function requireAdminConfig() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  return { session, createdById: user?.id };
}

const courseSchema = z.object({ id: id.optional(), name: z.string().trim().min(1).transform(normalizeName), category: optionalString, description: optionalString, status: z.enum(["ACTIVE", "ARCHIVED"]) });
export async function saveCourse(formData: FormData) {
  await requireAdminConfig();
  const data = courseSchema.parse(Object.fromEntries(formData));
  const duplicate = await prisma.course.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(data.id ? { NOT: { id: data.id } } : {}) } });
  if (duplicate) redirect(academicPricingUrl("error", duplicate.status === "ARCHIVED" ? "This course already exists but is archived. Restore it instead." : "Course already exists."));
  try {
    const row = data.id ? await prisma.course.update({ where: { id: data.id }, data }) : await prisma.course.create({ data });
    await audit(data.id ? "update" : "create", "Course", row.id, data);
  } catch (error) { if (isUniqueConstraintError(error)) redirect(academicPricingUrl("error", "Course already exists.")); throw error; }
  revalidatePath("/admin/courses"); revalidatePath("/admin/academic-pricing");
}
export async function archiveCourse(formData: FormData) {
  await requireAdminConfig();
  const row = await prisma.course.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await audit("archive", "Course", row.id); revalidatePath("/admin/courses"); revalidatePath("/admin/academic-pricing");
}
export async function restoreCourse(formData: FormData) {
  await requireAdminConfig();
  const row = await prisma.course.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } });
  await audit("restore", "Course", row.id); revalidatePath("/admin/courses"); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Course restored."));
}
export async function deleteCourse(formData: FormData) {
  await requireAdminConfig(); const courseId = id.parse(formData.get("id"));
  const [enrollments, pricings, sessions] = await Promise.all([prisma.enrollment.count({ where: { courseId } }), prisma.coursePricing.count({ where: { courseId } }), prisma.scheduleSession.count({ where: { enrollment: { courseId } } })]);
  if (enrollments || pricings || sessions) redirect(academicPricingUrl("error", "This course is already used and cannot be deleted. Archive it instead."));
  await prisma.course.delete({ where: { id: courseId } }); await audit("delete", "Course", courseId); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Unused course deleted."));
}

const courseLevelSchema = z.object({ id: id.optional(), name: z.string().trim().min(1).transform(normalizeName), order: z.coerce.number().int().default(0), status: z.enum(["ACTIVE", "ARCHIVED"]) });
export async function saveCourseLevel(formData: FormData) {
  await requireAdminConfig(); const data = courseLevelSchema.parse(Object.fromEntries(formData));
  const duplicate = await prisma.courseLevel.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(data.id ? { NOT: { id: data.id } } : {}) } });
  if (duplicate) redirect(academicPricingUrl("error", duplicate.status === "ARCHIVED" ? "This level already exists but is archived. Restore it instead." : "Level already exists."));
  try { const row = data.id ? await prisma.courseLevel.update({ where: { id: data.id }, data }) : await prisma.courseLevel.create({ data }); await audit(data.id ? "update" : "create", "CourseLevel", row.id, data); }
  catch (error) { if (isUniqueConstraintError(error)) redirect(academicPricingUrl("error", "Level already exists.")); throw error; }
  revalidatePath("/admin/course-levels"); revalidatePath("/admin/academic-pricing");
}
export async function archiveCourseLevel(formData: FormData) { await requireAdminConfig(); const row = await prisma.courseLevel.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } }); await audit("archive", "CourseLevel", row.id); revalidatePath("/admin/course-levels"); revalidatePath("/admin/academic-pricing"); }
export async function restoreCourseLevel(formData: FormData) { await requireAdminConfig(); const row = await prisma.courseLevel.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE", archivedAt: null } }); await audit("restore", "CourseLevel", row.id); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Level restored.")); }
export async function deleteCourseLevel(formData: FormData) { await requireAdminConfig(); const levelId = id.parse(formData.get("id")); const [enrollments, pricings] = await Promise.all([prisma.enrollment.count({ where: { levelId } }), prisma.coursePricing.count({ where: { levelId } })]); if (enrollments || pricings) redirect(academicPricingUrl("error", "This level is already used and cannot be deleted. Archive it instead.")); await prisma.courseLevel.delete({ where: { id: levelId } }); await audit("delete", "CourseLevel", levelId); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Unused level deleted.")); }

const coursePricingSchema = z.object({ id: id.optional(), courseId: id, levelId: id, seasonId: id.or(z.literal("")).optional().transform((v) => v || null), price: z.string().default("0"), status: z.enum(["ACTIVE", "ARCHIVED"]) });
export async function saveCoursePricing(formData: FormData) {
  await requireAdminConfig(); const parsed = coursePricingSchema.parse(Object.fromEntries(formData));
  const data = { id: parsed.id, courseId: parsed.courseId, levelId: parsed.levelId, seasonId: parsed.seasonId, priceCents: dollarsToCents(parsed.price), status: parsed.status };
  const duplicate = await prisma.coursePricing.findFirst({ where: { courseId: data.courseId, levelId: data.levelId, seasonId: data.seasonId, ...(data.id ? { NOT: { id: data.id } } : {}) } });
  if (duplicate) {
    if (duplicate.status === "ARCHIVED") { const row = await prisma.coursePricing.update({ where: { id: duplicate.id }, data: { priceCents: data.priceCents, status: "ACTIVE" } }); await audit("restore", "CoursePricing", row.id, data); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Archived price restored and updated.")); }
    redirect(academicPricingUrl("error", "A price already exists for this course, level, and season. Edit it instead."));
  }
  try { const row = data.id ? await prisma.coursePricing.update({ where: { id: data.id }, data }) : await prisma.coursePricing.create({ data }); await audit(data.id ? "update" : "create", "CoursePricing", row.id, data); }
  catch (error) { if (isUniqueConstraintError(error)) redirect(academicPricingUrl("error", "A price already exists for this course, level, and season. Edit it instead.")); throw error; }
  revalidatePath("/admin/course-pricing"); revalidatePath("/admin/academic-pricing");
}
export async function archiveCoursePricing(formData: FormData) {
  await requireAdminConfig();
  const row = await prisma.coursePricing.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED" } });
  await audit("archive", "CoursePricing", row.id);
  revalidatePath("/admin/course-pricing"); revalidatePath("/admin/academic-pricing");
}
export async function restoreCoursePricing(formData: FormData) { await requireAdminConfig(); const row = await prisma.coursePricing.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ACTIVE" } }); await audit("restore", "CoursePricing", row.id); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Price restored.")); }
export async function deleteCoursePricing(formData: FormData) { await requireAdminConfig(); const pricingId = id.parse(formData.get("id")); await prisma.coursePricing.delete({ where: { id: pricingId } }); await audit("delete", "CoursePricing", pricingId); revalidatePath("/admin/academic-pricing"); redirect(academicPricingUrl("success", "Unused price deleted.")); }
