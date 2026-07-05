export function getOutstandingEnrollmentWhere(familyId: string) {
  return { remainingCents: { gt: 0 }, student: { familyId } } as const;
}
export function getIndependentOutstandingEnrollmentWhere(studentId: string) {
  return { remainingCents: { gt: 0 }, studentId, student: { familyId: null } } as const;
}
