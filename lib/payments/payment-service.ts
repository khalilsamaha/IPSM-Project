import { createHash, randomUUID } from "node:crypto";
import { isRetryableTransactionError } from "@/lib/business-identifiers";
import type { Prisma, PrismaClient } from "@prisma/client";
import { allocateFamilyPaymentAutomatically, applyPaymentBalance, reversePaymentBalance, validateManualFamilyAllocations, validatePaymentAllocations } from "@/lib/payments/payment-allocation";
import { ensurePaymentReceipt, isUniqueReceiptConflict } from "@/lib/payments/receipt-repair";

export type RequestedPaymentAllocation = { enrollmentId: string; amountCents: number };
export type CreatePaymentInput = { requestId?: string; familyId: string; paymentDate: Date; paymentMethod: string; notes: string | null; createdById?: string | null; actorId?: string; shiftId: string; amountCents?: number; allocationMode?: "automatic" | "manual"; allocations: RequestedPaymentAllocation[] };
export type VoidPaymentInput = { paymentId: string; createdById?: string | null; actorId?: string };

export async function createPaymentWithAllocations(prisma: PrismaClient, input: CreatePaymentInput) {
  const request = { ...input, requestId: input.requestId ?? randomUUID() };
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await prisma.$transaction((tx) => createPaymentWithAllocationsInTransaction(tx, request), { isolationLevel: "Serializable" });
    } catch (error) {
      if ((!isUniqueReceiptConflict(error) && !isRetryableTransactionError(error)) || attempt === 5) throw error;
    }
  }
  throw new Error("Unable to create payment with a unique receipt number.");
}

export async function createPaymentWithAllocationsInTransaction(tx: Prisma.TransactionClient, input: CreatePaymentInput) {
        const requestId = input.requestId ?? randomUUID();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("Invalid payment request. Reload the form.");
        const requestHash = createHash("sha256").update(JSON.stringify({
          familyId: input.familyId, actorId: input.actorId, createdById: input.createdById,
          date: input.paymentDate.toISOString().slice(0,10), method: input.paymentMethod,
          notes: input.notes, shiftId: input.shiftId, amount: input.amountCents,
          mode: input.allocationMode, allocations: [...input.allocations].sort((a,b)=>a.enrollmentId.localeCompare(b.enrollmentId)),
        })).digest("hex");
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"ipsm-payment:" + requestId},0))::text`;
        const previous = await tx.payment.findUnique({where:{id:requestId}});
        if (previous) {
          const audit = await tx.auditLog.findFirst({where:{entity:"Payment",action:"create",entityId:requestId}});
          if ((audit?.metadata as {requestHash?:string}|null)?.requestHash !== requestHash) throw new Error("Payment request was already used with different details.");
          return previous;
        }
        const shift = await tx.cashierShift.findUnique({ where: { id: input.shiftId }, select: { status: true } });
        if (!shift || !["OPEN", "REOPENED"].includes(shift.status)) throw new Error("The cashier shift is no longer open. Review the payment and try again.");
        const familyEnrollments = await tx.enrollment.findMany({
          where: { student: { familyId: input.familyId } },
          select: { id: true, paidCents: true, remainingCents: true, archivedAt: true, enrollmentStartDate: true, createdAt: true, student: { select: { familyId: true } } },
        });
        const balances = familyEnrollments.map((row) => ({ id: row.id, familyId: row.student.familyId!, remainingCents: row.remainingCents, archivedAt: row.archivedAt, startDate: row.enrollmentStartDate, createdAt: row.createdAt }));
        const requested = input.allocationMode === "automatic"
          ? allocateFamilyPaymentAutomatically(input.familyId, input.amountCents ?? 0, balances)
          : validateManualFamilyAllocations(input.familyId, input.amountCents ?? input.allocations.reduce((sum, row) => sum + row.amountCents, 0), input.allocations, balances);
        if (!requested.length) throw new Error("Enter an amount for at least one enrollment.");
        const enrollments = familyEnrollments.filter((row) => requested.some((item) => item.enrollmentId === row.id));
        if (enrollments.length !== requested.length) throw new Error("All allocations must belong to the selected family.");

        const byId = new Map(enrollments.map((row) => [row.id, row]));
        const totalAmountCents = validatePaymentAllocations(requested.map((item) => ({ ...item, remainingCents: byId.get(item.enrollmentId)?.remainingCents ?? 0 })));

        const payment = await tx.payment.create({
          data: {
            id: requestId,
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
        await tx.auditLog.create({ data: { action: "create", entity: "Payment", entityId: payment.id, createdById: input.createdById, actorId: input.actorId, metadata: { requestHash, totalAmountCents, receiptNumber, familyId: input.familyId, allocations: requested } } });
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
