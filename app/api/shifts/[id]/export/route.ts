import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  calculateShiftTotals,
  isTeacherPayrollExpense,
} from "@/lib/shifts/calculations";

export const runtime = "nodejs";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const safe = (value: unknown) => String(value ?? "—")
  .replace(/[\\()]/g, "\\$&")
  .replace(/[^\x20-\x7e]/g, "-");

function simplePdf(lines: string[]) {
  const content = lines
    .slice(0, 70)
    .map((line, index) => `BT /F1 8 Tf 30 ${810 - index * 11} Td (${safe(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [4 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output));
    output += `${object}\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!hasPermission(session.role, "records:write")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const shift = await prisma.cashierShift.findUnique({
    where: { id },
    include: {
      user: true,
      closedBy: true,
      payments: {
        include: { family: true },
        orderBy: { createdAt: "asc" },
      },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!shift || !["CLOSED", "AUTO_CLOSED"].includes(shift.status)) {
    return NextResponse.json({ error: "Closed shift not found" }, { status: 404 });
  }

  const audits = await prisma.auditLog.findMany({
    where: { entity: "CashierShift", entityId: id },
    orderBy: { createdAt: "asc" },
  });
  const user = await prisma.userProfile.findUnique({
    where: { authId: session.userId },
    select: { id: true },
  });
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "pdf";
  await prisma.auditLog.create({
    data: {
      action: `export_${format}`,
      entity: "CashierShift",
      entityId: id,
      actorId: session.userId,
      createdById: user?.id,
      metadata: { snapshotVersion: 2 },
    },
  });

  const totals = calculateShiftTotals({
    openingCashCents: shift.openingCashCents,
    payments: shift.payments,
    expenses: shift.expenses,
  });
  const payroll = shift.expenses.filter(
    (expense) => !expense.archivedAt && isTeacherPayrollExpense(expense),
  );
  const otherExpenses = shift.expenses.filter(
    (expense) => !isTeacherPayrollExpense(expense),
  );
  const snapshot = shift.closingSnapshot && typeof shift.closingSnapshot === "object"
    ? shift.closingSnapshot as Record<string, unknown>
    : {};

  const summary: [string, unknown][] = [
    ["Shift ID", shift.id],
    ["Business date", shift.businessDate.toISOString().slice(0, 10)],
    ["Receptionist", shift.user.name],
    ["Opened", shift.openedAt.toISOString()],
    ["Closed", shift.closedAt?.toISOString()],
    ["Closing mode", shift.status === "AUTO_CLOSED" ? "automatic" : "manual/reconciled"],
    ["Opening cash cents", shift.openingCashCents],
    ["Cash payments cents", totals.cashPaymentsCents],
    ["Whish payments cents", totals.whishPaymentsCents],
    ["Cash teacher payroll cents", totals.cashPayrollCents],
    ["Whish teacher payroll cents", totals.whishPayrollCents],
    ["Other expenses cents", totals.operatingExpenseCents],
    ["All cash expenses cents", totals.cashExpensesCents],
    ["All Whish expenses cents", totals.whishExpensesCents],
    ["Expected cash cents", totals.expectedCashCents],
    ["Declared cash cents", shift.declaredCashCents],
    ["Difference cents", shift.differenceCents],
    ["Variance reason", shift.varianceReason],
    ["Closing snapshot version", 2],
    ["Closing snapshot", JSON.stringify(snapshot)],
  ];

  if (format === "csv") {
    const rows = [
      "\uFEFFSummary",
      "Field,Value",
      ...summary.map((row) => row.map(csv).join(",")),
      "",
      "Payments",
      "Receipt,Payer,Method,Amount cents,Status",
      ...shift.payments.map((payment) => [
        payment.receiptNumber,
        payment.family.name,
        payment.paymentMethod,
        payment.totalAmountCents,
        payment.voidedAt ? "voided" : "posted",
      ].map(csv).join(",")),
      "",
      "Teacher payroll",
      "Date,Description,Method,Amount cents",
      ...payroll.map((expense) => [
        expense.expenseDate.toISOString().slice(0, 10),
        expense.description,
        expense.paymentMethod,
        expense.amountCents,
      ].map(csv).join(",")),
      "",
      "Other expenses",
      "Date,Category,Description,Method,Amount cents,Status",
      ...otherExpenses.map((expense) => [
        expense.expenseDate.toISOString().slice(0, 10),
        expense.category,
        expense.description,
        expense.paymentMethod,
        expense.amountCents,
        expense.archivedAt ? "archived" : "active",
      ].map(csv).join(",")),
      "",
      "Audit history",
      "Time,Action,Metadata",
      ...audits.map((audit) => [
        audit.createdAt.toISOString(),
        audit.action,
        JSON.stringify(audit.metadata),
      ].map(csv).join(",")),
    ];
    return new NextResponse(rows.join("\r\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="shift-${id}.csv"`,
      },
    });
  }

  const lines = [
    "IPSM Shift Closing Report",
    ...summary.map(([key, value]) => `${key}: ${value ?? "-"}`),
    "Payments",
    ...shift.payments.map((payment) => `${payment.receiptNumber ?? "-"} | ${payment.family.name} | ${payment.paymentMethod} | ${payment.totalAmountCents} | ${payment.voidedAt ? "voided" : "posted"}`),
    "Teacher payroll",
    ...payroll.map((expense) => `${expense.description} | ${expense.paymentMethod} | ${expense.amountCents}`),
    "Other expenses",
    ...otherExpenses.map((expense) => `${expense.category} | ${expense.description} | ${expense.paymentMethod} | ${expense.amountCents} | ${expense.archivedAt ? "archived" : "active"}`),
    "Closing and reopening history",
    ...audits.map((audit) => `${audit.createdAt.toISOString()} | ${audit.action}`),
  ];
  return new NextResponse(simplePdf(lines), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="shift-${id}.pdf"`,
    },
  });
}
