import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { buildCanonicalWorkspace, recordedHistory, reviewedCliVersion, verifyCanonicalWorkspace, verifyRecordedRemoteHistory } from "../tools/production-reset/canonical-workspace";
import { releaseVersions } from "../tools/production-reset/release-package";

// Explicit optional release rehearsal: requires the real pinned CLI. Ordinary CI
// exercises the offline checks; this suite never silently substitutes a mock CLI.
const enabled=process.env.IPSM_TEST_SUPABASE_CLI==="1";
const original=process.env.RESET_TEST_DATABASE_URL;
const proof=enabled ? await createDisposableProductionResetTestClient() : null;
let root:string, target:string, ownerUrl:string, readerUrl:string, packet:string, guardBefore:string, originalHistory:string;
function command(binary:string,args:string[],input?:string){
 if(!proof)throw new Error("Verified disposable fixture required");
 return spawnSync(binary,args,{input,encoding:"utf8",timeout:90000,maxBuffer:8*1024*1024,
   env:{NODE_ENV:"test",PATH:process.env.PATH,HOME:process.env.HOME,PGSSLMODE:"disable",LANG:"C.UTF-8",NO_COLOR:"1"}});
}
function sql(statement:string,url=target){return command("psql",[url,"-X","-qAt","-v","ON_ERROR_STOP=1"],statement);}
function ok(statement:string,url=target){const r=sql(statement,url);expect(r.status,r.stderr).toBe(0);return r.stdout.trim();}
function cli(args:string[],workdir=join(packet,"workspace"),url=readerUrl){
 // TLS is disabled only for this already-verified runner-owned loopback target.
 const r=command("supabase",[...args,"--db-url",url,"--workdir",workdir]);
 writeFileSync(join(root,`cli-${args.join("-").replaceAll("/","_")}-${Date.now()}.log`),r.stdout+r.stderr);
 return r;
}
const output=(r:ReturnType<typeof cli>)=>r.stdout+r.stderr;
const history=()=>JSON.parse(ok("SELECT json_agg(row_to_json(m) ORDER BY version) FROM supabase_migrations.schema_migrations m"));
const guards=()=>ok("SELECT md5(string_agg(to_jsonb(p)::text||p.xmin::text,',' ORDER BY p.proname)) FROM pg_proc p WHERE proname IN ('validate_enrollment_teacher_availability','validate_schedule_teacher_availability','validate_teacher_availability_scope')");

describe.skipIf(!enabled)("real Supabase CLI canonical release on owned PostgreSQL",()=>{
 beforeAll(async()=>{
  await proof!.$disconnect();root=mkdtempSync(join(tmpdir(),"ipsm-canonical-cli-"));packet=join(root,"package");
  expect(command("supabase",["--version"]).stdout.trim()).toBe(reviewedCliVersion);
  // Clone the existing sanitized pre-delta fixture; never bootstrap using history exports.
  const r=command("createdb",["--maintenance-db",original!,"--template","ipsm_rehearsal_restore_before","--owner","ipsm_rehearsal_owner","ipsm_canonical_release_test"]);expect(r.status,r.stderr).toBe(0);
  const url=new URL(original!);url.pathname="/ipsm_canonical_release_test";target=url.toString();
  expect(ok("SELECT current_setting('ipsm.disposable_test_token')")).toBe(process.env.IPSM_DISPOSABLE_TEST_TOKEN);
  url.username="ipsm_rehearsal_owner";ownerUrl=url.toString();url.username="ipsm_history_reader";readerUrl=url.toString();
  ok(`SET ROLE ipsm_rehearsal_owner; CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, name text, statements text[]);`);
  // Synthetic copies of actual recorded rows, not history repair or a claim that
  // these statements created this fixture. Historical names were not supplied.
  for(const h of recordedHistory()){
   const literal=JSON.stringify(h.statements).replaceAll("'","''");
   ok(`INSERT INTO supabase_migrations.schema_migrations VALUES('${h.version}',NULL,ARRAY(SELECT jsonb_array_elements_text('${literal}'::jsonb)))`);
  }
  ok("CREATE ROLE ipsm_history_reader LOGIN; ALTER ROLE ipsm_history_reader SET default_transaction_read_only=on; GRANT USAGE ON SCHEMA supabase_migrations TO ipsm_history_reader; GRANT SELECT ON supabase_migrations.schema_migrations TO ipsm_history_reader;");
  buildCanonicalWorkspace(packet);guardBefore=guards();originalHistory=JSON.stringify(history());
 });
 afterAll(()=>{if(root)console.log(`Canonical CLI evidence: ${root}`);});
 it("fetches the exact empty export and known nonempty bytes using a read-only role",()=>{
  const workdir=join(root,"fetch");mkdirSync(workdir);const r=cli(["migration","fetch"],workdir);expect(r.status,output(r)).toBe(0);
  const files=readdirSync(join(workdir,"supabase/migrations"));expect(files).toHaveLength(3);
  for(const h of recordedHistory()) expect(readFileSync(join(workdir,"supabase/migrations",`${h.version}_.sql`),"utf8")).toBe(h.sql);
  expect(JSON.stringify(history())).toBe(originalHistory);expect(guards()).toBe(guardBefore);
 });
 it("lists three matching versions and dry-runs exactly the future deltas in order",()=>{
  verifyCanonicalWorkspace(packet);expect(verifyRecordedRemoteHistory(history()).pending).toEqual([...releaseVersions]);
  const list=cli(["migration","list"]);expect(list.status,output(list)).toBe(0);
  for(const h of recordedHistory())expect(output(list)).toMatch(new RegExp(`${h.version}\\s*\\|\\s*${h.version}`));
  const dry=cli(["db","push","--dry-run"]);expect(dry.status,output(dry)).toBe(0);
  expect(output(dry).match(/2026\d{10}_[a-z_]+\.sql/g)).toEqual(releaseVersions.map(n=>`${n}.sql`));
  expect(JSON.stringify(history())).toBe(originalHistory);expect(guards()).toBe(guardBefore);
 });
 it("rejects missing historical versions and extra old repository migrations",()=>{
  const dir=join(packet,"workspace/supabase/migrations"),path=join(dir,"20260731171613_recorded_history.sql");
  rmSync(path);const missing=cli(["db","push","--dry-run"]);expect(missing.status).not.toBe(0);expect(output(missing)).toContain("Remote migration versions not found");writeFileSync(path,";\n");
  const extra=join(dir,"20260731000000_unreviewed.sql");writeFileSync(extra,"SELECT 1;");
  const old=cli(["db","push","--dry-run"]);expect(old.status).not.toBe(0);expect(output(old)).toContain("inserted before the last migration");rmSync(extra);
  expect(JSON.stringify(history())).toBe(originalHistory);
 });
 it("detects SQL drift that CLI version matching alone cannot detect",()=>{
  const file=join(packet,"workspace/supabase/migrations/20260731171613_recorded_history.sql");writeFileSync(file,"SELECT 1;");
  const list=cli(["migration","list"]);expect(list.status).toBe(0);expect(()=>verifyCanonicalWorkspace(packet)).toThrow("checksum");writeFileSync(file,";\n");
  ok("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['SELECT 1;'] WHERE version='20260731171613'");
  expect(()=>verifyRecordedRemoteHistory(history())).toThrow("SQL differs");
  ok("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY[]::text[] WHERE version='20260731171613'");expect(JSON.stringify(history())).toBe(originalHistory);
 });
 it("applies only the three reviewed deltas and preserves original history and guards",()=>{
  verifyCanonicalWorkspace(packet);const pushed=cli(["db","push","--yes"],undefined,ownerUrl);expect(pushed.status,output(pushed)).toBe(0);
  expect(output(pushed).match(/Applying migration (\S+)\.\.\./g)).toEqual(releaseVersions.map(n=>`Applying migration ${n}.sql...`));
  expect(JSON.stringify(history().slice(0,3))).toBe(originalHistory);expect(guards()).toBe(guardBefore);
  expect(ok("SELECT count(*) FROM public.business_identifier_activations")).toBe("0");
  expect(verifyRecordedRemoteHistory(history())).toEqual({pending:[],futureTranscriptReviewRequired:true});
 });
 it("does not reapply any migration on a second push and keeps every history row unchanged",()=>{
  const before=JSON.stringify(history());const result=cli(["db","push","--yes"],undefined,ownerUrl);
  expect(result.status,output(result)).toBe(0);expect(output(result)).toContain("Remote database is up to date.");expect(output(result)).not.toContain("Applying migration");
  expect(JSON.stringify(history())).toBe(before);expect(guards()).toBe(guardBefore);
 });
 it("fails closed if a future ledger row is lost instead of repairing or rerunning DDL",()=>{
  ok("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261108000000'");
  const result=cli(["db","push","--yes"],undefined,ownerUrl);expect(result.status).not.toBe(0);
  expect(output(result)).toContain('column "namespace" of relation "issued_business_identifiers" already exists');
  expect(ok("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261108000000'")).toBe("0");
  expect(ok("SELECT count(*) FROM public.business_identifier_activations")).toBe("0");expect(guards()).toBe(guardBefore);
 });
});
