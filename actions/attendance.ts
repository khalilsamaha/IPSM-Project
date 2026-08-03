"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { attendanceBlockReason, attendanceTarget, type AttendanceAction } from "@/lib/attendance/policy";

const actionSchema = z.enum(["complete", "missed", "cancel", "revert"]);

function attendanceReturnUrl(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "/attendance");
  const safeReturnTo = returnTo.startsWith("/attendance") ? returnTo : "/attendance";
  return new URL(safeReturnTo, "http://local");
}

function attendanceErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) return "Choose a valid attendance action.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The attendance change could not be completed. Please try again.";
}

async function executeBulkAttendance(formData: FormData) {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Only administrators can finalize or correct attendance.");

  const actor = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  const action = actionSchema.parse(formData.get("attendanceAction")) as AttendanceAction;
  const ids = [...new Set(formData.getAll("sessionIds").map(String))]
    .filter((value) => z.string().uuid().safeParse(value).success);
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!ids.length) throw new Error("Select at least one lesson.");
  if (["cancel", "missed", "revert"].includes(action) && !reason) {
    throw new Error("A reason is required for exceptions and corrections.");
  }

  return prisma.$transaction(async (tx) => {
    const rows = await tx.scheduleSession.findMany({
      where: { id: { in: ids }, archivedAt: null },
      include: { payrollItems: { include: { payroll: { select: { status: true } } } } },
    });

    const cancelledCorrections = action === "complete"
      ? rows.filter((row) => row.status === "CANCELLED")
      : [];
    if (cancelledCorrections.length && !reason) {
      throw new Error("A reason is required to correct a cancelled lesson to completed.");
    }

    let updated = 0;
    let skipped = ids.length - rows.length;
    let blocked = 0;
    const previousStatuses: Record<string, string> = {};
    const blockedReasons: Record<string, string> = {};

    for (const row of rows) {
      const payrollStatus = row.payrollItems[0]?.payroll.status ?? null;
      const block = attendanceBlockReason(row.status, payrollStatus, action);
      if (block) {
        blocked += 1;
        blockedReasons[row.id] = block;
        continue;
      }

      previousStatuses[row.id] = row.status;
      const auditNote = [
        row.notes,
        reason && `${action} reason: ${reason}`,
        notes && `Internal: ${notes}`,
      ].filter(Boolean).join("\n") || null;

      await tx.scheduleSession.update({
        where: { id: row.id },
        data: {
          status: attendanceTarget(action),
          notes: auditNote,
          attendanceFinalizedAt: new Date(),
          attendanceFinalizedBy: actor?.id,
          attendanceSource: "MANUAL",
          attendanceReason: reason || null,
        },
      });
      updated += 1;
    }

    const metadata = {
      actorId: session.userId,
      sessionIds: ids,
      previousStatuses,
      newStatus: attendanceTarget(action),
      cancelledToCompleted: cancelledCorrections.map((row) => row.id),
      blocked,
      skipped,
      reason: reason || undefined,
      blockedReasons,
    };

    await tx.auditLog.create({
      data: {
        action: `attendance_bulk_${action === "complete" ? "completed" : action === "cancel" ? "cancelled" : action === "revert" ? "reverted" : "missed"}`,
        entity: "ScheduleSession",
        actorId: session.userId,
        createdById: actor?.id,
        metadata,
      },
    });

    if (blocked) {
      await tx.auditLog.create({
        data: {
          action: "attendance_change_blocked",
          entity: "ScheduleSession",
          actorId: session.userId,
          createdById: actor?.id,
          metadata: {
            sessionIds: Object.keys(blockedReasons),
            blockedReasons,
            action,
          },
        },
      });
    }

    return { updated, skipped, blocked };
  });
}

export async function bulkAttendance(formData: FormData) {
  const url = attendanceReturnUrl(formData);
  let result: Awaited<ReturnType<typeof executeBulkAttendance>>;

  try {
    result = await executeBulkAttendance(formData);
  } catch (error) {
    url.searchParams.delete("result");
    url.searchParams.set("error", attendanceErrorMessage(error));
    redirect(`${url.pathname}?${url.searchParams.toString()}`);
  }

  revalidatePath("/attendance");
  revalidatePath("/schedule");
  url.searchParams.delete("error");
  url.searchParams.set(
    "result",
    `${result.updated} updated, ${result.skipped} skipped, ${result.blocked} blocked`,
  );
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
