import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  calculateShiftTotals,
  isTeacherPayrollExpense,
} from "@/lib/shifts/calculations";

import { describeShiftPaymentAllocations } from "@/lib/shifts/payment-details";
import { renderShiftClosingPdf } from "@/lib/shifts/export-pdf";

export const runtime = "nodejs";

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
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
        include: {
          family: true,
          items: { include: { enrollment: { include: { student: true, season: true, course: true, level: true } } } },
        },
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
  const paymentDetails = shift.payments.map(payment => describeShiftPaymentAllocations(payment.items));
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
      "Receipt,Payer,Method,Amount cents,Status,Students,Activities,Seasons,Payment notes,Allocation details",
      ...shift.payments.map((payment, index) => [
        payment.receiptNumber,
        payment.family.name,
        payment.paymentMethod,
        payment.totalAmountCents,
        payment.voidedAt ? "voided" : "posted",
        paymentDetails[index].students,
        paymentDetails[index].activities,
        paymentDetails[index].seasons,
        payment.notes ?? "",
        paymentDetails[index].allocations,
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

  const sections = [
    { title: "Shift and financial summary", lines: summary.map(([key, value]) => `${key}: ${value ?? "-"}`) },
    { title: "Student / family payments", lines: shift.payments.map((payment, index) => {
      const details = paymentDetails[index];
      return [
        `Receipt: ${payment.receiptNumber ?? "-"}`,
        `Payer: ${payment.family.name}`,
        `Method: ${payment.paymentMethod}`,
        `Amount cents: ${payment.totalAmountCents}`,
        `Status: ${payment.voidedAt ? "voided" : "posted"}`,
        `Students: ${details.students || "-"}`,
        `Activities: ${details.activities || "-"}`,
        `Seasons: ${details.seasons || "-"}`,
        `Payment notes: ${payment.notes || "-"}`,
        `Allocation details: ${details.allocations || "-"}`,
      ].join(" | ");
    }) },
    { title: "Teacher payroll", lines: payroll.map(expense =>
      `${expense.expenseDate.toISOString().slice(0, 10)} | ${expense.description} | ${expense.paymentMethod} | amount cents: ${expense.amountCents}`) },
    { title: "Other expenses", lines: otherExpenses.map(expense =>
      `${expense.expenseDate.toISOString().slice(0, 10)} | ${expense.category} | ${expense.description} | ${expense.paymentMethod} | amount cents: ${expense.amountCents} | ${expense.archivedAt ? "archived" : "active"}`) },
    { title: "Closing and reopening history", lines: audits.map(audit =>
      `${audit.createdAt.toISOString()} | ${audit.action} | ${JSON.stringify(audit.metadata)}`) },
  ];
  return new NextResponse(await renderShiftClosingPdf(id, sections), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="shift-${id}.pdf"`,
    },
  });
}
