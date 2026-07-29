"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission, isAdminOrHigher } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import { calculateShiftTotalsFromDb, getCurrentOpenShift } from "@/lib/shifts/service";

const id = z.string().uuid();
async function actor() { const session = await requireSession(); const user = await prisma.userProfile.findUnique({ where: { authId: session.userId }, select: { id: true } }); if (!user) throw new Error("User profile not found."); return { session, userId: user.id }; }
function shiftPath(message: string) { return `/shifts?error=${encodeURIComponent(message)}`; }

export async function openShift(formData: FormData) {
  const { session, userId } = await actor();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const businessDate = new Date(String(formData.get("businessDate") ?? new Date().toISOString().slice(0, 10)));
  const openingCashCents = dollarsToCents(String(formData.get("openingCash") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (openingCashCents < 0) redirect(shiftPath("Opening cash cannot be negative."));
  if (await getCurrentOpenShift(prisma, userId)) redirect(shiftPath("You already have an open shift."));
  const row = await prisma.cashierShift.create({ data: { userId, businessDate, openingCashCents, expectedCashCents: openingCashCents, notes } });
  await prisma.auditLog.create({ data: { action: "open", entity: "CashierShift", entityId: row.id, actorId: session.userId, createdById: userId, metadata: { businessDate, openingCashCents } } });
  revalidatePath("/shifts");
  redirect(`/shifts/${row.id}`);
}

export async function closeShift(formData: FormData) {
  const { session, userId } = await actor();
  if (!hasPermission(session.role, "records:write")) throw new Error("Not authorized");
  const shiftId = id.parse(formData.get("id"));
  const declaredCashCents = dollarsToCents(String(formData.get("declaredCash") ?? "0"));
  const closeNote = String(formData.get("closeNote") ?? "").trim();
  const varianceReason = String(formData.get("varianceReason") ?? "").trim();
  const { shift, totals } = await calculateShiftTotalsFromDb(prisma, shiftId);
  if (shift.userId !== userId && !isAdminOrHigher(session.role)) throw new Error("Not authorized");
  if (shift.status === "CLOSED") redirect(`/shifts/${shiftId}?error=${encodeURIComponent("Shift is already closed.")}`);
  const differenceCents = declaredCashCents - totals.expectedCashCents;
  if (differenceCents !== 0 && !varianceReason) redirect(`/shifts/${shiftId}?error=${encodeURIComponent("Explain the cash difference before closing the shift.")}`);
  const notes = [shift.notes, closeNote ? `Close note: ${closeNote}` : null].filter(Boolean).join("\n") || null;
  const receiptNumbers = await prisma.payment.findMany({ where: { shiftId, receiptNumber: { not: null } }, select: { receiptNumber: true }, orderBy: { receiptNumber: "asc" } });
  const closedAt = new Date();
  const closingSnapshot = {
    version: 1, openingCashCents: shift.openingCashCents, ...totals, declaredCashCents, differenceCents,
    receiptCount: receiptNumbers.length, firstReceiptNumber: receiptNumbers[0]?.receiptNumber ?? null,
    lastReceiptNumber: receiptNumbers.at(-1)?.receiptNumber ?? null, closedAt: closedAt.toISOString(), closedById: userId,
  };
  await prisma.$transaction(async (tx) => {
    await tx.cashierShift.update({ where: { id: shiftId }, data: { status: "CLOSED", closedAt, closedById: userId, expectedCashCents: totals.expectedCashCents, declaredCashCents, differenceCents, varianceReason: varianceReason || null, closingSnapshot, notes } });
    await tx.auditLog.create({ data: { action: "close", entity: "CashierShift", entityId: shiftId, actorId: session.userId, createdById: userId, metadata: closingSnapshot } });
  });
  revalidatePath("/shifts"); revalidatePath(`/shifts/${shiftId}`);
  redirect(`/shifts/${shiftId}?success=closed`);
}

export async function reopenShift(formData: FormData) {
  const { session, userId } = await actor();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized");
  const shiftId = id.parse(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`/shifts/${shiftId}?error=${encodeURIComponent("Admin reopen requires a reason.")}`);
  const row = await prisma.cashierShift.update({ where: { id: shiftId }, data: { status: "REOPENED", closedAt: null, reopenedById: userId, reopenReason: reason } });
  await prisma.auditLog.create({ data: { action: "reopen", entity: "CashierShift", entityId: row.id, actorId: session.userId, createdById: userId, metadata: { reason } } });
  revalidatePath("/shifts"); revalidatePath(`/shifts/${shiftId}`);
  redirect(`/shifts/${shiftId}?success=reopened`);
}
