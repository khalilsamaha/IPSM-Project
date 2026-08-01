import type { ScheduleSessionStatus } from "@prisma/client";

export type PayrollItemType = "COMPLETED_LESSON" | "MISSED_APPROVED" | "ADJUSTMENT";

export type PayableLessonPolicy = {
  payCompleted: boolean;
  payScheduled: boolean;
  payCancelled: boolean;
  payMissed: boolean;
  approvedMissedSessionIds?: Set<string>;
};

export const defaultPayableLessonPolicy: PayableLessonPolicy = {
  payCompleted: true,
  payScheduled: false,
  payCancelled: false,
  payMissed: false,
};

export function buildPayableLessonPolicy(input: {
  allowPayableMissedLessons: boolean;
  approvedMissedSessionIds?: Set<string>;
}): PayableLessonPolicy {
  return {
    ...defaultPayableLessonPolicy,
    payMissed: input.allowPayableMissedLessons,
    approvedMissedSessionIds: input.approvedMissedSessionIds,
  };
}

export function isPayableLesson(status: ScheduleSessionStatus | string, sessionId: string, policy: PayableLessonPolicy = defaultPayableLessonPolicy) {
  if (status === "COMPLETED") return policy.payCompleted;
  if (status === "SCHEDULED") return policy.payScheduled;
  if (status === "CANCELLED") return policy.payCancelled;
  if (status === "MISSED") return policy.payMissed || Boolean(policy.approvedMissedSessionIds?.has(sessionId));
  return false;
}

export function payrollItemTypeFor(status: ScheduleSessionStatus | string): PayrollItemType {
  return status === "MISSED" ? "MISSED_APPROVED" : "COMPLETED_LESSON";
}
