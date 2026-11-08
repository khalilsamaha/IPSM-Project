"use server";

import { compareBusinessIdentifiers } from "@/lib/business-identifiers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { hasPermission, isAdminOrHigher } from "@/lib/auth/roles";
import { dollarsToCents } from "@/lib/records/format";
import {
  calculateShiftTotalsFromDb,
  closeStaleShifts,
  currentBusinessDate,
  getCurrentOpenShift,
} from "@/lib/shifts/service";
import { logServerError } from "@/lib/server-log";

const id = z.string().uuid();

async function actor() {
  const session = await requireSession();
  const user = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  if (!user) throw new Error("User profile not found.");
  return { session, userId: user.id };
}

function shiftsPath(message: string) {
  return `/shifts?error=${encodeURIComponent(message)}`;
}

function shiftPath(shiftId: string, message: string, type: "error" | "success" = "error") {
  return `/shifts/${shiftId}?${type}=${encodeURIComponent(message)}`;
}

function safeShiftError(error: unknown) {
  if (!(error instanceof Error)) return "The shift operation failed. Please try again.";
  const safeMessages = [
    "Shift not found.",
    "Not authorized.",
    "Declared cash must be a valid non-negative amount.",
    "Shift is already closed.",
    "Explain the cash difference before closing the shift.",
    "Shift status changed while it was being closed. Refresh the page and try again.",
    "Admin reopen requires a reason.",
  ];
  return safeMessages.includes(error.message)
    ? error.message
    : "The shift could not be closed. No partial closing was saved. Please try again.";
}

export async function openShift(formData: FormData) {
  const { session, userId } = await actor();
  if (!hasPermission(session.role, "records:write")) {
    redirect(shiftsPath("You are not authorized to open shifts."));
  }

  const businessDateText = String(
    formData.get("businessDate") ?? currentBusinessDate(),
  );
  const businessDate = new Date(`${businessDateText}T00:00:00.000Z`);
  const openingCashCents = dollarsToCents(String(formData.get("openingCash") ?? "0"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!Number.isFinite(openingCashCents) || openingCashCents < 0) {
    redirect(shiftsPath("Opening cash must be a valid non-negative amount."));
  }

  // Cron remains the primary midnight mechanism. This user-scoped fallback ensures
  // a missed cron can never block the next business day's shift.
  await closeStaleShifts(prisma, new Date(), userId);
  if (await getCurrentOpenShift(prisma, userId)) {
    redirect(shiftsPath("You already have an open shift for the current business day."));
  }

  const row = await prisma.cashierShift.create({
    data: {
      userId,
      businessDate,
      openingCashCents,
      expectedCashCents: openingCashCents,
      notes,
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "open",
      entity: "CashierShift",
      entityId: row.id,
      actorId: session.userId,
      createdById: userId,
      metadata: { businessDate: businessDateText, openingCashCents },
    },
  });
  revalidatePath("/shifts");
  redirect(`/shifts/${row.id}`);
}

export async function closeShift(formData: FormData) {
  const parsedShiftId = id.safeParse(String(formData.get("id") ?? ""));
  if (!parsedShiftId.success) {
    redirect(shiftsPath("The shift reference is missing. Refresh the page and try again."));
  }
  const shiftId = parsedShiftId.data;
  const { session, userId } = await actor();
  if (!hasPermission(session.role, "records:write")) {
    redirect(shiftPath(shiftId, "You are not authorized to close shifts."));
  }

  const rawDeclaredCash = String(formData.get("declaredCash") ?? "").trim();
  const declaredCashCents = dollarsToCents(rawDeclaredCash);
  const closeNote = String(formData.get("closeNote") ?? "").trim();
  const varianceReason = String(formData.get("varianceReason") ?? "").trim();

  try {
    if (!rawDeclaredCash || !Number.isFinite(declaredCashCents) || declaredCashCents < 0) {
      throw new Error("Declared cash must be a valid non-negative amount.");
    }

    const { shift, totals } = await calculateShiftTotalsFromDb(prisma, shiftId);
    if (shift.userId !== userId && !isAdminOrHigher(session.role)) {
      throw new Error("Not authorized.");
    }
    if (shift.status === "CLOSED") throw new Error("Shift is already closed.");

    const differenceCents = declaredCashCents - totals.expectedCashCents;
    if (differenceCents !== 0 && !varianceReason) {
      throw new Error("Explain the cash difference before closing the shift.");
    }

    const notes = [
      shift.notes,
      closeNote ? `Close note: ${closeNote}` : null,
    ].filter(Boolean).join("\n") || null;
    const receiptNumbers = await prisma.payment.findMany({
      where: { shiftId, receiptNumber: { not: null }, voidedAt: null },
      select: { receiptNumber: true },
      orderBy: { receiptNumber: "asc" },
    });
    receiptNumbers.sort((a,b) => compareBusinessIdentifiers(a.receiptNumber,b.receiptNumber));
    const closedAt = new Date();
    const finalSnapshot = {
      version: 2,
      closingMode: shift.status === "AUTO_CLOSED" ? "manual_reconciliation" : "manual",
      openingCashCents: shift.openingCashCents,
      ...totals,
      declaredCashCents,
      differenceCents,
      receiptCount: receiptNumbers.length,
      firstReceiptNumber: receiptNumbers[0]?.receiptNumber ?? null,
      lastReceiptNumber: receiptNumbers.at(-1)?.receiptNumber ?? null,
      closedAt: closedAt.toISOString(),
      closedById: userId,
    };

    await prisma.$transaction(async (tx) => {
      const prior = shift.closingSnapshot && typeof shift.closingSnapshot === "object"
        ? shift.closingSnapshot as Record<string, unknown>
        : {};
      const closingSnapshot = shift.status === "AUTO_CLOSED"
        ? { ...prior, reconciliation: finalSnapshot }
        : finalSnapshot;
      const updated = await tx.cashierShift.updateMany({
        where: { id: shiftId, status: shift.status },
        data: {
          status: "CLOSED",
          closedAt,
          closedById: userId,
          expectedCashCents: totals.expectedCashCents,
          declaredCashCents,
          differenceCents,
          varianceReason: varianceReason || null,
          closingSnapshot,
          notes,
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          "Shift status changed while it was being closed. Refresh the page and try again.",
        );
      }
      await tx.auditLog.create({
        data: {
          action: shift.status === "AUTO_CLOSED" ? "reconcile_auto_close" : "close",
          entity: "CashierShift",
          entityId: shiftId,
          actorId: session.userId,
          createdById: userId,
          metadata: finalSnapshot,
        },
      });
    });
  } catch (error) {
    logServerError("shift.close", error, {
      shiftId,
      actorId: session.userId,
    });
    redirect(shiftPath(shiftId, safeShiftError(error)));
  }

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  redirect(shiftPath(shiftId, "Shift closed successfully.", "success"));
}

export async function reopenShift(formData: FormData) {
  const { session, userId } = await actor();
  if (!isAdminOrHigher(session.role)) throw new Error("Not authorized.");
  const shiftId = id.parse(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    redirect(shiftPath(shiftId, "Admin reopen requires a reason."));
  }
  const row = await prisma.cashierShift.update({
    where: { id: shiftId },
    data: {
      status: "REOPENED",
      closedAt: null,
      reopenedById: userId,
      reopenReason: reason,
    },
  });
  await prisma.auditLog.create({
    data: {
      action: "reopen",
      entity: "CashierShift",
      entityId: row.id,
      actorId: session.userId,
      createdById: userId,
      metadata: { reason },
    },
  });
  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  redirect(shiftPath(shiftId, "Shift reopened successfully.", "success"));
}
