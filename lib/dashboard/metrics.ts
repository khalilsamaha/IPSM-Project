export type DashboardMetricInput = {
  students: { status: "ACTIVE" | "INACTIVE" }[];
  families: { status: "ACTIVE" | "INACTIVE" }[];
  enrollments: { status: "ACTIVE" | "PAUSED" | "ENDED" | "CANCELLED"; remainingCents: number }[];
  payments: { totalAmountCents: number; paymentDate: Date; voidedAt: Date | null }[];
  expenses: { amountCents: number; expenseDate: Date }[];
};

export type DashboardMetrics = {
  totalStudents: number;
  totalFamilies: number;
  outstandingBalanceCents: number;
  monthlyRevenueCents: number;
  monthlyExpensesCents: number;
  netProfitCents: number;
};

function isSameMonth(date: Date, referenceDate: Date) {
  return date.getUTCFullYear() === referenceDate.getUTCFullYear() && date.getUTCMonth() === referenceDate.getUTCMonth();
}

export function calculateDashboardMetrics(input: DashboardMetricInput, referenceDate = new Date()): DashboardMetrics {
  const totalStudents = input.students.filter((student) => student.status === "ACTIVE").length;
  const totalFamilies = input.families.filter((family) => family.status === "ACTIVE").length;
  const outstandingBalanceCents = input.enrollments
    .filter((enrollment) => enrollment.status === "ACTIVE" || enrollment.status === "PAUSED")
    .reduce((sum, enrollment) => sum + enrollment.remainingCents, 0);
  const monthlyRevenueCents = input.payments
    .filter((payment) => payment.voidedAt === null && isSameMonth(payment.paymentDate, referenceDate))
    .reduce((sum, payment) => sum + payment.totalAmountCents, 0);
  const monthlyExpensesCents = input.expenses
    .filter((expense) => isSameMonth(expense.expenseDate, referenceDate))
    .reduce((sum, expense) => sum + expense.amountCents, 0);

  return {
    totalStudents,
    totalFamilies,
    outstandingBalanceCents,
    monthlyRevenueCents,
    monthlyExpensesCents,
    netProfitCents: monthlyRevenueCents - monthlyExpensesCents,
  };
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(cents / 100);
}
