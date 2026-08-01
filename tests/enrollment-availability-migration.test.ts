import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const prismaMigration =
  "prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql";
const supabaseMigration =
  "supabase/migrations/20260801190000_enrollment_teacher_availability.sql";

describe("enrollment teacher availability migration", () => {
  it("keeps Prisma and Supabase migration SQL identical", () => {
    const prismaSql = readFileSync(prismaMigration, "utf8");
    const supabaseSql = readFileSync(supabaseMigration, "utf8");
    expect(supabaseSql).toBe(prismaSql);
  });

  it("installs an enrollment guard with a fixed function search path", () => {
    const sql = readFileSync(prismaMigration, "utf8");
    expect(sql).toContain("validate_enrollment_teacher_availability");
    expect(sql).toContain("enrollment_teacher_availability_guard");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("generate_series");
  });
});
