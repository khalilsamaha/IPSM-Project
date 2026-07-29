import { describe, expect, it } from "vitest";
import { calculateSessionBasedFeeCents } from "@/lib/registration/pricing";
import { resetRegistrationDependencies, type RegistrationDependencyState } from "@/lib/registration/dependencies";

const state: RegistrationDependencyState = { studentId: "student", courseId: "course", levelId: "level", teacherId: "teacher", slots: [{}], preview: {}, calculatedFeeCents: 75000, discountCents: 100, initialPaymentCents: 200 };
describe("15-session registration pricing", () => {
  it.each([[15, 75000], [9, 45000], [30, 150000], [1, 5000]])("prices %i sessions deterministically", (sessions, expected) => expect(calculateSessionBasedFeeCents(75000, sessions, 15)).toBe(expected));
  it("rounds integer cents deterministically", () => expect(calculateSessionBasedFeeCents(100, 1, 3)).toBe(33));
  it("rejects invalid package bases", () => expect(() => calculateSessionBasedFeeCents(100, 1, 0)).toThrow());
});
describe("registration dependency resets", () => {
  it("family clears student and enrollment dependencies", () => expect(resetRegistrationDependencies(state, "family")).toMatchObject({ studentId: "", courseId: "", teacherId: "", slots: [], initialPaymentCents: 0 }));
  it("student clears course and teacher", () => expect(resetRegistrationDependencies(state, "student")).toMatchObject({ courseId: "", levelId: "", teacherId: "" }));
  it.each(["season", "course", "level"] as const)("%s clears teacher and schedule", (change) => expect(resetRegistrationDependencies(state, change)).toMatchObject({ teacherId: "", slots: [], calculatedFeeCents: null }));
  it("teacher clears selected slots", () => expect(resetRegistrationDependencies(state, "teacher").slots).toEqual([]));
  it("dates invalidate preview, price, and payment", () => expect(resetRegistrationDependencies(state, "dates")).toMatchObject({ preview: null, calculatedFeeCents: null, initialPaymentCents: 0 }));
});
