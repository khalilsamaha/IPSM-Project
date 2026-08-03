import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  DEFAULT_APP_TIME_ZONE,
  BusinessTimeConfigurationError,
  businessTimeZone,
  sessionEndInstant,
} from "@/lib/date-time";

describe("business timezone resolution", () => {
  it("uses the documented application fallback when no explicit timezone is provided", () => {
    expect(APP_TIME_ZONE).toBeTruthy();
    expect(DEFAULT_APP_TIME_ZONE).toBe("Asia/Beirut");
    expect(businessTimeZone()).toBe(APP_TIME_ZONE);
  });

  it("keeps payroll lesson-time calculations operational without a raw environment value", () => {
    const instant = sessionEndInstant({
      sessionDate: "2026-08-14",
      endTime: "10:30",
    });
    expect(instant).toBeInstanceOf(Date);
    expect(Number.isNaN(instant.valueOf())).toBe(false);
  });

  it("still rejects invalid explicit timezone configuration", () => {
    expect(() => businessTimeZone("Not/A_Timezone")).toThrow(
      BusinessTimeConfigurationError,
    );
  });
});
