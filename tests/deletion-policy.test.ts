import { describe, expect, it } from "vitest";
import { canDeleteEnrollment, canDeletePayment, canDeleteUnusedRecord, canPermanentlyDeleteExpense } from "@/lib/deletion-policy";

describe("safe deletion policy", () => {
  it("requires expenses to be archived before permanent deletion", () => {
    expect(canPermanentlyDeleteExpense({ archivedAt: null }).allowed).toBe(false);
    expect(canPermanentlyDeleteExpense({ archivedAt: new Date() }).allowed).toBe(true);
  });
  it("never allows payment deletion", () => {
    expect(canDeletePayment()).toMatchObject({ allowed: false });
  });
  it("blocks used enrollments and allows unused enrollments", () => {
    expect(canDeleteEnrollment({ paymentItems: 1, lessons: 0 }).allowed).toBe(false);
    expect(canDeleteEnrollment({ paymentItems: 0, lessons: 1 }).allowed).toBe(false);
    expect(canDeleteEnrollment({ paymentItems: 0, lessons: 0 }).allowed).toBe(true);
  });
  it("allows only unused room season course and level deletion", () => {
    expect(canDeleteUnusedRecord("Room", { sessions: 0 }).allowed).toBe(true);
    expect(canDeleteUnusedRecord("Season", { enrollments: 1 }).allowed).toBe(false);
    expect(canDeleteUnusedRecord("Course", { enrollments: 0, pricings: 0 }).allowed).toBe(true);
    expect(canDeleteUnusedRecord("Level", { enrollments: 2 }).allowed).toBe(false);
  });
});
