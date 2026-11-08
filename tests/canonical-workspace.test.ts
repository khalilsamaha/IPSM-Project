import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCanonicalWorkspace, recordedHistory, verifyCanonicalWorkspace, verifyRecordedRemoteHistory } from "../tools/production-reset/canonical-workspace";
import { releaseVersions } from "../tools/production-reset/release-package";
const dirs:string[]=[];
function fixture(){const base=mkdtempSync(join(tmpdir(),"ipsm-canonical-unit-"));dirs.push(base);const output=join(base,"package");buildCanonicalWorkspace(output);return output;}
const remote=()=>recordedHistory().map(r=>({version:r.version,statements:r.statements}));
afterEach(()=>{dirs.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true}));});
describe("canonical existing-database workspace",()=>{
 it("exports the actual empty transcript without claiming bootstrap or a historical name",()=>{
  const dir=fixture(), manifest=verifyCanonicalWorkspace(dir);
  expect(manifest.history.map(r=>r.statementCount)).toEqual([0,1,1]);
  expect(manifest.bootstrapComplete).toBe(false);expect(manifest.status).toBe("EXISTING_DATABASE_ONLY_RELEASE_BLOCKED");
  expect(manifest.history.every(r=>r.name===null)).toBe(true);
  expect(readFileSync(join(dir,"workspace/supabase/migrations/20260731171613_recorded_history.sql"),"utf8")).toBe(";\n");
 });
 it("includes only the exact historical versions and three reviewed future deltas",()=>{
  const manifest=verifyCanonicalWorkspace(fixture());
  expect(manifest.requiredRemotePrefix).toEqual(["20260731171613","20260801163840","20260801165129"]);
  expect(manifest.future.map(r=>r.filename)).toEqual(releaseVersions.map(n=>`${n}.sql`));
 });
 it("rejects changed historical SQL even with a matching attacker-edited manifest",()=>{
  const dir=fixture();writeFileSync(join(dir,"workspace/supabase/migrations/20260731171613_recorded_history.sql"),"SELECT 1;");
  expect(()=>verifyCanonicalWorkspace(dir)).toThrow("checksum");
  const manifest=JSON.parse(readFileSync(join(dir,"workspace-manifest.json"),"utf8"));manifest.history[0].sha256="changed";
  writeFileSync(join(dir,"workspace-manifest.json"),JSON.stringify(manifest));expect(()=>verifyCanonicalWorkspace(dir)).toThrow("manifest mismatch");
 });
 it("rejects extra files from the historical repository migration tree",()=>{
  const dir=fixture();writeFileSync(join(dir,"workspace/supabase/migrations/20260101000000_bootstrap.sql"),"SELECT 1;");
  expect(()=>verifyCanonicalWorkspace(dir)).toThrow("migration set");
 });
 it("rejects linked metadata, seed or role files and modified configuration",()=>{
  const dir=fixture();writeFileSync(join(dir,"workspace/supabase/roles.sql"),"-- unexpected");
  expect(()=>verifyCanonicalWorkspace(dir)).toThrow("configuration");rmSync(join(dir,"workspace/supabase/roles.sql"));
  writeFileSync(join(dir,"workspace/supabase/config.toml"),'project_id="other"');expect(()=>verifyCanonicalWorkspace(dir)).toThrow("configuration");
 });
 it("allows only the inert CLI version cache, never linked target metadata",()=>{
  const dir=fixture(),cache=join(dir,"workspace/supabase/.temp");mkdirSync(cache);writeFileSync(join(cache,"cli-latest"),"v3.0.0");
  expect(()=>verifyCanonicalWorkspace(dir)).not.toThrow();writeFileSync(join(cache,"project-ref"),"unexpected-target");
  expect(()=>verifyCanonicalWorkspace(dir)).toThrow("linked workspace metadata");
 });
 it("rejects altered transcript evidence",()=>{
  const dir=fixture();writeFileSync(join(dir,"recorded-history.json"),"[]");expect(()=>verifyCanonicalWorkspace(dir)).toThrow("transcript");
 });
 it("requires the actual empty array, not NULL or a fabricated statement",()=>{
  const rows=remote();rows[0].statements=["SELECT 1;"];expect(()=>verifyRecordedRemoteHistory(rows)).toThrow("SQL differs");
  expect(()=>verifyRecordedRemoteHistory([{version:rows[0].version,statements:null},...remote().slice(1)])).toThrow("SQL differs");
 });
 it("rejects missing, extra, reordered and hole-containing version sets",()=>{
  const rows=remote();expect(()=>verifyRecordedRemoteHistory(rows.slice(1))).toThrow("prefix");
  expect(()=>verifyRecordedRemoteHistory([...rows,{version:"20260802000000",statements:[]}])).toThrow("prefix");
  expect(()=>verifyRecordedRemoteHistory([...rows,{version:"20261107010000",statements:[]}])).toThrow("prefix");
  expect(()=>verifyRecordedRemoteHistory([...rows].reverse())).toThrow("prefix");
 });
 it("returns exact pending order but requires future transcript review after partial/full application",()=>{
  const rows=remote();expect(verifyRecordedRemoteHistory(rows)).toEqual({pending:[...releaseVersions],futureTranscriptReviewRequired:false});
  const first=[...rows,{version:"20261107000000",statements:["synthetic"]}];
  expect(verifyRecordedRemoteHistory(first)).toEqual({pending:releaseVersions.slice(1),futureTranscriptReviewRequired:true});
  expect(verifyRecordedRemoteHistory([...rows,...releaseVersions.map(n=>({version:n.slice(0,14),statements:[]}))]).pending).toEqual([]);
 });
 it("refuses to overwrite a workspace",()=>{const dir=fixture();expect(()=>buildCanonicalWorkspace(dir)).toThrow();});
});
