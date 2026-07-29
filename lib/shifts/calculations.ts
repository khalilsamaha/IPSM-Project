export type ShiftPaymentLike = { paymentMethod: string; totalAmountCents: number; voidedAt: Date | null };
export type ShiftExpenseLike = { paymentMethod: string; amountCents: number; archivedAt?: Date | null };

export function calculateShiftTotals(input: { openingCashCents: number; payments: ShiftPaymentLike[]; expenses: ShiftExpenseLike[] }) {
  const postedPayments = input.payments.filter((payment) => !payment.voidedAt);
  const activeExpenses = input.expenses.filter((expense) => !expense.archivedAt);
  const cashPaymentsCents = postedPayments.filter((payment) => payment.paymentMethod === "cash").reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const whishPaymentsCents = postedPayments.filter((payment) => payment.paymentMethod === "whish").reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const cashExpensesCents = activeExpenses.filter((expense) => expense.paymentMethod === "cash").reduce((sum, expense) => sum + expense.amountCents, 0);
  const whishExpensesCents = activeExpenses.filter((expense) => expense.paymentMethod === "whish").reduce((sum, expense) => sum + expense.amountCents, 0);
  return {
    cashPaymentsCents,
    whishPaymentsCents,
    cashExpensesCents,
    whishExpensesCents,
    expectedCashCents: input.openingCashCents + cashPaymentsCents - cashExpensesCents,
    postedPaymentCount: postedPayments.length,
    expenseCount: activeExpenses.length,
    voidedPaymentCount: input.payments.length - postedPayments.length,
    activeExpenseCount: activeExpenses.length,
    archivedExpenseCount: input.expenses.length - activeExpenses.length,
  };
}

export function assertMutableShiftTransaction(row: { shift?: { status: string } | null }) {
  if (row.shift?.status === "CLOSED") throw new Error("This transaction belongs to a closed shift and can no longer be modified.");
}
