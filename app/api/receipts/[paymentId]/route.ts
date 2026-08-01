import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ensurePaymentReceiptWithRetry } from "@/lib/payments/receipt-repair";
import {
  buildReceiptPdfV2,
  ReceiptGenerationError,
  type ReceiptLayout,
} from "@/lib/payments/receipt-service-v2";
import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";
const SAFE_RECEIPT_ERROR =
  "Receipt generation is temporarily unavailable. The payment remains recorded. Contact an administrator and provide the receipt number.";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const session = await requireSession();
  const { paymentId } = await params;
  const requestedLayout = new URL(request.url).searchParams.get("layout");
  const requestedMode = new URL(request.url).searchParams.get("mode");
  const layout: ReceiptLayout =
    requestedLayout === "a4-two-copies" ? "a4-two-copies" : "a5";
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  await ensurePaymentReceiptWithRetry(prisma, paymentId);
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      family: {
        include: {
          students: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
        },
      },
      createdBy: true,
      items: {
        include: {
          enrollment: {
            include: {
              season: true,
              course: true,
              level: true,
              student: true,
            },
          },
        },
      },
    },
  });
  if (!payment?.receiptNumber) {
    return NextResponse.json(
      { error: "Receipt metadata unavailable" },
      { status: 500 },
    );
  }
  const mode = payment.voidedAt
    ? "voided"
    : requestedMode === "reprint"
      ? "reprint"
      : "original";
  await prisma.auditLog.create({
    data: {
      action:
        mode === "voided"
          ? "voided_copy_download"
          : mode === "reprint"
            ? "reprint"
            : "download",
      entity: "Receipt",
      entityId: payment.id,
      actorId: session.userId,
      metadata: { receiptNumber: payment.receiptNumber, layout, mode },
    },
  });
  try {
    const pdf = buildReceiptPdfV2(payment, layout, mode);
    return new NextResponse(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${payment.receiptNumber}.pdf"`,
      },
    });
  } catch (error) {
    logServerError("receipt.generate", error, {
      failureCode:
        error instanceof ReceiptGenerationError
          ? error.code
          : "PDF_RENDER_FAILED",
      paymentId,
      receiptNumber: payment.receiptNumber,
    });
    return NextResponse.json(
      { error: SAFE_RECEIPT_ERROR, receiptNumber: payment.receiptNumber },
      { status: 500 },
    );
  }
}
