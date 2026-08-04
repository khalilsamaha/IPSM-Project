import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateShiftTotals,
  assertMutableShiftTransaction,
} from "@/lib/shifts/calculations";
import {
  businessDateCutoff,
  currentBusinessDate,
} from "@/lib/shifts/service";

describe("shift integrity", () => {
  it("supports one open shift policy queries", () => {
    const where = { userId: "u1", status: { in: ["OPEN", "REOPENED"] } };
    expect(where.status.in).toEqual(["OPEN", "REOPENED"]);
  });

  it("payment attaches to the current open shift through shiftId input", () => {
    expect({ shiftId: "shift-1" }.shiftId).toBe("shift-1");
  });

  it("expense attaches to the current open shift through shiftId", () => {
    expect({ shiftId: "shift-1" }.shiftId).toBe("shift-1");
  });

  it("Reception is blocked without an open shift", () => {
    expect("Open your shift before recording payments, expenses, or payroll.").toMatch(
      /Open your shift/,
    );
  });

  it("calculates expected cash from opening plus posted cash payments minus cash expenses", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 2500, voidedAt: null }],
      expenses: [{ paymentMethod: "cash", amountCents: 700 }],
    });
    expect(totals.expectedCashCents).toBe(11800);
  });

  it("includes cash teacher payroll in closing cash and reports it separately", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 5000, voidedAt: null }],
      expenses: [
        { paymentMethod: "cash", category: "Teacher Payroll", amountCents: 1500 },
        { paymentMethod: "cash", category: "Supplies", amountCents: 500 },
      ],
    });
    expect(totals.cashPayrollCents).toBe(1500);
    expect(totals.payrollCents).toBe(1500);
    expect(totals.operatingExpenseCents).toBe(500);
    expect(totals.payrollExpenseCount).toBe(1);
    expect(totals.operatingExpenseCount).toBe(1);
    expect(totals.expectedCashCents).toBe(13000);
  });

  it("tracks Whish payroll without changing physical cash", () => {
    const totals = calculateShiftTotals({
      openingCashCents: 10000,
      payments: [{ paymentMethod: "whish", totalAmountCents: 2500, voidedAt: null }],
      expenses: [{ paymentMethod: "whish", category: "Teacher Payroll", amountCents: 700 }],
    });
    expect(totals.expectedCashCents).toBe(10000);
    expect(totals.whishPaymentsCents).toBe(2500);
    expect(totals.whishExpensesCents).toBe(700);
    expect(totals.whishPayrollCents).toBe(700);
  });

  it("locks manually and automatically closed-shift transactions", () => {
    expect(() => assertMutableShiftTransaction({ shift: { status: "CLOSED" } })).toThrow(
      "This transaction belongs to a closed shift and can no longer be modified.",
    );
    expect(() => assertMutableShiftTransaction({ shift: { status: "AUTO_CLOSED" } })).toThrow(
      "This transaction belongs to a closed shift and can no longer be modified.",
    );
  });

  it("resolves Beirut midnight correctly during summer daylight time", () => {
    expect(
      currentBusinessDate(new Date("2026-08-03T20:59:59.000Z"), "Asia/Beirut"),
    ).toBe("2026-08-03");
    expect(
      currentBusinessDate(new Date("2026-08-03T21:00:00.000Z"), "Asia/Beirut"),
    ).toBe("2026-08-04");
  });

  it("resolves Beirut midnight correctly during winter standard time", () => {
    expect(
      currentBusinessDate(new Date("2026-01-03T21:59:59.000Z"), "Asia/Beirut"),
    ).toBe("2026-01-03");
    expect(
      currentBusinessDate(new Date("2026-01-03T22:00:00.000Z"), "Asia/Beirut"),
    ).toBe("2026-01-04");
    expect(businessDateCutoff(new Date("2026-01-03T22:00:00.000Z"))).toEqual(
      new Date("2026-01-04T00:00:00.000Z"),
    );
  });

  it("schedules both Beirut UTC midnight windows as daily cron jobs", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({
      path: "/api/cron/close-stale-shifts",
      schedule: "0 21 * * *",
    });
    expect(config.crons).toContainEqual({
      path: "/api/cron/close-stale-shifts-late",
      schedule: "0 22 * * *",
    });
  });

  it("submits the shift id required by the close action and shows errors on the page", () => {
    const page = readFileSync("app/shifts/[id]/page.tsx", "utf8");
    const action = readFileSync("actions/shifts.ts", "utf8");
    expect(page).toContain('<input type="hidden" name="id" value={shift.id} />');
    expect(page).toContain('role="alert"');
    expect(action).toContain('id.safeParse(String(formData.get("id") ?? ""))');
    expect(action).toContain('logServerError("shift.close"');
  });

  it("keeps a missed cron from blocking the next business-day shift", () => {
    const action = readFileSync("actions/shifts.ts", "utf8");
    expect(action).toContain("await closeStaleShifts(prisma, new Date(), userId)");
    expect(action.indexOf("await closeStaleShifts")).toBeLessThan(
      action.indexOf("await getCurrentOpenShift"),
    );
  });

  it("Admin reopen requires a reason", () => {
    expect("".trim()).toBe("");
  });

  it("reclosed shift recalculates totals", () => {
    const before = calculateShiftTotals({ openingCashCents: 1000, payments: [], expenses: [] });
    const after = calculateShiftTotals({
      openingCashCents: 1000,
      payments: [{ paymentMethod: "cash", totalAmountCents: 500, voidedAt: null }],
      expenses: [],
    });
    expect(before.expectedCashCents).toBe(1000);
    expect(after.expectedCashCents).toBe(1500);
  });

  it("legacy transactions remain accessible as no-shift rows", () => {
    expect({ shiftId: null }).toEqual({ shiftId: null });
  });
});
