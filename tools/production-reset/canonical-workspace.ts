import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleasePackage, verifyReleasePackage, releaseVersions } from "./release-package";

type HistoryRecord = {version:string;statement_count:number;statements_md5:string;stored_sql_is_empty_array:boolean;repository_source_fingerprint_reconstruction?:{file:string;stored_chars:number}};
export const reviewedCliVersion = "2.78.1";
const sha256 = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const md5 = (text: string) => createHash("md5").update(text).digest("hex");
const historicalVersions = ["20260731171613", "20260801163840", "20260801165129"];
const config = 'project_id = "ipsm-pr90-reviewed-release"\n[db]\nmajor_version = 17\n[db.migrations]\nenabled = true\n[db.seed]\nenabled = false\n';

/** Serialize the already-reviewed evidence, not a new SQL equivalence investigation.
 * No unproven bootstrap, name, application timestamp or execution claim is added. */
export function recordedHistory(repository = process.cwd()) {
  const evidence = JSON.parse(readFileSync(join(repository, "docs/evidence/production-reset-migration-provenance.json"), "utf8")) as {project_ref:string;recorded_versions:HistoryRecord[]};
  if (evidence.project_ref !== "rakzehtbpzseetldbohm"
    || JSON.stringify(evidence.recorded_versions.map((r: {version:string}) => r.version)) !== JSON.stringify(historicalVersions)) throw new Error("Unreviewed history versions");
  const comments = [
    "-- PostgreSQL ordinary UNIQUE indexes allow multiple NULL level values. This\n-- closes the gap for course-wide teacher assignments.\n",
    "  -- Legacy/imported sessions without an enrollment retain their existing\n  -- application-managed behavior.\n",
  ];
  return evidence.recorded_versions.map((record: {version:string;statement_count:number;statements_md5:string;stored_sql_is_empty_array:boolean;repository_source_fingerprint_reconstruction?:{file:string;stored_chars:number}}) => {
    let statements: string[] = [];
    if (record.version === historicalVersions[0]) {
      if (record.statement_count !== 0 || !record.stored_sql_is_empty_array) throw new Error("Empty recorded history changed");
    } else {
      const source = record.repository_source_fingerprint_reconstruction;
      if (!source || record.statement_count !== 1 || record.stored_sql_is_empty_array) throw new Error("Missing reviewed history source");
      const expectedSource = record.version === historicalVersions[1]
        ? "supabase/migrations/20260801101500_teacher_consistency.sql"
        : "supabase/migrations/20260801190000_enrollment_teacher_availability.sql";
      if (source.file !== expectedSource) throw new Error("Unreviewed history source");
      let text = readFileSync(join(repository, source.file), "utf8");
      if (record.version === historicalVersions[1]) for (const comment of comments) {
        if (text.split(comment).length !== 2) throw new Error("Reviewed comment boundary changed");
        text = text.replace(comment, "");
      }
      if (!text.endsWith("\n")) throw new Error("Reviewed terminal LF changed");
      text = text.slice(0, -1);
      if (text.length !== source.stored_chars) throw new Error("Recorded statement length changed");
      statements = [text];
    }
    if (md5(statements.join("\n")) !== record.statements_md5) throw new Error("Recorded statement fingerprint mismatch");
    // Supabase CLI v2.78.1 migration fetch uses this exact serializer, including
    // `;\n` for an empty array. This is an export, NOT an invented applied no-op.
    const sql = statements.join(";\n") + ";\n";
    return { version: record.version, name: null, nameEvidence: "not supplied; descriptive filename only",
      filename: `${record.version}_recorded_history.sql`, statementCount: statements.length,
      statementsMd5: record.statements_md5, statements, sql, sha256: sha256(sql) };
  });
}

function expectedManifest(repository: string) {
  return { format: 1, status: "EXISTING_DATABASE_ONLY_RELEASE_BLOCKED", cliVersion: reviewedCliVersion,
    projectRef: "rakzehtbpzseetldbohm", bootstrapComplete: false,
    emptyRecordMeaning: "Exact empty transcript; original purpose and bootstrap execution remain unknown",
    history: recordedHistory(repository).map(({statements: _statements, sql: _sql, ...record}) => record),
    future: releaseVersions.map(name => ({filename:`${name}.sql`, sha256:sha256(readFileSync(join(repository,"supabase/migrations",`${name}.sql`)))})),
    configSha256: sha256(config),
    requiredRemotePrefix: historicalVersions,
    gates: ["fresh target history/checksum/schema verification", "accept incomplete bootstrap provenance for existing-database-only release", "all remaining production release gates"],
  };
}
export function buildCanonicalWorkspace(directory: string, repository = process.cwd()) {
  const history = recordedHistory(repository); // Fail before writing if evidence drifts.
  buildReleasePackage(directory, repository); // Independently checks all future mirrors.
  const workspace = join(directory, "workspace", "supabase");
  mkdirSync(join(workspace,"migrations"), {recursive:true});
  writeFileSync(join(workspace,"config.toml"), config);
  for (const record of history) writeFileSync(join(workspace,"migrations",record.filename),record.sql);
  for (const name of releaseVersions) writeFileSync(join(workspace,"migrations",`${name}.sql`),readFileSync(join(directory,"future-delta",`${name}.sql`)));
  writeFileSync(join(directory,"workspace-manifest.json"),JSON.stringify(expectedManifest(repository),null,2)+"\n");
  writeFileSync(join(directory,"recorded-history.json"),JSON.stringify(history.map(({sql:_sql, ...r})=>r),null,2)+"\n");
  writeFileSync(join(directory,"README-workspace.txt"),"Existing-database-only Supabase workspace. Production remains blocked.\nThree recorded history exports and three reviewed future deltas; no bootstrap reconstruction.\nThe empty historical file is Supabase fetch serialization of []; it does not prove a no-op was executed.\nDescriptive history filenames do not assert original migration names.\nDo not db reset, repair, include-all, include-seed or replay the repository migration tree.\nRead docs/PRODUCTION_RESET_CANONICAL_WORKSPACE.md; verify current history content separately from CLI version matching.\n");
  return verifyCanonicalWorkspace(directory,repository);
}
export function verifyCanonicalWorkspace(directory: string, repository = process.cwd()) {
  verifyReleasePackage(directory,repository);
  const expected=expectedManifest(repository);
  const actual=JSON.parse(readFileSync(join(directory,"workspace-manifest.json"),"utf8"));
  if (JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error("Canonical workspace manifest mismatch");
  const workspace=join(directory,"workspace","supabase");
  const cache=join(workspace,".temp");
  // CLI writes only an update-version cache during read-only list/fetch. Permit
  // that inert file, never project-ref, pooler URL or other linked metadata.
  if (existsSync(cache) && (JSON.stringify(readdirSync(cache))!==JSON.stringify(["cli-latest"])
    || !/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(readFileSync(join(cache,"cli-latest"),"utf8").trim()))) throw new Error("Unexpected linked workspace metadata");
  if (JSON.stringify(readdirSync(join(directory,"workspace")).sort())!==JSON.stringify(["supabase"])
    || JSON.stringify(readdirSync(workspace).filter(n=>n!==".temp").sort())!==JSON.stringify(["config.toml","migrations"])) throw new Error("Unexpected workspace configuration");
  if (readFileSync(join(workspace,"config.toml"),"utf8")!==config) throw new Error("Unexpected workspace configuration");
  const files=[...expected.history,...expected.future];
  if (JSON.stringify(readdirSync(join(workspace,"migrations")).sort())!==JSON.stringify(files.map(r=>r.filename).sort())) throw new Error("Unexpected canonical migration set");
  for (const r of files) if (sha256(readFileSync(join(workspace,"migrations",r.filename)))!==r.sha256) throw new Error("Canonical SQL checksum mismatch");
  if (JSON.stringify(JSON.parse(readFileSync(join(directory,"recorded-history.json"),"utf8")))
    !==JSON.stringify(recordedHistory(repository).map(({sql:_sql,...r})=>r))) throw new Error("Recorded transcript mismatch");
  return expected;
}

/** Extra guard beyond CLI version matching: require the exact known prefix plus
 * an ordered prefix of future deltas. Used before interpreting a CLI pending list. */
export function verifyRecordedRemoteHistory(rows: Array<{version:string;statements:string[]|null}>, repository=process.cwd()) {
  const known=recordedHistory(repository);
  const versions=[...historicalVersions,...releaseVersions.map(n=>n.slice(0,14))];
  if (rows.length<known.length || rows.length>versions.length
    || rows.some((r,i)=>r.version!==versions[i])) throw new Error("Remote history is not the reviewed ordered prefix");
  known.forEach((r,i)=>{if(JSON.stringify(rows[i].statements)!==JSON.stringify(r.statements)) throw new Error("Remote recorded SQL differs");});
  // Supabase splits future files when recording statements. Future content must
  // be checked against the reviewed execution artifact, not a joined-body guess.
  return {pending:releaseVersions.slice(rows.length-known.length), futureTranscriptReviewRequired:rows.length>known.length};
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==3) throw new Error("Usage: tsx tools/production-reset/canonical-workspace.ts NEW_OUTPUT_DIRECTORY");
  buildCanonicalWorkspace(resolve(process.argv[2]));
  process.stdout.write("Verified existing-database-only Supabase workspace; production remains blocked.\n");
}
