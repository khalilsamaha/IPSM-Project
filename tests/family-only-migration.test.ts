import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const prismaSql = readFileSync("prisma/migrations/20260728000000_family_only_recurring_schedule/migration.sql", "utf8");
const supabaseSql = readFileSync("supabase/migrations/20260728000000_family_only_recurring_schedule.sql", "utf8");
const records = readFileSync("actions/records.ts", "utf8");
const students = readFileSync("lib/students.ts", "utf8");

describe("family-only migration compatibility", () => {
  it("keeps the Prisma and Supabase migration copies byte-for-byte identical", () => {
    expect(prismaSql).toBe(supabaseSql);
  });

  it("guards the optional legacy payer column behind dynamic SQL", () => {
    expect(prismaSql).toContain("information_schema.columns");
    expect(prismaSql).toContain("EXECUTE $sql$");
    expect(prismaSql.match(/p\.student_id/g)).toHaveLength(1);
    expect(prismaSql).toContain("WITH payment_family_candidates AS");
  });

  it("fails rather than guessing unresolved, ambiguous, or cross-family payments", () => {
    expect(prismaSql).toContain("could not be assigned to a family");
    expect(prismaSql).toContain("allocations across multiple families");
    expect(prismaSql).toContain("IS DISTINCT FROM p.family_id");
  });

  it("is transactional and makes schedule foundations retry-safe", () => {
    expect(prismaSql.trimStart().startsWith("-- Family-only payer migration")).toBe(true);
    expect(prismaSql).toMatch(/BEGIN;[\s\S]*COMMIT;\s*$/);
    expect(prismaSql).toContain("CREATE TABLE IF NOT EXISTS public.schedule_patterns");
    expect(prismaSql).toContain("ADD COLUMN IF NOT EXISTS schedule_pattern_id");
    expect(prismaSql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });
});

describe("family-connected student creation", () => {
  it("connects students in new-family and existing-family workflow paths", () => {
    expect(records).toContain('normalizedRegistrationType === "new_family"');
    expect(records).toContain('normalizedRegistrationType === "existing_family"');
    expect(records).toContain("const resolvedFamilyId = familyId");
    expect(records).toContain("family: { connect: { id: resolvedFamilyId } }");
    expect(records).not.toContain("studentData as any");
  });

  it("keeps student codes application-generated", () => {
    expect(students).toContain('Omit<Prisma.StudentCreateInput, "studentCode">');
    expect(students).toContain("const createData: Prisma.StudentCreateInput = { ...data, studentCode }");
  });
});
