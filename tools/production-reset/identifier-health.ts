import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const healthSql = readFileSync(new URL("./identifier-health.sql", import.meta.url), "utf8");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const blockerKeys = ["missing_or_disabled_activation", "selected_activation_mismatch", "binding_mismatch", "ambiguous_latest_attestation", "standby_server", "counter_type_mismatch", "invalid_reservation_metadata", "conflicting_import_owners", "imports_without_reservations", "allocation_mismatch", "unexplained_ipsm_reservations", "live_reference_mismatch", "receipt_payment_mismatch", "missing_or_regressed_counters", "negative_counters", "current_year_exhausted"];
const reviewKeys = ["counter_above_retained_maximum", "unrecognized_counter_key", "ordinary_connections_read_only"];
export type HealthReport = {
  checked_at: string; database: string; effective_role: string; login_role: string;
  database_oid: number; server_started_at: string; server_version: string;
  read_only: string; isolation: string; row_security: string;
  blockers: Record<string, number>; reviews: Record<string, number>;
};
export type HealthResult = {
  status: "PASS" | "REVIEW REQUIRED" | "BLOCKED"; exitCode: 0 | 1 | 2;
  reasons: string[]; snapshot?: HealthReport;
};
const blocked = (reason: string): HealthResult => ({ status: "BLOCKED", exitCode: 2, reasons: [reason] });
export function assessHealth(report: HealthReport): HealthResult {
  const validCounts = (counts: Record<string, number> | undefined, keys: string[]) => counts
    && Object.keys(counts).length === keys.length
    && keys.every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0);
  if (!report || report.read_only !== "on" || report.isolation !== "repeatable read" || report.row_security !== "off"
    || !Number.isSafeInteger(report.database_oid) || report.database_oid <= 0
    || ![report.database, report.effective_role, report.login_role, report.server_version].every(v => typeof v === 'string' && v.length > 0)
    || !Number.isFinite(Date.parse(report.checked_at)) || !Number.isFinite(Date.parse(report.server_started_at))
    || !validCounts(report.blockers, blockerKeys) || !validCounts(report.reviews, reviewKeys)) return blocked("INCOMPLETE_OR_UNSAFE_SNAPSHOT");
  const blockers = blockerKeys.filter(key => report.blockers[key] > 0);
  const reviews = reviewKeys.filter(key => report.reviews[key] > 0);
  return { status: blockers.length ? "BLOCKED" : reviews.length ? "REVIEW REQUIRED" : "PASS",
    exitCode: blockers.length ? 2 : reviews.length ? 1 : 0, reasons: [...blockers, ...reviews], snapshot: report };
}

/** No allocator, write, lock-for-update, advisory lock, import or attestation call. */
export async function checkIdentifierHealth(client: PrismaClient, selectedActivation: string): Promise<HealthResult> {
  if (!uuid.test(selectedActivation)) return blocked("INVALID_SELECTED_ACTIVATION");
  try {
    return await client.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
      // Does not bypass RLS: raises if policies would silently filter a result.
      await tx.$executeRawUnsafe("SET LOCAL row_security=off");
      const rows = await tx.$queryRawUnsafe<Array<{ report: HealthReport }>>(healthSql, selectedActivation);
      return rows.length === 1 ? assessHealth(rows[0].report) : blocked("INCOMPLETE_OR_UNSAFE_SNAPSHOT");
    }, { isolationLevel: "RepeatableRead", maxWait: 3000, timeout: 15000 });
  } catch {
    // Prisma errors can include the SQL, connection URL or private record values.
    // Missing objects, permissions, timeouts and connection failures all block.
    return blocked("DATABASE_CHECK_UNAVAILABLE");
  }
}

export function productionHealthConfig(env: Record<string, string | undefined>, args: string[]) {
  if (args.length !== 2 || args[0] !== "--activation-id" || !uuid.test(args[1])) throw new Error("INVALID_CONFIGURATION");
  const connection = env.IPSM_IDENTIFIER_HEALTH_DATABASE_URL ?? env.IPSM_PRODUCTION_DATABASE_URL;
  if (!connection) throw new Error("INVALID_CONFIGURATION");
  const url = new URL(connection);
  const project = "rakzehtbpzseetldbohm";
  if (!["postgresql:", "postgres:"].includes(url.protocol) || url.pathname !== "/postgres" || url.hash
    || !(url.hostname === `db.${project}.supabase.co`
      || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${project}`)))
    || !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) throw new Error("INVALID_CONFIGURATION");
  // All settings controlling read-only behavior are SQL inside the transaction;
  // never rely on startup options forwarded by Supavisor.
  return { connection, selectedActivation: args[1] };
}
async function main() {
  let client: PrismaClient | undefined;
  let result: HealthResult;
  try {
    const config = productionHealthConfig(process.env, process.argv.slice(2));
    client = new PrismaClient({ datasources: { db: { url: config.connection } }, log: [], errorFormat: "minimal" });
    result = await checkIdentifierHealth(client, config.selectedActivation);
    if (result.snapshot && result.snapshot.database !== "postgres") result = blocked("UNEXPECTED_DATABASE_IDENTITY");
  } catch { result = blocked("INVALID_CONFIGURATION"); }
  finally { try { await client?.$disconnect(); } catch { /* Never disclose driver diagnostics. */ } }
  process.stdout.write(JSON.stringify({ ...result!, selectionSource: "Administrator-supplied Production activation ID; independently verify the deployed selection.", scope: "Database snapshot only; not historical issuance certification or authorization to reactivate." }) + "\n");
  process.exitCode = result!.exitCode;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
