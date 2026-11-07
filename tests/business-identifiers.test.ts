import { describe, expect, it, vi } from "vitest";
import { allocateBusinessIdentifier } from "@/lib/business-identifiers";
import { readFileSync } from "node:fs";

describe("durable business identifiers", () => {
  it("uses the database allocator instead of the remaining live record maximum", async () => {
    const query = vi.fn().mockResolvedValue([{ value: "RCPT-2026-000101" }]);
    expect(await allocateBusinessIdentifier({ $queryRaw: query }, "RCPT", new Date("2026-11-07"))).toBe("RCPT-2026-000101");
    expect(query.mock.calls[0].slice(1)).toEqual(["RCPT",2026]);
  });
  it("keeps both additive migration paths byte-for-byte equivalent", () => {
    for (const migration of ["20261107000000_teacher_guard_parity", "20261107010000_reset_integrity"]) {
      expect(readFileSync(`prisma/migrations/${migration}/migration.sql`,"utf8")).toBe(readFileSync(`supabase/migrations/${migration}.sql`,"utf8"));
    }
  });
});
