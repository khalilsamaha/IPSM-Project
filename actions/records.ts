"use server";

import { revalidatePath } from "next/cache";
import { ScheduleSessionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/dashboard/data";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { scheduleSessionSchema, timeWindowsOverlap } from "@/lib/schedule/validation";

async function requireRecordsWrite() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
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

const familySchema = z.object({ id: id.optional(), name: z.string().trim().min(1), email: optionalEmail, phone: optionalString, status: z.enum(["ACTIVE", "INACTIVE"]), notes: optionalString });
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

const studentSchema = z.object({ id: id.optional(), familyId: id, firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: optionalEmail, phone: optionalString, dateOfBirth: z.string().optional().transform((v) => v ? new Date(v) : null), status: z.enum(["ACTIVE", "INACTIVE"])});
export async function saveStudent(formData: FormData) {
  await requireRecordsWrite();
  const data = studentSchema.parse(Object.fromEntries(formData));
  const row = data.id ? await prisma.student.update({ where: { id: data.id }, data }) : await prisma.student.create({ data });
  await audit(data.id ? "update" : "create", "Student", row.id, data);
  revalidatePath("/students");
}
export async function archiveStudent(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.student.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "INACTIVE", archivedAt: new Date() } });
  await audit("archive", "Student", row.id);
  revalidatePath("/students");
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

const seasonSchema = z.object({ id: id.optional(), name: z.string().trim().min(1), startDate: z.string().min(1).transform((v) => new Date(v)), endDate: z.string().min(1).transform((v) => new Date(v)), status: z.enum(["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"]) }).refine((v) => v.endDate >= v.startDate, "End date must be after start date");
export async function saveSeason(formData: FormData) {
  await requireRecordsWrite();
  const data = seasonSchema.parse(Object.fromEntries(formData));
  const row = data.id ? await prisma.season.update({ where: { id: data.id }, data }) : await prisma.season.create({ data });
  await audit(data.id ? "update" : "create", "Season", row.id, data);
  revalidatePath("/seasons");
}
export async function archiveSeason(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.season.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await audit("archive", "Season", row.id);
  revalidatePath("/seasons");
}

const enrollmentSchema = z.object({ id: id.optional(), studentId: id, seasonId: id, teacherId: id.or(z.literal("")).transform((v) => v || null), courseName: z.string().trim().min(1), fee: z.string().default("0"), discount: z.string().default("0"), status: z.enum(["ACTIVE", "PAUSED", "ENDED", "CANCELLED"]) });
export async function saveEnrollment(formData: FormData) {
  await requireRecordsWrite();
  const parsed = enrollmentSchema.parse(Object.fromEntries(formData));
  const feeCents = dollarsToCents(parsed.fee);
  const discountCents = dollarsToCents(parsed.discount);
  const finalFeeCents = Math.max(0, feeCents - discountCents);
  const data = { id: parsed.id, studentId: parsed.studentId, seasonId: parsed.seasonId, teacherId: parsed.teacherId, courseName: parsed.courseName, status: parsed.status, feeCents, discountCents, finalFeeCents, remainingCents: finalFeeCents };
  const row = data.id ? await prisma.enrollment.update({ where: { id: data.id }, data }) : await prisma.enrollment.create({ data });
  await audit(data.id ? "update" : "create", "Enrollment", row.id, data);
  revalidatePath("/enrollments");
}
export async function archiveEnrollment(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.enrollment.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "ENDED", archivedAt: new Date() } });
  await audit("archive", "Enrollment", row.id);
  revalidatePath("/enrollments");
}

const paymentSchema = z.object({ familyId: id, paymentDate: z.string().min(1).transform((v) => new Date(v)), paymentMethod: z.string().trim().min(1), notes: optionalString });

export async function createPayment(formData: FormData) {
  const { createdById, session } = await requireRecordsWrite();
  const parsed = paymentSchema.parse(Object.fromEntries(formData));
  const rawEnrollmentIds = formData.getAll("enrollmentId").map(String);
  const amounts = formData.getAll("amount").map((value) => dollarsToCents(String(value)));
  const allocations = rawEnrollmentIds.map((enrollmentId, index) => ({ enrollmentId, amountCents: amounts[index] ?? 0 }));
  const { createPaymentWithAllocations } = await import("@/lib/payments/payment-service");

  const payment = await createPaymentWithAllocations(prisma, { ...parsed, createdById, actorId: session.userId, allocations });
  revalidatePath("/payments");
  revalidatePath("/payments/allocation");
  revalidatePath("/enrollments");
  revalidatePath(`/payments/${payment.id}`);
}

export async function voidPayment(formData: FormData) {
  const session = await requireSession();
  if (!hasPermission(session.role, "finance:delete")) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const paymentId = id.parse(formData.get("id"));
  const { voidPaymentWithReversal } = await import("@/lib/payments/payment-service");

  await voidPaymentWithReversal(prisma, { paymentId, createdById: user?.id, actorId: session.userId });
  revalidatePath("/payments");
  revalidatePath(`/payments/${paymentId}`);
  revalidatePath("/enrollments");
}

const blockingStatuses: ScheduleSessionStatus[] = ["SCHEDULED", "COMPLETED", "MISSED"];

async function assertScheduleSessionIsValid(data: z.infer<typeof scheduleSessionSchema>) {
  const seasonId = data.seasonId;
  if (seasonId) {
    const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { startDate: true, endDate: true } });
    if (season && (data.sessionDate < season.startDate || data.sessionDate > season.endDate)) throw new Error("Session date must be inside the selected season date range.");
  }
  const where = { sessionDate: data.sessionDate, archivedAt: null, status: { in: blockingStatuses }, ...(data.id ? { NOT: { id: data.id } } : {}) };
  const [teacherSessions, studentSessions] = await Promise.all([
    prisma.scheduleSession.findMany({ where: { ...where, teacherId: data.teacherId }, select: { startTime: true, endTime: true } }),
    prisma.scheduleSession.findMany({ where: { ...where, studentId: data.studentId }, select: { startTime: true, endTime: true } }),
  ]);
  if (teacherSessions.some((session) => timeWindowsOverlap(session, data))) throw new Error("Teacher is already booked during this time.");
  if (studentSessions.some((session) => timeWindowsOverlap(session, data))) throw new Error("Student is already booked during this time.");
}

export async function saveScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const data = scheduleSessionSchema.parse(Object.fromEntries(formData));
  await assertScheduleSessionIsValid(data);
  const row = data.id ? await prisma.scheduleSession.update({ where: { id: data.id }, data }) : await prisma.scheduleSession.create({ data });
  await audit(data.id ? "update" : "create", "ScheduleSession", row.id, data);
  revalidatePath("/schedule");
}

export async function archiveScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.scheduleSession.update({ where: { id: id.parse(formData.get("id")) }, data: { archivedAt: new Date() } });
  await audit("archive", "ScheduleSession", row.id);
  revalidatePath("/schedule");
}

export async function cancelScheduleSession(formData: FormData) {
  await requireRecordsWrite();
  const row = await prisma.scheduleSession.update({ where: { id: id.parse(formData.get("id")) }, data: { status: "CANCELLED" } });
  await audit("cancel", "ScheduleSession", row.id);
  revalidatePath("/schedule");
}
