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

describe("administrator Query 02 teacher-schema extract (not fixture evidence)", () => {
  const evidence = JSON.parse(readFileSync("docs/evidence/production-reset-teacher-schema-query02.json", "utf8"));
  const reference = JSON.parse(readFileSync("docs/evidence/production-reset-guard-equivalence.json", "utf8")).non_function_reference;
  const md5 = (s: string) => createHash("md5").update(s).digest("hex");
  it("retains original provenance and exactly sixteen scoped observations", () => {
    expect(evidence.source_sha256).toBe("ffca529d1d219385e53f5c63cb8cc322fe0722eacecbdcd2d113a02dbbf10b26");
    expect(evidence.source_item_count).toBe(545);
    expect(evidence.items).toHaveLength(16);
    expect(evidence.verification.all_selected_items_equal_original_items).toBe(true);
    expect(evidence.items.filter((i: any) => i.section === "enum").map((i: any) => i.details))
      .toEqual([{ type: "TeacherCompensationBasis", label: "HOURLY", order: 1 }, { type: "TeacherCompensationBasis", label: "SESSION_UNIT", order: 2 }]);
  });
  it("matches all nine displayed column types, nullability, generation flags and default hashes", () => {
    const columns = evidence.items.filter((i: any) => i.section === "column");
    expect(columns).toHaveLength(9);
    for (const { details: d } of columns) {
      const expected = reference.columns.find((c: any) => c.relname === d.table && c.attname === d.name);
      expect(expected).toBeDefined();
      expect(d).toMatchObject({ type: expected.type, not_null: expected.attnotnull,
        identity: "", generated: "", has_default: expected.default_expr !== null,
        default_md5: expected.default_expr === null ? null : md5(expected.default_expr) });
    }
  });
  it("matches both index definition hashes, ordered keys and exported integrity flags", () => {
    const indexes = evidence.items.filter((i: any) => i.section === "index");
    expect(indexes).toHaveLength(2);
    for (const { details: d } of indexes) {
      expect(d.definition_md5).toBe(md5(reference.indexes.find((i: any) => i.indexname === d.name).indexdef));
      expect(d).toMatchObject({ valid: true, ready: true, primary: false, has_expression: false, expression_md5: null });
      const partial = d.name === "teacher_courses_teacher_course_all_levels_key";
      expect(d.unique).toBe(partial);
      expect(d.columns).toEqual(partial ? ["teacher_id", "course_id"] : ["course_id"]);
      expect(d.key_count).toBe(partial ? 2 : 1);
      expect(d.attribute_count).toBe(d.key_count);
      expect(d.has_predicate).toBe(partial);
      expect(d.predicate_md5).toBe(partial ? md5("(level_id IS NULL)") : null);
    }
  });
});
