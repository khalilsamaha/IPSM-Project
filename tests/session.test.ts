import { describe, expect, it } from "vitest";
import { resolveProfileRole } from "@/lib/auth/session";

describe("session profile role resolution", () => {
  it("uses the ADMIN role from the authenticated user's public profile", () => {
    expect(resolveProfileRole({ email: "reception@example.com", role: "ADMIN" })).toBe("ADMIN");
  });

  it("uses the RECEPTION role from the authenticated user's public profile", () => {
    expect(resolveProfileRole({ email: "admin@example.com", role: "RECEPTION" })).toBe("RECEPTION");
  });

  it("falls back safely when a profile role is missing or unsupported", () => {
    expect(resolveProfileRole(null)).toBe("RECEPTION");
    expect(resolveProfileRole({ email: "admin@example.com", role: null })).toBe("RECEPTION");
    expect(resolveProfileRole({ email: "admin@example.com", role: "ADMINISTRATOR" })).toBe("RECEPTION");
  });
});
