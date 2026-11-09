import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { assessHealth, checkIdentifierHealth, healthSql, productionHealthConfig, type HealthReport } from "../tools/production-reset/identifier-health";
import type { PrismaClient } from "@prisma/client";
const id="11111111-1111-4111-8111-111111111111";
const connection="postgresql://postgres:synthetic@db.rakzehtbpzseetldbohm.supabase.co:5432/postgres?sslmode=require";
const keys=[...healthSql.matchAll(/'([a-z_]+)', (?:CASE|\(SELECT)/g)].map(m=>m[1]);
const reviewKeys=["counter_above_retained_maximum","unrecognized_counter_key","ordinary_connections_read_only"];
const good=():HealthReport=>({checked_at:new Date().toISOString(),database:"postgres",effective_role:"postgres",login_role:"postgres",database_oid:5,server_started_at:new Date().toISOString(),server_version:"17.6",read_only:"on",isolation:"repeatable read",row_security:"off",blockers:Object.fromEntries(keys.filter(k=>!reviewKeys.includes(k)).map(k=>[k,0])),reviews:Object.fromEntries(reviewKeys.map(k=>[k,0]))});
describe("identifier read-only health command",()=>{
 it("passes only a complete safe snapshot",()=>{expect(assessHealth(good()).status).toBe("PASS");const r=good();delete r.blockers.binding_mismatch;expect(assessHealth(r).status).toBe("BLOCKED");});
 it.each(["read_only","isolation","row_security"] as const)("rejects incorrect %s",key=>{const r=good();r[key]="unsafe";expect(assessHealth(r).exitCode).toBe(2);});
 it("does not treat a newer disabled attestation as an older enabled success",()=>{const r=good();r.blockers.missing_or_disabled_activation=1;expect(assessHealth(r).reasons).toContain("missing_or_disabled_activation");});
 it("requires review for excess counters; blockers take precedence",()=>{const r=good();r.reviews.counter_above_retained_maximum=1;expect(assessHealth(r).status).toBe("REVIEW REQUIRED");r.blockers.binding_mismatch=1;expect(assessHealth(r).status).toBe("BLOCKED");});
 it("rejects fractional, negative or nonnumeric counts",()=>{for(const value of [-1,NaN,0.5]){const r=good();r.blockers.binding_mismatch=value;expect(assessHealth(r).exitCode).toBe(2);}});
 it("sets READ ONLY before inspection and parameterizes the selected ID",async()=>{
  const calls:string[]=[];let options:unknown;
  const fake={$transaction:async(fn:(tx:unknown)=>Promise<unknown>,o:unknown)=>{options=o;return fn({$executeRawUnsafe:async(s:string)=>calls.push(s),$queryRawUnsafe:async(s:string,selected:string)=>{expect(selected).toBe(id);calls.push(s);return [{report:good()}];}});}} as unknown as PrismaClient;
  expect((await checkIdentifierHealth(fake,id)).status).toBe("PASS");expect(calls[0]).toBe("SET TRANSACTION READ ONLY");expect(calls.at(-1)).toBe(healthSql);expect(options).toMatchObject({isolationLevel:"RepeatableRead",timeout:15000});
 });
 it("never leaks driver details or attempts connection with malformed activation",async()=>{
  const fake={$transaction:async()=>{throw new Error("SECRET_CONNECTION_SENTINEL financial payload");}} as unknown as PrismaClient;
  const result=await checkIdentifierHealth(fake,id);expect(result).toEqual({status:"BLOCKED",exitCode:2,reasons:["DATABASE_CHECK_UNAVAILABLE"]});expect(JSON.stringify(result)).not.toContain("SENTINEL");expect((await checkIdentifierHealth(fake,"';SELECT 1")).reasons).toEqual(["INVALID_SELECTED_ACTIVATION"]);
 });
 it("accepts only explicit exact-IPSM TLS profiles",()=>{
  expect(productionHealthConfig({IPSM_PRODUCTION_DATABASE_URL:connection},["--activation-id",id]).selectedActivation).toBe(id);
  expect(productionHealthConfig({IPSM_IDENTIFIER_HEALTH_DATABASE_URL:connection.replace("postgres:synthetic@db.rakzehtbpzseetldbohm.supabase.co:5432","postgres.rakzehtbpzseetldbohm:synthetic@aws-0-eu.pooler.supabase.com:6543")},["--activation-id",id]).connection).toContain("pooler");
  for(const url of [connection.replace("rakzehtbpzseetldbohm","unrelated"),connection.replace("sslmode=require","sslmode=disable"),connection.replace("/postgres?","/different?"),"not-a-url"]){expect(()=>productionHealthConfig({IPSM_PRODUCTION_DATABASE_URL:url},["--activation-id",id])).toThrow();}
  expect(()=>productionHealthConfig({DATABASE_URL:connection},["--activation-id",id])).toThrow();
 });
 it("CLI emits only a sanitized BLOCKED result on unsafe configuration",()=>{
  const r=spawnSync(process.execPath,["--import","tsx","tools/production-reset/identifier-health.ts","--activation-id",id],{encoding:"utf8",env:{...process.env,IPSM_IDENTIFIER_HEALTH_DATABASE_URL:"SECRET_CONNECTION_SENTINEL"}});
  expect(r.status,r.stderr).toBe(2);expect(r.stdout,r.stderr).not.toBe("");expect(JSON.parse(r.stdout).status).toBe("BLOCKED");expect(r.stdout+r.stderr).not.toContain("SECRET_CONNECTION_SENTINEL");
 });
});
