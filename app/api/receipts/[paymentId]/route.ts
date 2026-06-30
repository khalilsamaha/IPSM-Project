import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/dashboard/data";
import { buildReceiptPdf } from "@/lib/payments/receipt-service";

export async function GET(_: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await requireSession();
  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { family: true, items: { include: { enrollment: { include: { student: true } } } } } });
  if (!payment) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  await prisma.auditLog.create({ data: { action: "download", entity: "Receipt", entityId: payment.id, actorId: session.userId, metadata: { receiptNumber: payment.receiptNumber } } });
  const pdf = buildReceiptPdf(payment);
  return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${payment.receiptNumber ?? payment.id}.pdf"` } });
}
