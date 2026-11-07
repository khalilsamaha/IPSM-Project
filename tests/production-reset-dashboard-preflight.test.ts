import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const directory = path.resolve("docs/sql/production-reset-dashboard");
const files = readdirSync(directory).filter(name => name.endsWith(".sql")).sort();
describe("Dashboard preflight SQL safety envelope", () => {
  it("includes all eleven numbered operator queries", () => {
    expect(files.map(file => file.slice(0, 2))).toEqual(Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, "0")));
  });
  it.each(files)("keeps %s read-only and independent of psql", file => {
    const sql = readFileSync(path.join(directory, file), "utf8");
    expect(sql).not.toMatch(/^\s*\\/m);
    expect(sql).not.toMatch(/:'\w+'/);
    expect(sql).toContain("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;");
    expect(sql).toContain("SET LOCAL statement_timeout = '45s';");
    expect(sql).toContain("SET LOCAL lock_timeout = '3s';");
    expect(sql).toContain("SET LOCAL row_security = off;");
    expect(sql.trimEnd().endsWith("ROLLBACK;")).toBe(true);
    const code = sql.replace(/--[^\n]*/g, "").replace(/'(?:''|[^'])*'/g, "''");
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|COPY)\b/i);
    expect(code).not.toMatch(/\b(auth\.|pg_authid|rolpassword|query_to_xml|set_config)\b/i);
    expect(code.split(";").map(s => s.trim()).filter(Boolean).every(s => /^(BEGIN TRANSACTION|SET LOCAL|WITH|ROLLBACK)\b/.test(s))).toBe(true);
  });
});
