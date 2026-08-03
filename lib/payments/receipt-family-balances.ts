import type { ReceiptFamilyBalanceRow } from "@/lib/payments/receipt-service-v2";

type ReceiptEnrollmentBalanceInput = {
  id: string;
  archivedAt?: Date | null;
  remainingCents: number;
  courseName: string;
  course?: { name: string } | null;
  level?: { name: string } | null;
  season?: { name: string } | null;
};

type ReceiptStudentBalanceInput = {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  archivedAt?: Date | null;
  enrollments: ReceiptEnrollmentBalanceInput[];
};

type ReceiptAllocationBalanceInput = {
  amountCents: number;
  enrollment: ReceiptEnrollmentBalanceInput & {
    studentId: string;
  };
};

function activityLabel(enrollment: ReceiptEnrollmentBalanceInput) {
  const course = enrollment.course?.name ?? enrollment.courseName;
  const level = enrollment.level?.name ? ` / ${enrollment.level.name}` : "";
  const season = enrollment.season?.name ? ` · ${enrollment.season.name}` : "";
  return `${course}${level}${season}`;
}

export function buildReceiptFamilyBalanceRows(input: {
  students: ReceiptStudentBalanceInput[];
  allocations: ReceiptAllocationBalanceInput[];
}): ReceiptFamilyBalanceRow[] {
  const allocationByEnrollment = new Map<string, number>();
  for (const allocation of input.allocations) {
    allocationByEnrollment.set(
      allocation.enrollment.id,
      (allocationByEnrollment.get(allocation.enrollment.id) ?? 0) +
        allocation.amountCents,
    );
  }

  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  for (const allocation of input.allocations) {
    if (!studentsById.has(allocation.enrollment.studentId)) {
      studentsById.set(allocation.enrollment.studentId, {
        id: allocation.enrollment.studentId,
        studentCode: "",
        firstName: "Student",
        lastName: "",
        archivedAt: null,
        enrollments: [allocation.enrollment],
      });
    }
  }

  return [...studentsById.values()]
    .map((student) => {
      const enrollments = new Map<string, ReceiptEnrollmentBalanceInput>();
      for (const enrollment of student.enrollments) {
        if (!enrollment.archivedAt || allocationByEnrollment.has(enrollment.id)) {
          enrollments.set(enrollment.id, enrollment);
        }
      }
      for (const allocation of input.allocations) {
        if (allocation.enrollment.studentId === student.id) {
          enrollments.set(allocation.enrollment.id, allocation.enrollment);
        }
      }

      const rows = [...enrollments.values()];
      const paidNowCents = rows.reduce(
        (sum, enrollment) =>
          sum + (allocationByEnrollment.get(enrollment.id) ?? 0),
        0,
      );
      const remainingCents = rows.reduce(
        (sum, enrollment) => sum + enrollment.remainingCents,
        0,
      );
      const activities = [
        ...new Set(rows.map(activityLabel).filter(Boolean)),
      ];
      return {
        student: {
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
        },
        activity: activities.join(", ") || "No open enrollment",
        balanceBeforePaymentCents: remainingCents + paidNowCents,
        paidNowCents,
        remainingCents,
        include: !student.archivedAt || rows.length > 0 || paidNowCents > 0,
      };
    })
    .filter((row) => row.include)
    .map(({ include: _, ...row }) => row)
    .sort((a, b) =>
      `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`,
      ),
    );
}
