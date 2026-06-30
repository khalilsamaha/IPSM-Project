import type { PrismaClient } from "@prisma/client";
import { formatCurrency, formatDate } from "@/lib/records/format";
import { nextReceiptNumber } from "@/lib/payments/receipt-number";

type PaymentStore = Pick<PrismaClient, "payment">;
type ReceiptPayment = { receiptNumber: string | null; paymentDate: Date; paymentMethod: string; totalAmountCents: number; family: { name: string; email: string | null; phone: string | null }; items: { amountCents: number; enrollment: { courseName: string; remainingCents: number; student: { firstName: string; lastName: string } } }[] };

function esc(value: string) { return value.replace(/[\\()]/g, "\\$&"); }

export async function generateReceiptNumber(store: PaymentStore, date = new Date()) {
  const latest = await store.payment.findFirst({ where: { receiptNumber: { not: null } }, orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } });
  return nextReceiptNumber(latest?.receiptNumber, date);
}

export function receiptPdfPath(paymentId: string) {
  return `/api/receipts/${paymentId}`;
}

export function buildReceiptPdf(payment: ReceiptPayment) {
  const remainingBalance = payment.items.reduce((sum, item) => sum + item.enrollment.remainingCents, 0);
  const lines = [
    "[IPSM Logo] IPSM Music School",
    "Official Payment Receipt",
    `Receipt: ${payment.receiptNumber ?? "Pending"}`,
    `Date: ${formatDate(payment.paymentDate)}`,
    `Family: ${payment.family.name}`,
    payment.family.email ? `Email: ${payment.family.email}` : null,
    payment.family.phone ? `Phone: ${payment.family.phone}` : null,
    `Payment method: ${payment.paymentMethod}`,
    "",
    "Students / enrollments covered:",
    ...payment.items.map((item) => `${item.enrollment.student.firstName} ${item.enrollment.student.lastName} - ${item.enrollment.courseName}: paid ${formatCurrency(item.amountCents)}, remaining ${formatCurrency(item.enrollment.remainingCents)}`),
    "",
    `Amount paid: ${formatCurrency(payment.totalAmountCents)}`,
    `Remaining balance: ${formatCurrency(remainingBalance)}`,
    "",
    "Thank you for supporting IPSM Music School.",
  ].filter(Boolean) as string[];
  const stream = `BT /F1 13 Tf 50 760 Td ${lines.map((line, i) => `${i ? "0 -20 Td " : ""}(${esc(line)}) Tj`).join(" ")} ET`;
  const objects = ["1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj", "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj", "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj", "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj", `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) { offsets.push(pdf.length); pdf += `${object}\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
