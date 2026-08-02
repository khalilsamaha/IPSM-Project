"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { validateTeacherConfiguration } from "@/lib/teachers/onboarding";
import { persistTeacherConfiguration } from "@/lib/teachers/create-configuration";
import { logServerError } from "@/lib/server-log";

export type TeacherConfigurationActionState = {
  status: "idle" | "error";
  message: string;
};

function safeTeacherConfigurationError(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Review the teacher configuration and try again.";
  }
  if (error instanceof Error) {
    const safeMessages = [
      "Season is unavailable.",
      "Only active courses may be assigned.",
      "Only active levels may be assigned.",
      "Effective dates must be inside the season.",
      "Effective from must not be after effective to.",
      "Effective dates must match the selected weekday.",
    ];
    if (safeMessages.includes(error.message)) return error.message;
  }
  return "Unable to create the teacher configuration. Review the assignments and availability, then try again.";
}

export async function createTeacherConfiguration(
  _previousState: TeacherConfigurationActionState,
  formData: FormData,
): Promise<TeacherConfigurationActionState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) {
    return { status: "error", message: "You are not authorized to create teachers." };
  }

  const profile = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });

  let teacherId: string;
  try {
    const raw = JSON.parse(String(formData.get("configuration") ?? "{}"));
    const data = await validateTeacherConfiguration(raw, (id) =>
      prisma.season.findUnique({
        where: { id },
        select: { startDate: true, endDate: true },
      }),
    );

    const uniqueCourseIds = [...new Set(data.assignments.map((assignment) => assignment.courseId))];
    const activeCourseIds = new Set((await prisma.course.findMany({
      where: { id: { in: uniqueCourseIds }, status: "ACTIVE" },
      select: { id: true },
    })).map((course) => course.id));
    if (activeCourseIds.size !== uniqueCourseIds.length) {
      throw new Error("Only active courses may be assigned.");
    }

    const uniqueLevelIds = [...new Set(data.assignments.flatMap((assignment) =>
      assignment.levelId ? [assignment.levelId] : [],
    ))];
    const activeLevelCount = await prisma.courseLevel.count({
      where: { id: { in: uniqueLevelIds }, status: "ACTIVE" },
    });
    if (activeLevelCount !== uniqueLevelIds.length) {
      throw new Error("Only active levels may be assigned.");
    }

    const teacher = await prisma.$transaction((tx) =>
      persistTeacherConfiguration(tx, data, {
        actorId: session.userId,
        createdById: profile?.id ?? null,
      }),
    );
    teacherId = teacher.id;
  } catch (error) {
    logServerError("teacher.configuration.create", error, {
      actorId: session.userId,
    });
    return {
      status: "error",
      message: safeTeacherConfigurationError(error),
    };
  }

  redirect(
    `/teachers/${teacherId}/edit?success=${encodeURIComponent("Teacher configuration created.")}`,
  );
}
