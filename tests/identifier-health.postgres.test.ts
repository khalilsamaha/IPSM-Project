import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { checkIdentifierHealth, healthSql } from "../tools/production-reset/identifier-health";
const proof=process.env.RESET_TEST_DATABASE_URL ? await createDisposableProductionResetTestClient() : null;
const id=randomUUID(),owner=randomUUID(),hash="a".repeat(64);
function sql(text:string){if(!proof)throw Error("Owned disposable fixture required");const r=spawnSync("psql",[process.env.RESET_TEST_DATABASE_URL!,"-XqAt","-v","ON_ERROR_STOP=1"],{input:text,encoding:"utf8"});expect(r.status,r.stderr).toBe(0);return r.stdout.trim();}
const tables=["business_identifier_activations","business_identifier_allocations","business_identifier_imports","business_identifier_counters","issued_business_identifiers"];
// Corruption is deliberate and limited to the marker-verified disposable cluster.
function corrupt(table:string,statement:string){if(!tables.includes(table)&&table!=="families")throw Error("Unexpected fixture table");sql(`BEGIN;ALTER TABLE public.${table} DISABLE TRIGGER USER;${statement};ALTER TABLE public.${table} ENABLE TRIGGER USER;COMMIT;`);}
function attest(enabled=true,activation=id){sql(`INSERT INTO public.business_identifier_activations(id,enabled,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES('${activation}',${enabled},'${hash}','${hash}','Synthetic health fixture',0,now());`);}
function allocate(){return sql(`SELECT public.allocate_ipsm_identifier('FAM',2026,'${owner}','${id}');`);}
const check=()=>checkIdentifierHealth(proof!,id);
describe.skipIf(!proof)("identifier health against owned PostgreSQL",()=>{
 beforeAll(()=>{
  // Reconstruct the real schema in this runner-owned disposable database only.
  sql("DROP SCHEMA public CASCADE;CREATE SCHEMA public;");
  for(const file of ["tests/migrations/reset-baseline.sql","tests/migrations/reset-bootstrap.sql","prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql","supabase/migrations/20261107000000_teacher_guard_parity.sql"])sql(readFileSync(file,"utf8"));
  sql("DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
  for(const name of ["20261107010000_reset_integrity","20261108000000_ipsm_identifiers"])sql(readFileSync(`supabase/migrations/${name}.sql`,"utf8"));
 },60000);
 beforeEach(()=>{
  sql(`BEGIN;${tables.map(t=>`ALTER TABLE public.${t} DISABLE TRIGGER USER;`).join("")}TRUNCATE public.families CASCADE;TRUNCATE ${tables.map(t=>'public.'+t).join(',')},public.audit_logs;${tables.map(t=>`ALTER TABLE public.${t} ENABLE TRIGGER USER;`).join("")}COMMIT;`);
 });
 afterAll(async()=>{await proof?.$disconnect();});
 it("blocks absent certification",async()=>{expect((await check()).reasons).toContain("missing_or_disabled_activation");});
 it("passes empty certified history and does not change any ledger, counter or audit",async()=>{
  attest();const snapshot=()=>tables.concat("audit_logs").map(t=>sql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) FROM public.${t} t;`));const before=snapshot();expect((await check()).status).toBe("PASS");expect(snapshot()).toEqual(before);
 });
 it("handles retained allocations after deletion/reset without requiring a surviving family",async()=>{attest();allocate();expect((await check()).status).toBe("PASS");});
 it("blocks an incorrect selected ID and a newer disabled hold",async()=>{attest();expect((await checkIdentifierHealth(proof!,randomUUID())).reasons).toContain("selected_activation_mismatch");attest(false,randomUUID());expect((await check()).reasons).toContain("missing_or_disabled_activation");});
 it.each(["database_oid=database_oid+1","server_started_at=server_started_at-interval '1 second'"])("blocks changed binding %s",async(change)=>{attest();corrupt(tables[0],`UPDATE public.business_identifier_activations SET ${change}`);expect((await check()).reasons).toContain("binding_mismatch");});
 it("detects regressed and missing counters",async()=>{attest();allocate();corrupt(tables[3],"UPDATE public.business_identifier_counters SET value=0");expect((await check()).reasons).toContain("missing_or_regressed_counters");corrupt(tables[3],"DELETE FROM public.business_identifier_counters");expect((await check()).reasons).toContain("missing_or_regressed_counters");});
 it("reports REVIEW REQUIRED for unexplained excess high-water, never repairs it",async()=>{attest();allocate();corrupt(tables[3],"UPDATE public.business_identifier_counters SET value=9");expect((await check()).status).toBe("REVIEW REQUIRED");expect(sql("SELECT value FROM public.business_identifier_counters")).toBe("9");});
 it("detects missing allocation reservations",async()=>{attest();allocate();corrupt(tables[4],"DELETE FROM public.issued_business_identifiers");expect((await check()).reasons).toContain("allocation_mismatch");});
 it("accepts independently recovered reservations without allocating",async()=>{attest();sql(`INSERT INTO public.business_identifier_imports(kind,value,purpose,manifest_sha256,approved_by,transaction_id) VALUES('FAM','FAM-IPSM-2026-000042','recovery','${hash}','Synthetic independent journal','');`);expect((await check()).status).toBe("PASS");expect(sql("SELECT count(*) FROM public.business_identifier_allocations")).toBe("0");});
 it("accepts legacy ownerless reservations without claiming their ownership",async()=>{attest();sql(`INSERT INTO public.business_identifier_imports(kind,value,purpose,manifest_sha256,approved_by,transaction_id) VALUES('FAM','FAM-2026-000007','reservation','${hash}','Synthetic legacy journal','');`);expect((await check()).status).toBe("PASS");});
 it("accepts a live family with same-transaction allocation and correct ownership",async()=>{attest();sql(`INSERT INTO public.families(id,name,family_code,updated_at) VALUES('${owner}','Synthetic valid family',public.allocate_ipsm_identifier('FAM',2026,'${owner}','${id}'),now());`);expect((await check()).status).toBe("PASS");});
 it("blocks unreserved live records and ownership conflicts",async()=>{attest();corrupt("families",`INSERT INTO public.families(id,name,family_code,updated_at) VALUES('${owner}','PRIVATE_RECORD_SENTINEL','FAM-IPSM-2026-000001',now())`);const r=await check();expect(r.reasons).toContain("live_reference_mismatch");expect(JSON.stringify(r)).not.toContain("PRIVATE_RECORD_SENTINEL");});
 it("blocks missing tables rather than reporting empty/healthy",async()=>{attest();sql("ALTER TABLE public.business_identifier_counters RENAME TO health_missing_counters");try{expect((await check()).reasons).toContain("DATABASE_CHECK_UNAVAILABLE");}finally{sql("ALTER TABLE public.health_missing_counters RENAME TO business_identifier_counters");}});
 it("fails closed on permission denial and policy-filtered reads",()=>{
  attest();sql("DO $$ BEGIN CREATE ROLE ipsm_health_reader; EXCEPTION WHEN duplicate_object THEN NULL; END $$;GRANT USAGE ON SCHEMA public TO ipsm_health_reader;");
  const run=()=>spawnSync("psql",[process.env.RESET_TEST_DATABASE_URL!,"-XqAt","-v","ON_ERROR_STOP=1"],{input:`BEGIN READ ONLY;SET LOCAL ROLE ipsm_health_reader;SET LOCAL row_security=off;${healthSql.replaceAll('$1',`'${id}'`)};ROLLBACK;`,encoding:"utf8"});
  expect(run().status).not.toBe(0);sql("GRANT SELECT ON ALL TABLES IN SCHEMA public TO ipsm_health_reader");const filtered=run();expect(filtered.status).not.toBe(0);expect(filtered.stderr).toContain("row-level security");sql("REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM ipsm_health_reader");
 });
 it("compares BIGINT reservations exactly without Number rounding",async()=>{attest();sql(`INSERT INTO public.business_identifier_imports(kind,value,purpose,manifest_sha256,approved_by,transaction_id) VALUES('FAM','FAM-IPSM-2026-9223372036854775806','recovery','${hash}','Synthetic large journal','');`);expect((await check()).status).toBe("PASS");corrupt(tables[3],"UPDATE public.business_identifier_counters SET value=value-1");expect((await check()).reasons).toContain("missing_or_regressed_counters");});
 it("blocks current-year exhaustion",async()=>{attest();corrupt(tables[3],"INSERT INTO public.business_identifier_counters(key,value) VALUES('FAM-IPSM-'||extract(year FROM current_timestamp AT TIME ZONE 'UTC')::int,9223372036854775807)");expect((await check()).reasons).toContain("current_year_exhausted");});
 it("detects unexplained reservations and allocation owner corruption",async()=>{attest();allocate();corrupt(tables[1],"UPDATE public.business_identifier_allocations SET owner_id=gen_random_uuid()");expect((await check()).reasons).toContain("allocation_mismatch");corrupt(tables[1],"DELETE FROM public.business_identifier_allocations");expect((await check()).reasons).toContain("unexplained_ipsm_reservations");});
 it("blocks an IPSM value disguised as a legacy reservation",async()=>{attest();corrupt(tables[4],"INSERT INTO public.issued_business_identifiers(kind,value) VALUES('FAM','FAM-IPSM-2026-000001')");expect((await check()).reasons).toContain("invalid_reservation_metadata");});
 it("database READ ONLY itself rejects attempted DML",async()=>{await expect(proof!.$transaction(async tx=>{await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");await tx.$executeRawUnsafe("INSERT INTO public.audit_logs(id,entity,action) VALUES(gen_random_uuid(),'health','must fail')");})).rejects.toThrow(/read-only/);expect(sql("SELECT count(*) FROM public.audit_logs")).toBe("0");});
});
