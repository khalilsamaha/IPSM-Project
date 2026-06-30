import type { Prisma, PrismaClient } from "@prisma/client";
import { applyPaymentBalance, reversePaymentBalance, validatePaymentAllocations } from "@/lib/payments/payment-allocation";
import { generateReceiptNumber, receiptPdfPath } from "@/lib/payments/receipt-service";

type PaymentStore = PrismaClient | Prisma.TransactionClient;

export type RequestedPaymentAllocation = { enrollmentId: string; amountCents: number };
export type CreatePaymentInput = { familyId: string; paymentDate: Date; paymentMethod: string; notes: string | null; createdById?: string | null; actorId?: string; allocations: RequestedPaymentAllocation[] };
export type VoidPaymentInput = { paymentId: string; createdById?: string | null; actorId?: string };

export async function createPaymentWithAllocations(prisma: PrismaClient, input: CreatePaymentInput) {
  return prisma.$transaction(async (tx) => {
    const requested = input.allocations.filter((item) => item.enrollmentId && item.amountCents > 0);
    const enrollments = await tx.enrollment.findMany({
      where: { id: { in: requested.map((item) => item.enrollmentId) }, student: { familyId: input.familyId } },
      select: { id: true, paidCents: true, remainingCents: true },
    });
    if (enrollments.length !== requested.length) throw new Error("All allocations must belong to the selected family");

    const byId = new Map(enrollments.map((row) => [row.id, row]));
    const totalAmountCents = validatePaymentAllocations(requested.map((item) => ({ ...item, remainingCents: byId.get(item.enrollmentId)?.remainingCents ?? 0 })));
    const receiptNumber = await generateReceiptNumber(tx as PaymentStore);

    const payment = await tx.payment.create({
      data: {
        familyId: input.familyId,
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        totalAmountCents,
        createdById: input.createdById,
        receiptNumber,
        items: { create: requested.map((item) => ({ enrollmentId: item.enrollmentId, amountCents: item.amountCents })) },
      },
    });

    await tx.receipt.create({ data: { paymentId: payment.id, receiptNumber, pdfPath: receiptPdfPath(payment.id) } });

    for (const item of requested) {
      const enrollment = byId.get(item.enrollmentId)!;
      await tx.enrollment.update({ where: { id: item.enrollmentId }, data: applyPaymentBalance(enrollment, item.amountCents) });
    }

    await tx.auditLog.create({ data: { action: "create", entity: "Payment", entityId: payment.id, createdById: input.createdById, actorId: input.actorId, metadata: { totalAmountCents, receiptNumber, allocations: requested } } });
    return payment;
  });
}

export async function voidPaymentWithReversal(prisma: PrismaClient, input: VoidPaymentInput) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { items: { include: { enrollment: true } } } });
    if (!payment) throw new Error("Payment not found");
    if (payment.voidedAt) return;

    for (const item of payment.items) {
      await tx.enrollment.update({ where: { id: item.enrollmentId }, data: reversePaymentBalance(item.enrollment, item.amountCents) });
    }

    await tx.payment.update({ where: { id: input.paymentId }, data: { voidedAt: new Date() } });
    await tx.auditLog.create({ data: { action: "void", entity: "Payment", entityId: input.paymentId, createdById: input.createdById, actorId: input.actorId, metadata: { reversedCents: payment.totalAmountCents, itemCount: payment.items.length } } });
  });
}
