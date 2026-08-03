export type ShiftPaymentLike = {
  paymentMethod: string;
  totalAmountCents: number;
  voidedAt: Date | null;
};

export type ShiftExpenseLike = {
  paymentMethod: string;
  amountCents: number;
  category?: string | null;
  archivedAt?: Date | null;
};

export function isTeacherPayrollExpense(expense: ShiftExpenseLike) {
  return expense.category?.trim().toLowerCase() === "teacher payroll";
}

export function calculateShiftTotals(input: {
  openingCashCents: number;
  payments: ShiftPaymentLike[];
  expenses: ShiftExpenseLike[];
}) {
  const postedPayments = input.payments.filter((payment) => !payment.voidedAt);
  const activeExpenses = input.expenses.filter((expense) => !expense.archivedAt);
  const payrollExpenses = activeExpenses.filter(isTeacherPayrollExpense);
  const operatingExpenses = activeExpenses.filter((expense) => !isTeacherPayrollExpense(expense));

  const cashPaymentsCents = postedPayments
    .filter((payment) => payment.paymentMethod === "cash")
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const whishPaymentsCents = postedPayments
    .filter((payment) => payment.paymentMethod === "whish")
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const cashExpensesCents = activeExpenses
    .filter((expense) => expense.paymentMethod === "cash")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const whishExpensesCents = activeExpenses
    .filter((expense) => expense.paymentMethod === "whish")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const cashPayrollCents = payrollExpenses
    .filter((expense) => expense.paymentMethod === "cash")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const whishPayrollCents = payrollExpenses
    .filter((expense) => expense.paymentMethod === "whish")
    .reduce((sum, expense) => sum + expense.amountCents, 0);
  const operatingExpenseCents = operatingExpenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const payrollCents = payrollExpenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );

  return {
    cashPaymentsCents,
    whishPaymentsCents,
    cashExpensesCents,
    whishExpensesCents,
    cashPayrollCents,
    whishPayrollCents,
    payrollCents,
    operatingExpenseCents,
    expectedCashCents:
      input.openingCashCents + cashPaymentsCents - cashExpensesCents,
    postedPaymentCount: postedPayments.length,
    expenseCount: activeExpenses.length,
    operatingExpenseCount: operatingExpenses.length,
    payrollExpenseCount: payrollExpenses.length,
    voidedPaymentCount: input.payments.length - postedPayments.length,
    activeExpenseCount: activeExpenses.length,
    archivedExpenseCount: input.expenses.length - activeExpenses.length,
  };
}

export function assertMutableShiftTransaction(row: {
  shift?: { status: string } | null;
}) {
  if (["CLOSED", "AUTO_CLOSED"].includes(row.shift?.status ?? "")) {
    throw new Error(
      "This transaction belongs to a closed shift and can no longer be modified.",
    );
  }
}
