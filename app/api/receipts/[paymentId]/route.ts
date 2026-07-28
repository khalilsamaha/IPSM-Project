import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ensurePaymentReceiptWithRetry } from "@/lib/payments/receipt-repair";
import { buildReceiptPdf, type ReceiptLayout } from "@/lib/payments/receipt-service";

export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await requireSession();
  const { paymentId } = await params;
  const requestedLayout = new URL(request.url).searchParams.get("layout");
  const layout: ReceiptLayout = requestedLayout === "a4-two-copies" ? "a4-two-copies" : "a5";
  const existing = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  await ensurePaymentReceiptWithRetry(prisma, paymentId);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { family: { include: { students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] } } }, createdBy: true, items: { include: { enrollment: { include: { season: true, course: true, level: true, student: true } } } } } });
  if (!payment?.receiptNumber) return NextResponse.json({ error: "Receipt metadata unavailable" }, { status: 500 });
  await prisma.auditLog.create({ data: { action: "download", entity: "Receipt", entityId: payment.id, actorId: session.userId, metadata: { receiptNumber: payment.receiptNumber, layout } } });
  const pdf = buildReceiptPdf(payment, layout);
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${payment.receiptNumber}.pdf"` } });
}
