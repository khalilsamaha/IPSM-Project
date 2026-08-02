import { describe, expect, it } from "vitest";
import { persistTeacherConfiguration } from "@/lib/teachers/create-configuration";
import type { TeacherConfiguration } from "@/lib/teachers/onboarding";

describe("teacher configuration persistence", () => {
  it("creates assignments before availability so database guards can validate scope", async () => {
    const calls: string[] = [];
    const stored: Record<string, unknown> = {};
    const tx = {
      teacher: {
        create: async ({ data }: { data: unknown }) => {
          calls.push("teacher");
          stored.teacher = data;
          return { id: "teacher-id" };
        },
      },
      teacherCourse: {
        createMany: async ({ data }: { data: unknown }) => {
          calls.push("assignments");
          stored.assignments = data;
          return { count: 1 };
        },
      },
      teacherAvailability: {
        createMany: async ({ data }: { data: unknown }) => {
          calls.push("availability");
          stored.availability = data;
          return { count: 1 };
        },
      },
      auditLog: {
        create: async ({ data }: { data: unknown }) => {
          calls.push("audit");
          stored.audit = data;
          return { id: "audit-id" };
        },
      },
    };
    const data: TeacherConfiguration = {
      fullName: "Teacher One",
      email: null,
      phone: null,
      notes: null,
      status: "ACTIVE",
      compensationBasis: "SESSION_UNIT",
      rateCents: 1500,
      sessionUnitMinutes: 30,
      assignments: [{ courseId: "11111111-1111-4111-8111-111111111111", levelId: null }],
      availability: [{
        courseId: "11111111-1111-4111-8111-111111111111",
        seasonId: "22222222-2222-4222-8222-222222222222",
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "10:00",
        effectiveFrom: new Date("2026-08-05T00:00:00.000Z"),
        effectiveTo: new Date("2026-09-23T00:00:00.000Z"),
        notes: null,
      }],
    };

    await persistTeacherConfiguration(tx as never, data, {
      actorId: "33333333-3333-4333-8333-333333333333",
      createdById: "44444444-4444-4444-8444-444444444444",
    });

    expect(calls).toEqual(["teacher", "assignments", "availability", "audit"]);
    expect(stored.assignments).toEqual([expect.objectContaining({ teacherId: "teacher-id" })]);
    expect(stored.availability).toEqual([expect.objectContaining({ teacherId: "teacher-id" })]);
  });
});
