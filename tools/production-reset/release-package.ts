import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Offline only: no database client, deployment API or history repair operation.
export const releaseVersions = ["20261107000000_teacher_guard_parity", "20261107010000_reset_integrity", "20261108000000_ipsm_identifiers"] as const;
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
export function buildReleasePackage(directory: string, repository = process.cwd()) {
  const migrations = releaseVersions.map(name => {
    const source = join(repository, "supabase/migrations", `${name}.sql`);
    const bytes = readFileSync(source);
    if (!bytes.equals(readFileSync(join(repository, "prisma/migrations", name, "migration.sql")))) throw new Error(`Migration mirrors differ: ${name}`);
    return { name, source, filename: `${name}.sql`, sha256: digest(bytes) };
  });
  mkdirSync(directory); // Refuse to overwrite an existing package.
  mkdirSync(join(directory, "future-delta"));
  for (const m of migrations) copyFileSync(m.source, join(directory, "future-delta", m.filename));
  const manifest = {
    format: 1, status: "REHEARSAL_ONLY_PRODUCTION_BLOCKED", canonicalMechanism: "Supabase",
    historicalSqlIncluded: false, historicalVersions: ["20260731171613", "20260801163840", "20260801165129"],
    historyNote: "Authentic SQL and per-version statement counts unavailable; no substitute history files created.",
    migrations: migrations.map(({ source: _source, ...m }) => m),
    gates: ["runtime and migration connection identity", "historical namespace non-use and recovery certification", "authentic history packaging", "Preview/Auth isolation", "financial acknowledgement", "release approval"],
  };
  writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(directory, "README.txt"), "REVIEW / DISPOSABLE REHEARSAL ONLY. Not a Supabase CLI deployment workspace.\nNo original history was recovered. No production apply command is supplied.\nRead docs/PRODUCTION_RESET_RELEASE_RUNBOOK.md before considering a future release.\n");
  return manifest;
}
export function verifyReleasePackage(directory: string, repository = process.cwd()) {
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const expected = releaseVersions.map(n => `${n}.sql`);
  if (manifest.status !== "REHEARSAL_ONLY_PRODUCTION_BLOCKED" || manifest.historicalSqlIncluded !== false
    || JSON.stringify(manifest.migrations?.map((m: { name: string }) => m.name)) !== JSON.stringify(releaseVersions)
    || JSON.stringify(manifest.migrations?.map((m: { filename: string }) => m.filename)) !== JSON.stringify(expected)
    || JSON.stringify(readdirSync(join(directory, "future-delta")).sort()) !== JSON.stringify([...expected].sort())) throw new Error("Unexpected release package scope or order");
  for (const m of manifest.migrations) {
    const bytes = readFileSync(join(directory, "future-delta", m.filename));
    if (digest(bytes) !== m.sha256 || !bytes.equals(readFileSync(join(repository, "supabase/migrations", m.filename)))
      || !bytes.equals(readFileSync(join(repository, "prisma/migrations", m.name, "migration.sql")))) throw new Error("Release checksum or mirror mismatch");
  }
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("Usage: tsx tools/production-reset/release-package.ts NEW_OUTPUT_DIRECTORY");
  buildReleasePackage(resolve(process.argv[2]));
  verifyReleasePackage(resolve(process.argv[2]));
  process.stdout.write("Verified offline future-delta package. Production remains blocked.\n");
}
