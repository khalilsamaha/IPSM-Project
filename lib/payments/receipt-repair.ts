import type { Prisma, PrismaClient } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { allocateBusinessIdentifier, type IdentifierStore } from "@/lib/business-identifiers";
import { receiptPdfPath } from "@/lib/payments/receipt-service";

export function isUniqueReceiptConflict(error: unknown) {
  return error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function generateUniqueReceiptNumber(store: IdentifierStore, date = new Date()) {
  return allocateBusinessIdentifier(store, "RCPT", date);
}

export async function ensurePaymentReceipt(tx: Prisma.TransactionClient, paymentId: string, date = new Date()) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { receipt: true } });
  if (!payment) throw new Error("Payment not found");
  if (payment.receiptNumber) {
    if (!payment.receipt) await tx.receipt.create({ data: { paymentId, receiptNumber: payment.receiptNumber, pdfPath: receiptPdfPath(paymentId) } });
    else if (payment.receipt.receiptNumber !== payment.receiptNumber || payment.receipt.deletedAt) await tx.receipt.update({ where: { paymentId }, data: { receiptNumber: payment.receiptNumber, deletedAt: null, pdfPath: payment.receipt.pdfPath ?? receiptPdfPath(paymentId) } });
    return payment.receiptNumber;
  }
  const receiptNumber = await generateUniqueReceiptNumber(tx, date);
  await tx.payment.update({ where: { id: paymentId }, data: { receiptNumber } });
  if (payment.receipt) await tx.receipt.update({ where: { paymentId }, data: { receiptNumber, deletedAt: null, pdfPath: payment.receipt.pdfPath ?? receiptPdfPath(paymentId) } });
  else await tx.receipt.create({ data: { paymentId, receiptNumber, pdfPath: receiptPdfPath(paymentId) } });
  return receiptNumber;
}

export async function ensurePaymentReceiptWithRetry(prisma: PrismaClient, paymentId: string, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await prisma.$transaction((tx) => ensurePaymentReceipt(tx, paymentId)); }
    catch (error) { if (!isUniqueReceiptConflict(error) || attempt === attempts) throw error; }
  }
  throw new Error("Unable to generate a unique receipt number after retries.");
}
