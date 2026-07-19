export type DeleteDecision = { allowed: boolean; reason?: string };
export type CountMap = Record<string, number>;

export function canPermanentlyDeleteExpense(expense: { archivedAt?: Date | null; shift?: { status?: string | null } | null }) {
  if (expense.shift?.status === "CLOSED") return { allowed: false, reason: "This expense belongs to a closed shift and cannot be deleted." };
  return { allowed: true };
}
export function canDeletePayment() { return { allowed: false, reason: "Payments cannot be deleted. Use void/reversal so financial history remains auditable." }; }
export function canDeleteReceipt() { return { allowed: false, reason: "Receipts are regenerated or reprinted from their payment and are not independently deleted." }; }
export function canDeleteEnrollment(enrollment: { paymentItems: number; lessons: number }) {
  return enrollment.paymentItems === 0 && enrollment.lessons === 0 ? { allowed: true } : { allowed: false, reason: "This enrollment has payment items or lessons. End/archive it instead." };
}
export function canDeleteUnusedRecord(entity: "Room" | "Season" | "Course" | "Level", counts: CountMap): DeleteDecision {
  const used = Object.entries(counts).filter(([, count]) => count > 0);
  return used.length === 0 ? { allowed: true } : { allowed: false, reason: `${entity} is already used by ${used.map(([name]) => name).join(", ")}. Archive it instead.` };
}
export function canDeleteTeacher(input: { archived: boolean; enrollments: number; scheduleSessions: number; payrollReferences: number; availability: number; courseAssignments: number }): DeleteDecision {
  if (!input.archived) return { allowed: false, reason: "Archive this teacher before permanent deletion." };
  const blockers = ["enrollments", "scheduleSessions", "payrollReferences", "availability", "courseAssignments"].filter((key) => input[key as keyof typeof input] as number);
  return blockers.length === 0 ? { allowed: true } : { allowed: false, reason: `Teacher has ${blockers.join(", ")}. Archive instead of deleting.` };
}
export function canDeleteFamily(input: { archived: boolean; students: number; payments: number }): DeleteDecision {
  if (!input.archived) return { allowed: false, reason: "Archive/inactivate this family before permanent deletion." };
  if (input.students || input.payments) return { allowed: false, reason: `This family cannot be deleted because it has ${input.students} students and ${input.payments} payments.` };
  return { allowed: true };
}
