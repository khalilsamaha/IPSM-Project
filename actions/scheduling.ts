"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { createPatternAndGenerate, generateMissingLessons } from "@/lib/schedule/recurring";

const uuid = z.string().uuid();
async function admin() { const session = await requireSession(); if (!isAdminOrHigher(session.role)) throw new Error("Not authorized"); const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } }); return { session, createdById: user?.id }; }
const patternSchema = z.object({ enrollmentId: uuid, teacherId: uuid, roomId: uuid.or(z.literal("")).transform((v) => v || null), dayOfWeek: z.coerce.number().int().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), startsOn: z.string().transform((v) => new Date(v)), endsOn: z.string().transform((v) => new Date(v)) });

export async function createRecurringSchedule(formData: FormData) {
  const actor = await admin(); const input = patternSchema.parse(Object.fromEntries(formData));
  try {
    const result = await createPatternAndGenerate(prisma, input);
    await prisma.auditLog.create({ data: { action: "schedule_pattern_create", entity: "SchedulePattern", entityId: result.pattern.id, actorId: actor.session.userId, createdById: actor.createdById, metadata: { enrollmentId: input.enrollmentId, createdCount: result.createdCount, closureCount: result.preview.closureDatesSkipped.length } } });
    revalidatePath("/schedule"); revalidatePath("/enrollments");
  } catch (error) {
    await prisma.auditLog.create({ data: { action: "schedule_generation_blocked", entity: "SchedulePattern", entityId: null, actorId: actor.session.userId, createdById: actor.createdById, metadata: { enrollmentId: input.enrollmentId, reason: error instanceof Error ? error.message : "Validation failed" } } });
    throw error;
  }
}
export async function regenerateRecurringSchedule(formData: FormData) { const actor = await admin(); const patternId = uuid.parse(formData.get("id")); const result = await generateMissingLessons(prisma, patternId); await prisma.auditLog.create({ data: { action: "schedule_pattern_regenerate", entity: "SchedulePattern", entityId: patternId, actorId: actor.session.userId, createdById: actor.createdById, metadata: { createdCount: result.createdCount, existingCount: result.preview.existingDatesSkipped.length } } }); revalidatePath("/schedule"); }
export async function setPatternArchived(formData: FormData) { const actor = await admin(); const patternId = uuid.parse(formData.get("id")); const restore = formData.get("restore") === "true"; await prisma.schedulePattern.update({ where: { id: patternId }, data: { status: restore ? "ACTIVE" : "ARCHIVED", archivedAt: restore ? null : new Date() } }); await prisma.auditLog.create({ data: { action: restore ? "schedule_pattern_restore" : "schedule_pattern_archive", entity: "SchedulePattern", entityId: patternId, actorId: actor.session.userId, createdById: actor.createdById } }); revalidatePath("/schedule"); }

const closureSchema = z.object({ id: uuid.optional(), name: z.string().trim().min(1), startDate: z.string().min(1).transform((v) => new Date(v)), endDate: z.string().min(1).transform((v) => new Date(v)), notes: z.string().trim().optional().transform((v) => v || null), confirmOverlap: z.string().optional() }).refine((v) => v.endDate >= v.startDate, { message: "End date cannot precede start date.", path: ["endDate"] });
export async function saveSchoolClosure(formData: FormData) { const actor = await admin(); const data = closureSchema.parse(Object.fromEntries(formData)); const overlap = await prisma.schoolClosure.findFirst({ where: { archivedAt: null, startDate: { lte: data.endDate }, endDate: { gte: data.startDate }, ...(data.id ? { NOT: { id: data.id } } : {}) } }); if (overlap && data.confirmOverlap !== "yes") redirect(`/admin/school-closures?error=${encodeURIComponent(`Dates overlap ${overlap.name}. Select confirm overlap to continue.`)}`); const { id, confirmOverlap: _, ...values } = data; const row = id ? await prisma.schoolClosure.update({ where: { id }, data: values }) : await prisma.schoolClosure.create({ data: values }); await prisma.auditLog.create({ data: { action: id ? "school_closure_update" : "school_closure_create", entity: "SchoolClosure", entityId: row.id, actorId: actor.session.userId, createdById: actor.createdById, metadata: { name: row.name, startDate: row.startDate, endDate: row.endDate, overlapConfirmed: Boolean(overlap) } } }); revalidatePath("/admin/school-closures"); }
export async function setSchoolClosureArchived(formData: FormData) { const actor = await admin(); const closureId = uuid.parse(formData.get("id")); const restore = formData.get("restore") === "true"; await prisma.schoolClosure.update({ where: { id: closureId }, data: { archivedAt: restore ? null : new Date() } }); await prisma.auditLog.create({ data: { action: restore ? "school_closure_restore" : "school_closure_archive", entity: "SchoolClosure", entityId: closureId, actorId: actor.session.userId, createdById: actor.createdById } }); revalidatePath("/admin/school-closures"); }
