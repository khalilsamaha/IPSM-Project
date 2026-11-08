import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { teacherGuards } from "./helpers/teacher-guard-bodies";
import { productionResetForeignKeys } from "@/lib/production-reset-foreign-keys";

const evidence = JSON.parse(readFileSync("docs/evidence/production-reset-2026-11-07.json", "utf8")) as {
  project: string;
  foreign_keys: Array<{ signature: string; validated: boolean }>;
  teacher_guards: Array<{ name: string; function_body_md5: string }>;
};
describe("administrator-provided IPSM schema evidence", () => {
  it("covers all 45 validated live relationships with only 22 explicit NO ACTION variants", () => {
    expect(evidence.project).toBe("rakzehtbpzseetldbohm");
    expect(evidence.foreign_keys).toHaveLength(45);
    expect(evidence.foreign_keys.every(row => row.validated && productionResetForeignKeys.has(row.signature))).toBe(true);
    const variants = [...productionResetForeignKeys].filter(signature => signature.endsWith("a"));
    expect(variants).toHaveLength(22);
    expect(variants.sort()).toEqual(evidence.foreign_keys.map(row => row.signature).filter(signature => signature.endsWith("a")).sort());
    for (const variant of variants) expect(productionResetForeignKeys.has(variant.slice(0, -1) + "c")).toBe(true);
    expect(productionResetForeignKeys.size).toBe(68); // 45 original + new payroll FK + exactly 22 variants
    const diagnostic = readFileSync("docs/sql/production-reset-dashboard/12_foreign_key_reconciliation.sql", "utf8");
    const reviewed = diagnostic.split("reviewed_no_action(relationship) AS (VALUES")[1].split("expected(relationship")[0];
    const diagnosticRelationships = [...reviewed.matchAll(/'(public\.[^']+)'/g)].map(match => match[1]);
    expect(diagnosticRelationships.sort()).toEqual(variants.map(signature => signature.slice(0, -3)).sort());
  });
  it("does not generalize NO ACTION to unreviewed relationships or accept changed deletion actions", () => {
    expect(productionResetForeignKeys.has("public.course_pricings.course_id->public.courses.id:ca")).toBe(false);
    expect(productionResetForeignKeys.has("public.expenses.payroll_id->public.teacher_payrolls.id:ra")).toBe(false);
    expect(productionResetForeignKeys.has("public.payments.family_id->public.families.id:ca")).toBe(false);
    expect(productionResetForeignKeys.has("public.payments.unknown_id->public.families.id:ra")).toBe(false);
  });
  it("reconstructs only the exact approved live prosrc bytes from unchanged historical bodies", () => {
    const parity = readFileSync("prisma/migrations/20261107000000_teacher_guard_parity/migration.sql", "utf8");
    for (const guard of teacherGuards) {
      expect(createHash("md5").update(guard.canonical).digest("hex")).toBe(guard.canonicalMd5);
      expect(createHash("md5").update(guard.live).digest("hex")).toBe(guard.liveMd5);
      expect(evidence.teacher_guards.find(row => row.name === guard.name)?.function_body_md5).toBe(guard.liveMd5);
      const literal = parity.split(`$${guard.tag}_body$`)[1];
      expect(literal).toBe(guard.canonical);
      expect(parity).toContain(guard.liveMd5);
      const report = readFileSync("docs/sql/production-reset-dashboard/13_teacher_guard_parity.sql", "utf8");
      expect(report).toContain(guard.canonicalMd5);
      expect(report).toContain(guard.liveMd5);
    }
  });
});
