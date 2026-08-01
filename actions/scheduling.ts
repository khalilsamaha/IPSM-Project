"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { parseIsoDateOnly } from "@/lib/date-time";
import { createPatternAndGenerate, generateMissingLessons } from "@/lib/schedule/recurring";
import {
  buildRecurringSlotPlan,
  type SlotBooking,
  type SlotRule,
} from "@/lib/schedule/slot-planner";

const uuid = z.string().uuid();

async function admin() {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized");
  const user = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  return { session, createdById: user?.id };
}

const registrationSlotInputSchema = z.object({
  teacherId: uuid,
  courseId: uuid,
  levelId: uuid,
  seasonId: uuid,
  studentId: uuid.nullable().optional(),
  requestedStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type RegistrationSlotPlanInput = z.infer<typeof registrationSlotInputSchema>;

export async function getRegistrationSlotPlan(raw: RegistrationSlotPlanInput) {
  await requireSession();
  const input = registrationSlotInputSchema.parse(raw);
  const [season, assignment] = await Promise.all([
    prisma.season.findUnique({
      where: { id: input.seasonId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    }),
    prisma.teacherCourse.findFirst({
      where: {
        teacherId: input.teacherId,
        courseId: input.courseId,
        status: "ACTIVE",
        archivedAt: null,
        teacher: { status: "ACTIVE" },
        OR: [{ levelId: null }, { levelId: input.levelId }],
      },
      select: { id: true },
    }),
  ]);
  if (!season || !["PLANNED", "ACTIVE"].includes(season.status)) {
    throw new Error("Choose a planned or active season.");
  }
  if (!assignment) {
    throw new Error(
      "The selected teacher is not actively assigned to this course and level.",
    );
  }

  const seasonStart = season.startDate.toISOString().slice(0, 10);
  const seasonEnd = season.endDate.toISOString().slice(0, 10);
  const requestedStart =
    input.requestedStart < seasonStart ? seasonStart : input.requestedStart;
  const requestedEnd =
    input.requestedEnd > seasonEnd ? seasonEnd : input.requestedEnd;
  if (requestedStart > requestedEnd) {
    throw new Error("Enrollment dates must overlap the selected season.");
  }

  const [availability, sessions, closures] = await Promise.all([
    prisma.teacherAvailability.findMany({
      where: {
        teacherId: input.teacherId,
        status: "ACTIVE",
        archivedAt: null,
        AND: [
          { OR: [{ seasonId: null }, { seasonId: input.seasonId }] },
          { OR: [{ courseId: null }, { courseId: input.courseId }] },
        ],
      },
      include: { course: { select: { name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.scheduleSession.findMany({
      where: {
        archivedAt: null,
        status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] },
        sessionDate: {
          gte: parseIsoDateOnly(requestedStart),
          lte: parseIsoDateOnly(requestedEnd),
        },
        OR: [
          { teacherId: input.teacherId },
          ...(input.studentId ? [{ studentId: input.studentId }] : []),
        ],
      },
      include: {
        student: { include: { family: { select: { name: true } } } },
        enrollment: {
          include: {
            course: { select: { name: true } },
            level: { select: { name: true } },
          },
        },
        room: { select: { name: true } },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.schoolClosure.findMany({
      where: {
        archivedAt: null,
        startDate: { lte: parseIsoDateOnly(requestedEnd) },
        endDate: { gte: parseIsoDateOnly(requestedStart) },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const rules: SlotRule[] = availability.map((rule) => ({
    id: rule.id,
    teacherId: rule.teacherId,
    courseId: rule.courseId,
    courseName: rule.course?.name ?? null,
    seasonId: rule.seasonId,
    dayOfWeek: rule.dayOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
    effectiveFrom: rule.effectiveFrom?.toISOString().slice(0, 10) ?? null,
    effectiveTo: rule.effectiveTo?.toISOString().slice(0, 10) ?? null,
  }));
  const bookings: SlotBooking[] = sessions.map((session) => ({
    id: session.id,
    teacherId: session.teacherId,
    studentId: session.studentId,
    date: session.sessionDate.toISOString().slice(0, 10),
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    studentName: `${session.student.firstName} ${session.student.lastName}`,
    familyName: session.student.family.name,
    courseName:
      session.enrollment?.course?.name ??
      session.enrollment?.courseName ??
      session.title,
    levelName: session.enrollment?.level?.name ?? null,
    roomName: session.room?.name ?? null,
  }));

  return {
    season: {
      id: season.id,
      name: season.name,
      startDate: seasonStart,
      endDate: seasonEnd,
    },
    ...buildRecurringSlotPlan({
      teacherId: input.teacherId,
      courseId: input.courseId,
      seasonId: input.seasonId,
      studentId: input.studentId,
      seasonStart,
      seasonEnd,
      requestedStart,
      requestedEnd,
      rules,
      bookings,
      closures: closures.map((closure) => ({
        startDate: closure.startDate.toISOString().slice(0, 10),
        endDate: closure.endDate.toISOString().slice(0, 10),
        name: closure.name,
      })),
    }),
  };
}

const patternSchema = z.object({
  enrollmentId: uuid,
  teacherId: uuid,
  roomId: uuid.or(z.literal("")).transform((value) => value || null),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  startsOn: z.string().transform((value) => new Date(value)),
  endsOn: z.string().transform((value) => new Date(value)),
});

export async function createRecurringSchedule(formData: FormData) {
  const actor = await admin();
  const input = patternSchema.parse(Object.fromEntries(formData));
  try {
    const result = await createPatternAndGenerate(prisma, input);
    await prisma.auditLog.create({
      data: {
        action: "schedule_pattern_create",
        entity: "SchedulePattern",
        entityId: result.pattern.id,
        actorId: actor.session.userId,
        createdById: actor.createdById,
        metadata: {
          enrollmentId: input.enrollmentId,
          createdCount: result.createdCount,
          closureCount: result.preview.closureDatesSkipped.length,
        },
      },
    });
    revalidatePath("/schedule");
    revalidatePath("/enrollments");
  } catch (error) {
    await prisma.auditLog.create({
      data: {
        action: "schedule_generation_blocked",
        entity: "SchedulePattern",
        entityId: null,
        actorId: actor.session.userId,
        createdById: actor.createdById,
        metadata: {
          enrollmentId: input.enrollmentId,
          reason: error instanceof Error ? error.message : "Validation failed",
        },
      },
    });
    throw error;
  }
}

export async function regenerateRecurringSchedule(formData: FormData) {
  const actor = await admin();
  const patternId = uuid.parse(formData.get("id"));
  const result = await generateMissingLessons(prisma, patternId);
  await prisma.auditLog.create({
    data: {
      action: "schedule_pattern_regenerate",
      entity: "SchedulePattern",
      entityId: patternId,
      actorId: actor.session.userId,
      createdById: actor.createdById,
      metadata: {
        createdCount: result.createdCount,
        existingCount: result.preview.existingDatesSkipped.length,
      },
    },
  });
  revalidatePath("/schedule");
}

export async function setPatternArchived(formData: FormData) {
  const actor = await admin();
  const patternId = uuid.parse(formData.get("id"));
  const restore = formData.get("restore") === "true";
  await prisma.schedulePattern.update({
    where: { id: patternId },
    data: {
      status: restore ? "ACTIVE" : "ARCHIVED",
      archivedAt: restore ? null : new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      action: restore ? "schedule_pattern_restore" : "schedule_pattern_archive",
      entity: "SchedulePattern",
      entityId: patternId,
      actorId: actor.session.userId,
      createdById: actor.createdById,
    },
  });
  revalidatePath("/schedule");
}

const closureSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1),
    startDate: z.string().min(1).transform((value) => new Date(value)),
    endDate: z.string().min(1).transform((value) => new Date(value)),
    notes: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || null),
    confirmOverlap: z.string().optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot precede start date.",
    path: ["endDate"],
  });

export async function saveSchoolClosure(formData: FormData) {
  const actor = await admin();
  const data = closureSchema.parse(Object.fromEntries(formData));
  const overlap = await prisma.schoolClosure.findFirst({
    where: {
      archivedAt: null,
      startDate: { lte: data.endDate },
      endDate: { gte: data.startDate },
      ...(data.id ? { NOT: { id: data.id } } : {}),
    },
  });
  if (overlap && data.confirmOverlap !== "yes") {
    redirect(
      `/admin/school-closures?error=${encodeURIComponent(
        `Dates overlap ${overlap.name}. Select confirm overlap to continue.`,
      )}`,
    );
  }
  const { id, confirmOverlap: _, ...values } = data;
  const row = id
    ? await prisma.schoolClosure.update({ where: { id }, data: values })
    : await prisma.schoolClosure.create({ data: values });
  await prisma.auditLog.create({
    data: {
      action: id ? "school_closure_update" : "school_closure_create",
      entity: "SchoolClosure",
      entityId: row.id,
      actorId: actor.session.userId,
      createdById: actor.createdById,
      metadata: {
        name: row.name,
        startDate: row.startDate,
        endDate: row.endDate,
        overlapConfirmed: Boolean(overlap),
      },
    },
  });
  revalidatePath("/admin/school-closures");
}

export async function setSchoolClosureArchived(formData: FormData) {
  const actor = await admin();
  const closureId = uuid.parse(formData.get("id"));
  const restore = formData.get("restore") === "true";
  await prisma.schoolClosure.update({
    where: { id: closureId },
    data: { archivedAt: restore ? null : new Date() },
  });
  await prisma.auditLog.create({
    data: {
      action: restore ? "school_closure_restore" : "school_closure_archive",
      entity: "SchoolClosure",
      entityId: closureId,
      actorId: actor.session.userId,
      createdById: actor.createdById,
    },
  });
  revalidatePath("/admin/school-closures");
}
