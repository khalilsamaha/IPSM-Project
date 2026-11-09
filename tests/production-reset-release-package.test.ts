import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReleasePackage, verifyReleasePackage, releaseVersions } from "../tools/production-reset/release-package";
const dirs: string[] = [];
function fixture() { const base=mkdtempSync(join(tmpdir(),"ipsm-package-")); dirs.push(base); const output=join(base,"review"); buildReleasePackage(output); return output; }
afterEach(()=>{for(const dir of dirs.splice(0)) rmSync(dir,{recursive:true,force:true});});
describe("offline reset release package",()=>{
 it("contains only the ordered genuine future delta and never fabricated history",()=>{
  const result=verifyReleasePackage(fixture());
  expect(result.migrations.map((m: {name:string})=>m.name)).toEqual([...releaseVersions]);
  expect(result.historicalSqlIncluded).toBe(false); expect(result.status).toBe("REHEARSAL_ONLY_PRODUCTION_BLOCKED");
 });
 it("rejects changed SQL even when a manifest is edited",()=>{
  const output=fixture(); const replacement="SELECT 1;";
  writeFileSync(join(output,"future-delta",`${releaseVersions[0]}.sql`),replacement);
  const manifest=JSON.parse(readFileSync(join(output,"manifest.json"),"utf8"));
  manifest.migrations[0].sha256=createHash("sha256").update(replacement).digest("hex");
  writeFileSync(join(output,"manifest.json"),JSON.stringify(manifest));
  expect(()=>verifyReleasePackage(output)).toThrow("mismatch");
 });
 it("rejects reordered migrations and extra history files",()=>{
  const output=fixture(); const manifest=JSON.parse(readFileSync(join(output,"manifest.json"),"utf8"));
  manifest.migrations.reverse(); writeFileSync(join(output,"manifest.json"),JSON.stringify(manifest));
  expect(()=>verifyReleasePackage(output)).toThrow("scope or order");
  manifest.migrations.reverse(); writeFileSync(join(output,"manifest.json"),JSON.stringify(manifest));
  writeFileSync(join(output,"future-delta","20260731171613_fabricated.sql"),"-- fake");
  expect(()=>verifyReleasePackage(output)).toThrow("scope or order");
 });
 it("refuses to overwrite an existing package",()=>{const output=fixture(); expect(()=>buildReleasePackage(output)).toThrow();});
});
