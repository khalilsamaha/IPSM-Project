import type { Prisma } from "@prisma/client";
import type { TeacherConfiguration } from "@/lib/teachers/onboarding";

type TeacherConfigurationStore = Pick<
  Prisma.TransactionClient,
  "teacher" | "teacherCourse" | "teacherAvailability" | "auditLog"
>;

export async function persistTeacherConfiguration(
  tx: TeacherConfigurationStore,
  data: TeacherConfiguration,
  actor: { actorId: string; createdById?: string | null },
) {
  const teacher = await tx.teacher.create({
    data: {
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      status: data.status,
      compensationBasis: data.compensationBasis,
      hourlyRateCents: data.compensationBasis === "HOURLY" ? data.rateCents : 0,
      sessionRateCents: data.compensationBasis === "SESSION_UNIT" ? data.rateCents : null,
      sessionUnitMinutes: data.sessionUnitMinutes,
    },
  });

  // The database availability guard requires assignments to exist first.
  // Keep these as explicit writes rather than one unordered nested create.
  if (data.assignments.length) {
    await tx.teacherCourse.createMany({
      data: data.assignments.map((assignment) => ({
        teacherId: teacher.id,
        courseId: assignment.courseId,
        levelId: assignment.levelId,
        status: "ACTIVE" as const,
      })),
    });
  }

  if (data.availability.length) {
    await tx.teacherAvailability.createMany({
      data: data.availability.map((rule) => ({
        teacherId: teacher.id,
        courseId: rule.courseId,
        seasonId: rule.seasonId,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        effectiveFrom: rule.effectiveFrom,
        effectiveTo: rule.effectiveTo,
        notes: rule.notes,
        status: "ACTIVE" as const,
      })),
    });
  }

  await tx.auditLog.create({
    data: {
      action: "teacher_configuration_create",
      entity: "Teacher",
      entityId: teacher.id,
      actorId: actor.actorId,
      createdById: actor.createdById ?? null,
      metadata: {
        assignmentCount: data.assignments.length,
        availabilityCount: data.availability.length,
        compensationBasis: data.compensationBasis,
      },
    },
  });

  return teacher;
}
