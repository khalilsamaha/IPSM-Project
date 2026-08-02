"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { currentBusinessDate } from "@/lib/shifts/service";
import { parseIsoDateOnly } from "@/lib/date-time";

const uuid = z.string().uuid();

async function actor() {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) {
    throw new Error("Not authorized");
  }
  const profile = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  return { session, createdById: profile?.id ?? null };
}

export async function archiveEnrollment(formData: FormData) {
  const { session, createdById } = await actor();
  const enrollmentId = uuid.parse(formData.get("id"));
  const now = new Date();
  const today = parseIsoDateOnly(currentBusinessDate(now));

  await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, archivedAt: true },
    });
    if (!enrollment) throw new Error("Enrollment not found.");
    if (enrollment.archivedAt) return;

    const [patterns, sessions] = await Promise.all([
      tx.schedulePattern.updateMany({
        where: {
          enrollmentId,
          status: "ACTIVE",
          archivedAt: null,
        },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
        },
      }),
      tx.scheduleSession.updateMany({
        where: {
          enrollmentId,
          status: "SCHEDULED",
          archivedAt: null,
          sessionDate: { gte: today },
        },
        data: {
          status: "CANCELLED",
          archivedAt: now,
          attendanceFinalizedAt: now,
          attendanceFinalizedBy: session.userId,
          attendanceSource: "MANUAL",
          attendanceReason: "Enrollment ended",
        },
      }),
    ]);

    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "ENDED", archivedAt: now },
    });

    await tx.auditLog.create({
      data: {
        action: "archive",
        entity: "Enrollment",
        entityId: enrollmentId,
        actorId: session.userId,
        createdById,
        metadata: {
          futureSessionsCancelled: sessions.count,
          recurringPatternsArchived: patterns.count,
          effectiveBusinessDate: currentBusinessDate(now),
        },
      },
    });
  });

  revalidatePath("/enrollments");
  revalidatePath("/schedule");
  revalidatePath("/teacher-availability");
}

export async function restoreEnrollment(formData: FormData) {
  const { session, createdById } = await actor();
  const enrollmentId = uuid.parse(formData.get("id"));

  await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true },
    });
    if (!enrollment) throw new Error("Enrollment not found.");

    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "ACTIVE", archivedAt: null },
    });
    await tx.auditLog.create({
      data: {
        action: "restore",
        entity: "Enrollment",
        entityId: enrollmentId,
        actorId: session.userId,
        createdById,
        metadata: {
          scheduleRestoredAutomatically: false,
          note: "Cancelled lessons and archived recurring patterns require explicit rebooking.",
        },
      },
    });
  });

  revalidatePath("/enrollments");
  revalidatePath("/schedule");
  revalidatePath("/teacher-availability");
}
