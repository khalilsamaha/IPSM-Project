"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/dashboard/data";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";

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
