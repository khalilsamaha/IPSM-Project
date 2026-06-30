export function getOutstandingEnrollmentWhere(familyId: string) {
  return { remainingCents: { gt: 0 }, student: { familyId } } as const;
}
