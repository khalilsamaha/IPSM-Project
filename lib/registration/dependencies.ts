export type RegistrationDependencyState = {
  studentId: string; courseId: string; levelId: string; teacherId: string;
  slots: unknown[]; preview: unknown | null; calculatedFeeCents: number | null;
  discountCents: number; initialPaymentCents: number;
};

const clearedSchedule = { teacherId: "", slots: [], preview: null, calculatedFeeCents: null, initialPaymentCents: 0 };
export function resetRegistrationDependencies(state: RegistrationDependencyState, changed: "family" | "student" | "season" | "course" | "level" | "teacher" | "dates"): RegistrationDependencyState {
  if (changed === "family") return { ...state, studentId: "", courseId: "", levelId: "", discountCents: 0, ...clearedSchedule };
  if (changed === "student") return { ...state, courseId: "", levelId: "", discountCents: 0, ...clearedSchedule };
  if (changed === "season" || changed === "course" || changed === "level") return { ...state, ...clearedSchedule };
  if (changed === "teacher") return { ...state, slots: [], preview: null, calculatedFeeCents: null };
  return { ...state, preview: null, calculatedFeeCents: null, initialPaymentCents: 0 };
}
