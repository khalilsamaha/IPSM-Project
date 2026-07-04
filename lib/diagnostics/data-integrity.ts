import { prisma } from "@/lib/prisma";

export type DiagnosticStatus = "pass" | "warning";
export type DiagnosticCheck = { key: string; label: string; description: string; count: number; status: DiagnosticStatus };

export async function getDataIntegrityDiagnostics(): Promise<DiagnosticCheck[]> {
  const [paymentsMissingReceiptNumbers, paymentsWithoutItems, negativeBalances, sessionsMissingRoom, duplicateStudentCodeGroups, duplicateCoursePricingGroups, payments] = await Promise.all([
    prisma.payment.count({ where: { voidedAt: null, OR: [{ receiptNumber: null }, { receiptNumber: "" }] } }),
    prisma.payment.count({ where: { voidedAt: null, items: { none: {} } } }),
    prisma.enrollment.count({ where: { remainingCents: { lt: 0 } } }),
    prisma.scheduleSession.count({ where: { archivedAt: null, status: { in: ["SCHEDULED", "COMPLETED", "MISSED"] }, roomId: null } }),
    prisma.student.groupBy({ by: ["studentCode"], _count: { _all: true }, having: { studentCode: { _count: { gt: 1 } } } }),
    prisma.coursePricing.groupBy({ by: ["courseId", "levelId", "seasonId"], _count: { _all: true }, having: { id: { _count: { gt: 1 } } } }),
    prisma.payment.findMany({ where: { voidedAt: null }, select: { id: true, totalAmountCents: true, items: { select: { amountCents: true } } } }),
  ]);
  const paymentTotalMismatches = payments.filter((payment) => payment.items.reduce((sum, item) => sum + item.amountCents, 0) !== payment.totalAmountCents).length;
  const checks = [
    { key: "payments-missing-receipts", label: "Payments missing receipt numbers", description: "Posted payments should have a receipt number for lookup, printing, and audit trails.", count: paymentsMissingReceiptNumbers },
    { key: "payments-without-items", label: "Payments without payment items", description: "Every non-void payment should allocate to at least one enrollment.", count: paymentsWithoutItems },
    { key: "payment-total-mismatches", label: "Payments whose total does not match allocations", description: "Payment total should equal the sum of allocation items.", count: paymentTotalMismatches },
    { key: "negative-enrollment-balances", label: "Enrollments with negative balances", description: "Remaining balance should not drop below zero after discounts and payments.", count: negativeBalances },
    { key: "sessions-missing-room", label: "Sessions missing room", description: "Scheduled, completed, or missed sessions should identify a room when room scheduling is expected.", count: sessionsMissingRoom },
    { key: "duplicate-student-codes", label: "Duplicate student codes", description: "Student IDs should be unique and stable across records.", count: duplicateStudentCodeGroups.length },
    { key: "duplicate-course-pricing", label: "Duplicate course pricing records", description: "Course, level, and season pricing combinations should have one active source of truth.", count: duplicateCoursePricingGroups.length },
  ];
  return checks.map((check) => ({ ...check, status: check.count === 0 ? "pass" : "warning" }));
}
