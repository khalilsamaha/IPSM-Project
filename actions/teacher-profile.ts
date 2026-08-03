"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { logServerError } from "@/lib/server-log";

const optionalEmail = z.string().trim().email().or(z.literal("")).transform((value) => value || null);
const optionalText = z.string().trim().optional().transform((value) => value || null);

const teacherProfileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(1, "Teacher name is required."),
  email: optionalEmail,
  phone: optionalText,
  compensationBasis: z.enum(["HOURLY", "SESSION_UNIT"]),
  hourlyRate: z.string().default("0"),
  sessionRate: z.string().default("0"),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  notes: optionalText,
});

function teacherPath(id: string, kind: "success" | "error", message: string) {
  return `/teachers/${id}/edit?${kind}=${encodeURIComponent(message)}`;
}

export async function saveTeacherProfile(formData: FormData) {
  const session = await requireSession();
  const rawId = String(formData.get("id") ?? "");
  if (!hasPermission(session.role, "records:write")) {
    redirect(teacherPath(rawId, "error", "You are not authorized to update teacher profiles."));
  }

  let savedId = rawId;
  try {
    const parsed = teacherProfileSchema.parse(Object.fromEntries(formData));
    savedId = parsed.id;
    const user = await prisma.userProfile.findUnique({
      where: { authId: session.userId },
      select: { id: true },
    });
    const hourlyRateCents = dollarsToCents(parsed.hourlyRate);
    const sessionRateCents = dollarsToCents(parsed.sessionRate);

    await prisma.$transaction(async (tx) => {
      await tx.teacher.update({
        where: { id: parsed.id },
        data: {
          fullName: parsed.fullName,
          email: parsed.email,
          phone: parsed.phone,
          compensationBasis: parsed.compensationBasis,
          hourlyRateCents,
          sessionRateCents: parsed.compensationBasis === "SESSION_UNIT" ? sessionRateCents : null,
          sessionUnitMinutes: 30,
          status: parsed.status,
          notes: parsed.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "update",
          entity: "Teacher",
          entityId: parsed.id,
          actorId: session.userId,
          createdById: user?.id ?? null,
          metadata: {
            fullName: parsed.fullName,
            compensationBasis: parsed.compensationBasis,
            rateCents: parsed.compensationBasis === "SESSION_UNIT" ? sessionRateCents : hourlyRateCents,
            rateUnitMinutes: parsed.compensationBasis === "SESSION_UNIT" ? 30 : 60,
            status: parsed.status,
          },
        },
      });
    });
  } catch (error) {
    logServerError("teacher.profile.save", error, { teacherId: rawId });
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message ?? "Check the teacher information and try again."
      : error instanceof Error
        ? error.message
        : "Unable to save the teacher profile.";
    redirect(teacherPath(rawId, "error", message));
  }

  revalidatePath(`/teachers/${savedId}/edit`);
  revalidatePath("/teachers");
  redirect(teacherPath(savedId, "success", "Teacher profile saved successfully."));
}
