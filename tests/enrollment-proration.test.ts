import { describe, expect, it } from "vitest";
import { calculateProratedFeeCents, inclusiveDaysBetween } from "@/lib/enrollments/proration";

describe("enrollment proration", () => {
  it("counts inclusive active days", () => {
    expect(inclusiveDaysBetween(new Date("2026-09-01"), new Date("2026-09-30"))).toBe(30);
  });

  it("rounds prorated season pricing safely to cents", () => {
    expect(calculateProratedFeeCents(10000, new Date("2026-09-01"), new Date("2026-09-30"), new Date("2026-09-16"), new Date("2026-09-30"))).toBe(5000);
  });
});
