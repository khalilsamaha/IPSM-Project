import type { ReceiptPaymentV2 } from "../../lib/payments/receipt-service-v2";
import { buildReceiptFamilyBalanceRows } from "../../lib/payments/receipt-family-balances";

/** Synthetic identities only. Shared by regression tests and owner review PDFs. */
export function receiptFixture(count = 1, long = false, multipleActivities = true): ReceiptPaymentV2 {
  const students = Array.from({ length: count }, (_, index) => ({
    id: `synthetic-${index}`, studentCode: `STU-IPSM-2026-${String(index + 1).padStart(6, "0")}`,
    firstName: long ? `Alexandria Camille Student${index + 1}` : `Student${index + 1}`,
    lastName: long ? "Demonstration Long Family Name" : "Example",
    enrollments: Array.from({ length: index === 0 && multipleActivities ? 2 : 1 }, (_, activity) => ({
      id: `enrollment-${index}-${activity}`, remainingCents: index % 3 === 0 ? 0 : 12575,
      courseName: activity ? "Ensemble" : long ? "Piano performance and extended music interpretation workshop" : "Piano",
      level: { name: activity ? "Intermediate" : "Beginner" }, season: { name: activity ? "Winter 2027" : "Autumn 2026" },
    })),
  }));
  const items = students.flatMap((student, i) => student.enrollments.map(enrollment => ({
    amountCents: i % 3 === 2 ? 0 : 2345,
    enrollment: { ...enrollment, studentId: student.id, student, feeCents: 20000, discountCents: 0, finalFeeCents: 20000 },
  })));
  return {
    receiptNumber: "RCPT-IPSM-2026-000042", paymentDate: new Date("2026-11-12T12:00:00Z"), paymentMethod: "cash",
    totalAmountCents: items.reduce((sum, item) => sum + item.amountCents, 0),
    family: { students, name: long ? "Demonstration Family With A Deliberately Long Name For Layout Review" : "Example Family",
      familyCode: "FAM-IPSM-2026-000008", email: "synthetic@example.invalid", phone: "+000 000 000",
      fatherFirstName: "Synthetic", fatherLastName: "Payer" },
    createdBy: { name: "Synthetic Reception Staff", email: "staff@example.invalid" },
    items, familyBalances: buildReceiptFamilyBalanceRows({ students, allocations: items }),
  };
}
