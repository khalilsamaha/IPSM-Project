import { readFileSync } from "node:fs";

// Independent reference: historical migration files remain unchanged by PR90.
const consistency = readFileSync("supabase/migrations/20260801101500_teacher_consistency.sql", "utf8");
const enrollment = readFileSync("prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql", "utf8");
const comment = "  -- Legacy/imported sessions without an enrollment retain their existing\n  -- application-managed behavior.\n";
export const teacherGuards = [
  { name: "validate_teacher_availability_scope", tag: "availability", source: consistency, liveMd5: "ce495851f4dce1da05f507f4af587a61", canonicalMd5: "ce495851f4dce1da05f507f4af587a61" },
  { name: "validate_schedule_teacher_availability", tag: "schedule", source: consistency, liveMd5: "8bf0ff83d02322ec49fb6500f794a74e", canonicalMd5: "e9d829cecb69aedc692d7b1a5fdaaf07" },
  { name: "validate_enrollment_teacher_availability", tag: "enrollment", source: enrollment, liveMd5: "2e995c04ca6865d8160d798ee9e5099f", canonicalMd5: "e85ba87b42cfa5e5b60c2d3aaa0ccfc1" },
].map(guard => {
  const match = guard.source.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${guard.name}\\(\\)[\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`));
  if (!match) throw new Error(`Missing historical guard: ${guard.name}`);
  const canonical = match[1];
  const live = guard.tag === "enrollment" ? canonical.replaceAll("\n", "\r\n")
    : guard.tag === "schedule" ? canonical.replace(comment, "") : canonical;
  return { ...guard, canonical, live };
});

// Escaped SQL literal: psql must not normalize physical CRLF input lines.
export function guardSql(name: string, body: string) {
  const literal = "E'" + body.replaceAll("\\", "\\\\").replaceAll("'", "''").replaceAll("\r", "\\r").replaceAll("\n", "\\n") + "'";
  return `CREATE OR REPLACE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS ${literal};`;
}
export const guardInstallSql = (variant: "canonical" | "live") => teacherGuards.map(g => guardSql(g.name, g[variant])).join("\n");
