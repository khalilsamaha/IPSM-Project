import type { Prisma, PrismaClient } from "@prisma/client";
import { applyPaymentBalance, reversePaymentBalance, validatePaymentAllocations } from "@/lib/payments/payment-allocation";
import { ensurePaymentReceipt, isUniqueReceiptConflict } from "@/lib/payments/receipt-repair";

export type RequestedPaymentAllocation = { enrollmentId: string; amountCents: number };
export type CreatePaymentInput = { familyId: string; paymentDate: Date; paymentMethod: string; notes: string | null; createdById?: string | null; actorId?: string; shiftId: string; allocations: RequestedPaymentAllocation[] };
export type VoidPaymentInput = { paymentId: string; createdById?: string | null; actorId?: string };

export async function createPaymentWithAllocations(prisma: PrismaClient, input: CreatePaymentInput) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await prisma.$transaction((tx) => createPaymentWithAllocationsInTransaction(tx, input));
    } catch (error) {
      if (!isUniqueReceiptConflict(error) || attempt === 5) throw error;
    }
  }
  throw new Error("Unable to create payment with a unique receipt number.");
}

export async function createPaymentWithAllocationsInTransaction(tx: Prisma.TransactionClient, input: CreatePaymentInput) {
        const requested = input.allocations.filter((item) => item.enrollmentId && item.amountCents > 0);
        if (!requested.length) throw new Error("Enter an amount for at least one enrollment.");
        const enrollments = await tx.enrollment.findMany({
          where: { id: { in: requested.map((item) => item.enrollmentId) }, student: { familyId: input.familyId } },
          select: { id: true, paidCents: true, remainingCents: true },
        });
        if (enrollments.length !== requested.length) throw new Error("All allocations must belong to the selected family.");

        const byId = new Map(enrollments.map((row) => [row.id, row]));
        const totalAmountCents = validatePaymentAllocations(requested.map((item) => ({ ...item, remainingCents: byId.get(item.enrollmentId)?.remainingCents ?? 0 })));

        const payment = await tx.payment.create({
          data: {
            familyId: input.familyId,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            notes: input.notes,
            totalAmountCents,
            createdById: input.createdById,
            shiftId: input.shiftId,
            items: { create: requested.map((item) => ({ enrollmentId: item.enrollmentId, amountCents: item.amountCents })) },
          },
        });

        const receiptNumber = await ensurePaymentReceipt(tx, payment.id);
        for (const item of requested) await tx.enrollment.update({ where: { id: item.enrollmentId }, data: applyPaymentBalance(byId.get(item.enrollmentId)!, item.amountCents) });
        await tx.auditLog.create({ data: { action: "create", entity: "Payment", entityId: payment.id, createdById: input.createdById, actorId: input.actorId, metadata: { totalAmountCents, receiptNumber, familyId: input.familyId, allocations: requested } } });
        return { ...payment, receiptNumber };
}

export async function voidPaymentWithReversal(prisma: PrismaClient, input: VoidPaymentInput) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { shift: true, items: { include: { enrollment: true } } } });
    if (!payment) throw new Error("Payment not found");
    if (payment.shift?.status === "CLOSED") throw new Error("This transaction belongs to a closed shift and can no longer be modified.");
    if (payment.voidedAt) return;
    for (const item of payment.items) await tx.enrollment.update({ where: { id: item.enrollmentId }, data: reversePaymentBalance(item.enrollment, item.amountCents) });
    await tx.payment.update({ where: { id: input.paymentId }, data: { voidedAt: new Date() } });
    await tx.auditLog.create({ data: { action: "void", entity: "Payment", entityId: input.paymentId, createdById: input.createdById, actorId: input.actorId, metadata: { reversedCents: payment.totalAmountCents, itemCount: payment.items.length } } });
  });
}
