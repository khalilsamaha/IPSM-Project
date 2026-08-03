import { describe, expect, it } from "vitest";
import { buildReceiptFamilyBalanceRows } from "@/lib/payments/receipt-family-balances";

describe("receipt family balances", () => {
  it("shows the paying student and unchanged sibling balances", () => {
    const rows = buildReceiptFamilyBalanceRows({
      students: [
        {
          id: "maria",
          studentCode: "STU-1",
          firstName: "Maria",
          lastName: "Germanos",
          archivedAt: null,
          enrollments: [
            {
              id: "maria-enrollment",
              archivedAt: null,
              remainingCents: 13000,
              courseName: "Piano",
              course: { name: "Piano" },
              level: { name: "Beginner" },
              season: { name: "Summer 2026" },
            },
          ],
        },
        {
          id: "charbel",
          studentCode: "STU-2",
          firstName: "Charbel",
          lastName: "Germanos",
          archivedAt: null,
          enrollments: [
            {
              id: "charbel-enrollment",
              archivedAt: null,
              remainingCents: 17000,
              courseName: "Saxophone",
              course: { name: "Saxophone" },
              level: { name: "Beginner" },
              season: { name: "Summer 2026" },
            },
          ],
        },
      ],
      allocations: [
        {
          amountCents: 4000,
          enrollment: {
            id: "maria-enrollment",
            studentId: "maria",
            archivedAt: null,
            remainingCents: 13000,
            courseName: "Piano",
            course: { name: "Piano" },
            level: { name: "Beginner" },
            season: { name: "Summer 2026" },
          },
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        student: expect.objectContaining({ firstName: "Charbel" }),
        balanceBeforePaymentCents: 17000,
        paidNowCents: 0,
        remainingCents: 17000,
      }),
      expect.objectContaining({
        student: expect.objectContaining({ firstName: "Maria" }),
        balanceBeforePaymentCents: 17000,
        paidNowCents: 4000,
        remainingCents: 13000,
      }),
    ]);
  });
});
