"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { isAdminOrHigher } from "@/lib/auth/roles";
import { attendanceBlockReason, attendanceTarget, type AttendanceAction } from "@/lib/attendance/policy";

const actionSchema = z.enum(["complete", "missed", "cancel", "revert"]);

export async function bulkAttendance(formData: FormData) {
  const session = await requireSession();
  if (!isAdminOrHigher(session.role)) throw new Error("Only administrators can finalize attendance.");
  const actor = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } });
  const action = actionSchema.parse(formData.get("attendanceAction")) as AttendanceAction;
  const ids = [...new Set(formData.getAll("sessionIds").map(String))].filter((value) => z.string().uuid().safeParse(value).success);
  const reason = String(formData.get("reason") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!ids.length) throw new Error("Select at least one lesson.");
  if (["cancel", "missed", "revert"].includes(action) && !reason) throw new Error("A reason is required for exceptions and corrections.");

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.scheduleSession.findMany({
      where: { id: { in: ids }, archivedAt: null },
      include: { payrollItems: { include: { payroll: { select: { status: true } } } } },
    });
    let updated = 0; let skipped = ids.length - rows.length; let blocked = 0;
    const previousStatuses: Record<string, string> = {}; const blockedReasons: Record<string, string> = {};
    for (const row of rows) {
      const payrollStatus = row.payrollItems[0]?.payroll.status ?? null;
      const block = attendanceBlockReason(row.status, payrollStatus, action);
      if (block) { blocked++; blockedReasons[row.id] = block; continue; }
      previousStatuses[row.id] = row.status;
      const auditNote = [row.notes, reason && `${action} reason: ${reason}`, notes && `Internal: ${notes}`].filter(Boolean).join("\n") || null;
      await tx.scheduleSession.update({ where: { id: row.id }, data: { status: attendanceTarget(action), notes: auditNote, attendanceFinalizedAt: new Date(), attendanceFinalizedBy: actor?.id, attendanceSource: "MANUAL", attendanceReason: reason || null } });
      updated++;
    }
    const metadata = { actorId: session.userId, sessionIds: ids, previousStatuses, newStatus: attendanceTarget(action), blocked, skipped, reason: reason || undefined, blockedReasons };
    await tx.auditLog.create({ data: { action: `attendance_bulk_${action === "complete" ? "completed" : action === "cancel" ? "cancelled" : action === "revert" ? "reverted" : "missed"}`, entity: "ScheduleSession", actorId: session.userId, createdById: actor?.id, metadata } });
    if (blocked) await tx.auditLog.create({ data: { action: "attendance_change_blocked", entity: "ScheduleSession", actorId: session.userId, createdById: actor?.id, metadata: { sessionIds: Object.keys(blockedReasons), blockedReasons, action } } });
    return { updated, skipped, blocked };
  });
  revalidatePath("/attendance"); revalidatePath("/schedule");
  const returnTo = String(formData.get("returnTo") ?? "/attendance");
  const url = new URL(returnTo.startsWith("/") ? returnTo : "/attendance", "http://local");
  url.searchParams.set("result", `${result.updated} updated, ${result.skipped} skipped, ${result.blocked} blocked`);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
