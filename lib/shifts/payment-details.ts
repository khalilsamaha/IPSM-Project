/** Presentation-only descriptions of existing payment allocations for shift reports.
 * No payment mutation, rounding or balance calculation takes place here.
 */
export type ShiftPaymentAllocation = {
  amountCents: number;
  enrollment: {
    courseName: string;
    course?: { name: string } | null;
    level?: { name: string } | null;
    season: { name: string };
    student: { studentCode: string; firstName: string; lastName: string };
  };
};

const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].join("; ");
const money = (cents: number) => `USD ${(cents / 100).toFixed(2)}`;

export function describeShiftPaymentAllocations(items: readonly ShiftPaymentAllocation[]) {
  const students: string[] = [];
  const activities: string[] = [];
  const seasons: string[] = [];
  const allocations: string[] = [];
  for (const item of items) {
    const enrollment = item.enrollment;
    const student = `${enrollment.student.studentCode} - ${enrollment.student.firstName} ${enrollment.student.lastName}`;
    const activity = `${enrollment.course?.name ?? enrollment.courseName}${enrollment.level?.name ? ` / ${enrollment.level.name}` : ""}`;
    students.push(student);
    activities.push(activity);
    seasons.push(enrollment.season.name);
    allocations.push(`${student} | ${activity} | ${enrollment.season.name} | ${money(item.amountCents)}`);
  }
  return {
    students: distinct(students),
    activities: distinct(activities),
    seasons: distinct(seasons),
    allocations: allocations.join("; "),
  };
}
