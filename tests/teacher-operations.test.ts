import { describe, expect, it } from "vitest";
import {
  isCompletePayrollMonth,
  payrollMonthBounds,
  previousPayrollMonth,
} from "@/lib/payroll/month";
import {
  APP_TIME_ZONE,
  BusinessTimeConfigurationError,
  businessTimeZone,
  sessionEndInstant,
} from "@/lib/date-time";
import {
  availabilitySummary,
  expandTeacherAvailabilityForWeek,
  intervalUnionMinutes,
  mondayOfWeek,
} from "@/lib/schedule/calendar-availability";

describe("calendar-month payroll", () => {
  it.each([
    ["2026-01", "2026-01-31"],
    ["2026-02", "2026-02-28"],
    ["2028-02", "2028-02-29"],
    ["2026-04", "2026-04-30"],
    ["2026-07", "2026-07-31"],
  ])("derives %s boundaries", (month, end) => {
    const bounds = payrollMonthBounds(month);
    expect(bounds.periodStart.toISOString().slice(0, 10)).toBe(`${month}-01`);
    expect(bounds.periodEnd.toISOString().slice(0, 10)).toBe(end);
  });

  it("rejects arbitrary values and incomplete months", () => {
    expect(() => payrollMonthBounds("2026-01-15")).toThrow();
    expect(isCompletePayrollMonth("2026-07", new Date("2026-07-29"))).toBe(
      false,
    );
    expect(previousPayrollMonth(new Date("2026-01-10"))).toBe("2025-12");
  });
});

describe("business instants", () => {
  it("respects Beirut offset and midnight", () => {
    expect(
      sessionEndInstant({
        sessionDate: "2026-07-01",
        endTime: "00:15",
        timeZone: "Asia/Beirut",
      }).toISOString(),
    ).toBe("2026-06-30T21:15:00.000Z");
  });

  it("handles DST offset", () => {
    expect(
      sessionEndInstant({
        sessionDate: "2026-03-30",
        endTime: "18:00",
        timeZone: "Europe/Paris",
      }).toISOString(),
    ).toBe("2026-03-30T16:00:00.000Z");
  });

  it("uses the application fallback but rejects invalid configuration", () => {
    expect(businessTimeZone("")).toBe(APP_TIME_ZONE);
    expect(() => businessTimeZone("Mars/Olympus")).toThrow(
      BusinessTimeConfigurationError,
    );
  });
});

describe("availability calendar", () => {
  const rule = {
    id: "a",
    teacherId: "t",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "12:00",
    seasonId: null,
    effectiveFrom: null,
    effectiveTo: null,
    status: "ACTIVE",
    archivedAt: null,
  };

  it("uses Monday and unions overlaps", () => {
    expect(mondayOfWeek("2026-07-29").toISOString().slice(0, 10)).toBe(
      "2026-07-27",
    );
    expect(
      intervalUnionMinutes([
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "11:00", endTime: "14:00" },
      ]),
    ).toBe(300);
  });

  it("calculates only booking overlap", () => {
    const summary = availabilitySummary(
      [rule, { ...rule, id: "b", startTime: "11:00", endTime: "14:00" }],
      [
        {
          teacherId: "t",
          sessionDate: new Date("2026-07-27"),
          startTime: "10:00",
          endTime: "11:00",
        },
      ],
    );
    expect(summary.availableMinutes).toBe(300);
    expect(summary.bookedMinutes).toBe(60);
    expect(summary.remainingMinutes).toBe(240);
  });

  it("expands weekly rules and closures", () => {
    const blocks = expandTeacherAvailabilityForWeek({
      teacherId: "t",
      weekStart: "2026-07-29",
      seasonId: "s",
      timeZone: "Asia/Beirut",
      rules: [rule],
      bookings: [],
      closures: [
        {
          startDate: new Date("2026-07-27"),
          endDate: new Date("2026-07-27"),
        },
      ],
    });
    expect(blocks[0]).toMatchObject({
      date: "2026-07-27",
      status: "CLOSED",
    });
  });
});
