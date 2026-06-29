export type DashboardMetricInput = {
  students: { status: "ACTIVE" | "INACTIVE" }[];
  families: { status: "ACTIVE" | "INACTIVE" }[];
  invoices: { status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "VOID"; totalCents: number; balanceCents: number; issuedAt: Date }[];
  expenses: { amountCents: number; incurredAt: Date }[];
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
  const outstandingBalanceCents = input.invoices
    .filter((invoice) => invoice.status !== "VOID" && invoice.status !== "PAID")
    .reduce((sum, invoice) => sum + invoice.balanceCents, 0);
  const monthlyRevenueCents = input.invoices
    .filter((invoice) => invoice.status !== "VOID" && isSameMonth(invoice.issuedAt, referenceDate))
    .reduce((sum, invoice) => sum + (invoice.totalCents - invoice.balanceCents), 0);
  const monthlyExpensesCents = input.expenses
    .filter((expense) => isSameMonth(expense.incurredAt, referenceDate))
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
