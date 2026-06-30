export type PaymentLike = { totalAmountCents: number; voidedAt: Date | null; paymentDate?: Date; paymentMethod?: string; familyId?: string };
export type EnrollmentLike = { remainingCents: number; familyId?: string; studentId?: string; seasonId?: string; teacherId?: string | null };
export type ExpenseLike = { amountCents: number; archivedAt: Date | null; expenseDate?: Date; category?: string; paymentMethod?: string };

export function sumRevenueCents(payments: PaymentLike[]) {
  return payments.filter((payment) => payment.voidedAt === null).reduce((sum, payment) => sum + payment.totalAmountCents, 0);
}

export function sumOutstandingCents(enrollments: EnrollmentLike[]) {
  return enrollments.reduce((sum, enrollment) => sum + enrollment.remainingCents, 0);
}

export function sumExpenseCents(expenses: ExpenseLike[], includeArchived = false) {
  return expenses
    .filter((expense) => includeArchived || expense.archivedAt === null)
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

export function calculateProfitLossCents(payments: PaymentLike[], expenses: ExpenseLike[], includeArchivedExpenses = false) {
  return sumRevenueCents(payments) - sumExpenseCents(expenses, includeArchivedExpenses);
}

export function estimateTeacherSalaryCents(hourlyRateCents: number, estimatedHours: number | null | undefined) {
  return hourlyRateCents * (estimatedHours ?? 0);
}
