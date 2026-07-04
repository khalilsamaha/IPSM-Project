export type StudentFamilyCreateInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
};

export function buildStudentCreateData(row: StudentFamilyCreateInput, familyId: string | null) {
  const base = {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email ?? null,
    phone: row.phone ?? null,
    dateOfBirth: row.dateOfBirth ?? null,
  };
  return familyId ? { ...base, family: { connect: { id: familyId } } } : base;
}

export function shouldCreatePaymentCompatibilityFamily(familyId: string | null, initialPaymentCents: number) {
  return !familyId && initialPaymentCents > 0;
}

export function buildPaymentCompatibilityFamilyData(student: { firstName?: string | null; lastName: string; email?: string | null; phone?: string | null }) {
  return {
    name: `${student.lastName} Family / Group`,
    email: student.email ?? null,
    phone: student.phone ?? null,
    notes: "Lightweight payer record created for an independent student payment.",
  };
}
