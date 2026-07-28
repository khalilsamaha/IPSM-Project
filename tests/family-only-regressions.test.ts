import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync("actions/records.ts", "utf8");
const registrationWorkflow = workflow.slice(workflow.indexOf("export async function registerStudentWorkflow"));
const prismaMigration = readFileSync(
  "prisma/migrations/20260728000000_family_only_recurring_schedule/migration.sql",
  "utf8",
);
const supabaseMigration = readFileSync(
  "supabase/migrations/20260728000000_family_only_recurring_schedule.sql",
  "utf8",
);

describe("family-only registration", () => {
  it.each([
    ["new-family", "new_family_group"],
    ["existing-family", "existing_family_group"],
  ])("connects every student created through the %s path", (_label, path) => {
    expect(workflow).toContain(path);
    expect(workflow).toContain('throw new Error("Every student must belong to a family.")');
    expect(workflow).toMatch(/const studentData: Prisma\.StudentCreateInput[\s\S]*?family:\s*{[\s\S]*?connect:[\s\S]*?id: resolvedFamilyId/);
    expect(workflow).toContain("createStudentWithCode(\n          tx.student,\n          studentData,\n        )");
    expect(registrationWorkflow).not.toContain("studentData as any");
  });
});

describe("family-only migration source compatibility", () => {
  it("keeps the Prisma and Supabase copies byte-for-byte identical", () => {
    expect(prismaMigration).toBe(supabaseMigration);
  });

  it("confines the optional legacy payment column to dynamic SQL", () => {
    const executable = prismaMigration.replace(/--.*$/gm, "");
    const occurrences = executable.match(/p\.student_id/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(prismaMigration).toMatch(/IF EXISTS[\s\S]*?EXECUTE \$sql\$[\s\S]*?p\.student_id/);
  });

  it("has allocation fallback, rollback-safe assertions, and retry-safe schedule DDL", () => {
    expect(prismaMigration.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(prismaMigration).toContain("count(DISTINCT s.family_id) AS family_count");
    expect(prismaMigration).toContain("could not be assigned to a family");
    expect(prismaMigration).toContain("allocations across multiple families");
    expect(prismaMigration).toContain("IS DISTINCT FROM p.family_id");
    expect(prismaMigration).toContain("CREATE TABLE IF NOT EXISTS public.schedule_patterns");
    expect(prismaMigration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS schedule_sessions_schedule_pattern_id_session_date_key");
    expect(prismaMigration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(prismaMigration.trimEnd().endsWith("receipt numbers.")).toBe(true);
  });
});
