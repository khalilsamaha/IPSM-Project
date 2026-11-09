import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { allocateBusinessIdentifier, retryIdentifierTransaction } from "@/lib/business-identifiers";
import { createFamilyWithCode } from "@/lib/families";
import { createStudentWithCode } from "@/lib/students";
import { createPaymentWithAllocations } from "@/lib/payments/payment-service";
import { ensurePaymentReceipt } from "@/lib/payments/receipt-repair";
import { previewProductionReset, executeProductionReset, emptyProductionResetSelection, productionResetScopes, RESET_CONFIRMATION } from "@/lib/production-reset";
import { buildReleasePackage, verifyReleasePackage } from "../tools/production-reset/release-package";

const url=process.env.RESET_TEST_DATABASE_URL;
const proof=url ? await createDisposableProductionResetTestClient() : null;
let db:PrismaClient;
const owner="ipsm_rehearsal_owner",activation=randomUUID(),digest="a".repeat(64);
const version="20261108000000_ipsm_identifiers";
const directory=proof ? mkdtempSync(join(tmpdir(),"ipsm-namespace-")) : "";
let protectedAudit:string;
function command(name:string,args:string[],input?:string,environment?:Record<string,string|undefined>){
  if(!proof)throw new Error("Verified disposable fixture required");
  return spawnSync(name,args,{input,env:{...process.env,...environment},encoding:"utf8",timeout:90000,maxBuffer:8*1024*1024});
}
function sql(input:string,target=url!){return command("psql",[target,"-X","-qAt","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"],input);}
function ok(input:string,target=url!){const r=sql(input,target);expect(r.status,r.stderr).toBe(0);return r.stdout.trim();}
const delta=()=>`SET ROLE ${owner};\n`+readFileSync(`supabase/migrations/${version}.sql`,"utf8");
async function certification(client:Prisma.TransactionClient|PrismaClient,id=activation){
  await client.$executeRaw`INSERT INTO public.business_identifier_activations(id,enabled,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES(${id}::uuid,true,${digest},${digest},'Synthetic fixture certification',0,now())`;
}
async function imported(tx:Prisma.TransactionClient,kind:string,value:string,ownerId:string|null,purpose="restoration"){
  await tx.$executeRaw`INSERT INTO public.business_identifier_imports(kind,value,owner_id,purpose,manifest_sha256,approved_by,transaction_id) VALUES(${kind},${value},${ownerId}::uuid,${purpose},${digest},'Synthetic fixture manifest','ignored')`;
}
async function ledgerSnapshot(target=url!){
  return ["issued_business_identifiers","business_identifier_counters","business_identifier_activations","business_identifier_allocations","business_identifier_imports"].map(table=>ok(`SELECT coalesce(md5(string_agg(to_jsonb(i)::text,',' ORDER BY to_jsonb(i)::text)),'empty') FROM public.${table} i`,target)).join(":");
}

// Runs last in run-isolated.sh, after the foundation release/recovery suite.
describe.skipIf(!url)("approved IPSM identifiers on final schema",()=>{
  beforeAll(async()=>{
    await proof!.$disconnect();
    protectedAudit=ok("SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM public.audit_logs a WHERE entity='TeacherPayroll'; SELECT md5(string_agg(to_jsonb(u)::text,',' ORDER BY id)) FROM public.users u; SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.sessions");
    const missingReport=sql(readFileSync("docs/sql/production-reset-dashboard/20_identifier_activation.sql","utf8"));
    expect(missingReport.status).toBe(3);expect(missingReport.stderr).toContain("42P01");
    const failure=sql(delta().replace(/COMMIT;\s*$/,"SELECT 1/0; COMMIT;"));
    expect(failure.status,failure.stderr).toBe(3);expect(failure.stderr).toContain("22012");
    expect(ok("SELECT to_regclass('public.business_identifier_activations') IS NULL")).toBe("t");
    ok(delta());
    const app=new URL(url!);app.username=owner;
    process.env.DATABASE_URL=app.toString();process.env.DIRECT_URL=app.toString();process.env.RESET_TEST_DATABASE_URL=app.toString();
    db=await createDisposableProductionResetTestClient();
  },120000);
  afterAll(async()=>{await db?.$disconnect();vi.unstubAllEnvs();process.env.DATABASE_URL=url;process.env.DIRECT_URL=url;process.env.RESET_TEST_DATABASE_URL=url;});
  it("applies no activation; both application and direct SQL fail closed",async()=>{
    expect(await db.businessIdentifierActivation.count()).toBe(0);
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID","");
    await expect(createFamilyWithCode(db,{name:"Blocked"})).rejects.toThrow("blocked");
    await expect(db.$queryRaw`SELECT public.allocate_ipsm_identifier('FAM',2026,${randomUUID()}::uuid,${activation}::uuid)`).rejects.toThrow("certification");
    await expect(db.$queryRaw`SELECT public.allocate_business_identifier('FAM',2026)`).rejects.toThrow("Legacy allocator disabled");
    await expect(db.family.create({data:{name:"Legacy bypass",familyCode:"FAM-2026-000001"}})).rejects.toThrow("unreserved");
    await expect(db.$transaction(async tx=>{
      await tx.auditLog.create({data:{entity:"Synthetic future-dated overlap",action:"fixture",createdAt:new Date("2099-01-01"),metadata:{code:"STU-IPSM-2026-000001"}}});
      await certification(tx);
    })).rejects.toThrow("Unreconciled historical IPSM namespace");
    await certification(db);vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID",activation);
  });
  it("runs the targeted read-only activation report without exposing IDs or records",()=>{
    const report=JSON.parse(ok(readFileSync("docs/sql/production-reset-dashboard/20_identifier_activation.sql","utf8")));
    expect(report).toMatchObject({completed:true,read_only:"on",counter_type:"bigint",effective_client_table_grants:0,effective_client_function_grants:0,status:"REVIEW_REQUIRED",runtime_identity_verified:false,historical_non_use_certified_by_this_query:false});
    expect(JSON.stringify(report)).not.toContain(activation);
  });
  it("blocks known pre-activation IPSM audit evidence instead of treating empty tables as non-use",async()=>{
    await expect(db.$transaction(async tx=>{
      await tx.auditLog.create({data:{entity:"Synthetic historical overlap",action:"fixture",createdAt:new Date("2000-01-01"),metadata:{code:"FAM-IPSM-2026-000001"}}});
      await certification(tx,randomUUID());
    })).rejects.toThrow("Unreconciled historical IPSM namespace");
    expect(await db.auditLog.count({where:{entity:"Synthetic historical overlap"}})).toBe(0);
  });
  it.each([["PAY",2026],["FAM",1999],["STU",10000],["RCPT",null]] as const)("rejects invalid SQL kind/year %s %s",async(kind,year)=>{
    await expect(db.$queryRaw`SELECT public.allocate_ipsm_identifier(${kind},${year}::integer,${randomUUID()}::uuid,${activation}::uuid)`).rejects.toThrow("Invalid identifier kind or year");
  });
  it("creates family/student/payment/receipt through real application paths in their owning transactions",async()=>{
    const family=await createFamilyWithCode(db,{name:"Namespace family"});
    expect(family.familyCode).toMatch(/^FAM-IPSM-\d{4}-\d{6}$/);
    const student=await createStudentWithCode(db,{family:{connect:{id:family.id}},firstName:"Synthetic",lastName:"Student"});
    expect(student.studentCode).toMatch(/^STU-IPSM-/);
    const result=await db.$transaction(async tx=>{
      const payment=await tx.payment.create({data:{familyId:family.id,paymentMethod:"cash",totalAmountCents:0}});
      const number=await ensurePaymentReceipt(tx,payment.id);return{payment,number};
    });
    expect(result.number).toMatch(/^RCPT-IPSM-/);
    expect(await db.$transaction(tx=>ensurePaymentReceipt(tx,result.payment.id))).toBe(result.number);
    await db.payment.update({where:{id:result.payment.id},data:{voidedAt:new Date()}});
    expect(await db.$transaction(tx=>ensurePaymentReceipt(tx,result.payment.id))).toBe(result.number);
    expect(await db.issuedBusinessIdentifier.findUnique({where:{kind_value:{kind:"RCPT",value:result.number}}})).toMatchObject({ownerId:result.payment.id,namespace:"IPSM",serial:BigInt(1)});
  });
  it("replays a payment request once, rejects changed payloads and never duplicates postings",async()=>{
    const user=await db.userProfile.findFirstOrThrow();
    const family=await createFamilyWithCode(db,{name:"Idempotent payment"});
    const student=await createStudentWithCode(db,{family:{connect:{id:family.id}},firstName:"Payment",lastName:"Fixture"});
    const season=await db.season.create({data:{name:"Synthetic",startDate:new Date("2026-01-01"),endDate:new Date("2026-12-31")}});
    const enrollment=await db.enrollment.create({data:{studentId:student.id,seasonId:season.id,courseName:"Piano",feeCents:1000,finalFeeCents:1000,remainingCents:1000,enrollmentStartDate:season.startDate,enrollmentEndDate:season.endDate}});
    const shift=await db.cashierShift.create({data:{userId:user.id,businessDate:new Date("2026-01-01"),status:"OPEN",openingCashCents:0}});
    const input={requestId:randomUUID(),familyId:family.id,paymentDate:new Date("2026-01-01"),paymentMethod:"cash",notes:null,createdById:user.id,actorId:user.authId,shiftId:shift.id,amountCents:500,allocations:[{enrollmentId:enrollment.id,amountCents:500}]};
    const [first,second]=await Promise.all([createPaymentWithAllocations(db,input),createPaymentWithAllocations(db,input)]);
    expect(second.id).toBe(first.id);expect(second.receiptNumber).toBe(first.receiptNumber);
    expect((await db.enrollment.findUniqueOrThrow({where:{id:enrollment.id}})).paidCents).toBe(500);
    expect(await db.paymentItem.count({where:{paymentId:first.id}})).toBe(1);
    await expect(createPaymentWithAllocations(db,{...input,paymentMethod:"whish"})).rejects.toThrow("different details");
  });
  it("serializes concurrent allocation, supports same-owner replay, and preserves UTC year boundaries",async()=>{
    const ids=Array.from({length:12},()=>randomUUID());
    const codes=await Promise.all(ids.map(id=>retryIdentifierTransaction(()=>db.$transaction(tx=>allocateBusinessIdentifier(tx,"FAM",id,new Date("2096-12-31T23:30:00-02:00"))),20)));
    expect(new Set(codes).size).toBe(12);expect(codes.every(v=>v.startsWith("FAM-IPSM-2097-"))).toBe(true);
    const repeated=await db.$transaction(tx=>allocateBusinessIdentifier(tx,"FAM",ids[0],new Date("2097-02-01")));
    expect(repeated).toBe(codes[0]);
    // A committed but unconsumed reservation cannot later become a new row by replay.
    await expect(db.family.create({data:{id:ids[0],name:"Replay",familyCode:codes[0]}})).rejects.toThrow("Same-transaction");
  });
  it("rolls back allocation and business rows together, never returning a failed transaction result",async()=>{
    const before=await db.businessIdentifierAllocation.count();const id=randomUUID();
    await expect(db.$transaction(async tx=>{await createFamilyWithCode(tx,{id,name:"Rollback"});throw new Error("Injected failure");})).rejects.toThrow("Injected failure");
    expect(await db.family.findUnique({where:{id}})).toBeNull();expect(await db.businessIdentifierAllocation.count()).toBe(before);
  });
  it("rejects invalid certification and invisible activation state without granting RLS access",async()=>{
    await expect(db.$executeRaw`INSERT INTO public.business_identifier_activations(id,enabled,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES(${randomUUID()}::uuid,true,'','', 'Unverified',0,now())`).rejects.toThrow();
    const probe=sql(`BEGIN; GRANT SELECT ON public.business_identifier_activations TO ipsm_fixture_backend; GRANT EXECUTE ON FUNCTION public.allocate_ipsm_identifier(text,integer,uuid,uuid) TO ipsm_fixture_backend; SET LOCAL ROLE ipsm_fixture_backend; SELECT public.allocate_ipsm_identifier('FAM',2026,gen_random_uuid(),'${activation}'); ROLLBACK;`);
    expect(probe.status).toBe(3);expect(probe.stderr).toContain("42501");
  });
  it("enforces immutable reservations, counters, owner IDs and reset history",async()=>{
    const f=await createFamilyWithCode(db,{name:"Immutable"});
    for(const statement of [
      `UPDATE public.issued_business_identifiers SET owner_id=gen_random_uuid() WHERE value='${f.familyCode}'`,
      `DELETE FROM public.issued_business_identifiers`,
      `TRUNCATE public.business_identifier_counters`,
      `UPDATE public.business_identifier_counters SET value=0`,
      `INSERT INTO public.issued_business_identifiers(kind,value) VALUES('FAM','manual')`,
      `UPDATE public.business_identifier_activations SET namespace='OTHER'`,
    ]) await expect(db.$executeRawUnsafe(statement)).rejects.toThrow();
    await expect(db.family.update({where:{id:f.id},data:{id:randomUUID()}})).rejects.toThrow("immutable");
    await db.family.delete({where:{id:f.id}});
    await expect(db.family.create({data:{id:f.id,name:"Unreviewed restore",familyCode:f.familyCode}})).rejects.toThrow("Same-transaction");
    await db.$transaction(async tx=>{await imported(tx,"FAM",f.familyCode,f.id);await tx.family.create({data:{id:f.id,name:"Reviewed restore",familyCode:f.familyCode}});});
  });
  it("requires exact reviewed legacy restoration and locks ownerless reservations against conflicting ownership",async()=>{
    const id=randomUUID(),value="FAM-2019-000044";
    await db.$transaction(tx=>imported(tx,"FAM",value,null,"reservation"));
    await expect(db.family.create({data:{id,name:"Unknown owner",familyCode:value}})).rejects.toThrow("unreserved");
    await db.$transaction(async tx=>{await imported(tx,"FAM",value,id);await tx.family.create({data:{id,name:"Legacy restored",familyCode:value}});});
    await expect(db.$transaction(tx=>imported(tx,"FAM",value,randomUUID()))).rejects.toThrow("ownership conflict");
    await db.family.update({where:{id},data:{name:"Legacy editable",archivedAt:new Date()}});
    await expect(db.family.update({where:{id},data:{familyCode:"FAM-IPSM-2026-999999"}})).rejects.toThrow("immutable");
  });
  it.each(["FAM-IPSM-2095-000000","FAM-IPSM-2095-0000001","FAM-IPSM-2095-9223372036854775808","STU-IPSM-2095-000001","FAM-IPSM-2095-bogus"])("rejects malformed or wrong-kind recovery value %s",async value=>{
    await expect(db.$transaction(tx=>imported(tx,"FAM",value,randomUUID(),"recovery"))).rejects.toThrow();
  });
  it("handles BIGINT values and exhaustion without wrap, rounding or timestamp fallback",async()=>{
    await db.$transaction(tx=>imported(tx,"FAM","FAM-IPSM-2094-9223372036854775806",null,"recovery"));
    const value=await db.$transaction(tx=>allocateBusinessIdentifier(tx,"FAM",randomUUID(),new Date("2094-01-01")));
    expect(value).toBe("FAM-IPSM-2094-9223372036854775807");
    await expect(db.$transaction(tx=>allocateBusinessIdentifier(tx,"FAM",randomUUID(),new Date("2094-01-01")))).rejects.toThrow("exhausted");
    expect((await db.businessIdentifierCounter.findUniqueOrThrow({where:{key:"FAM-IPSM-2094"}})).value).toBe(BigInt("9223372036854775807"));
  });
  it.each(["anon","authenticated","service_role","ipsm_fixture_acl_parent","ipsm_fixture_set_only"])("denies effective infrastructure access to %s",async role=>{
    const v=Number(ok("SHOW server_version_num"));const privileges=["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER",...(v>=170000?["MAINTAIN"]:[])];
    for(const table of ["business_identifier_activations","business_identifier_allocations","business_identifier_imports","issued_business_identifiers","business_identifier_counters"]){
      for(const privilege of privileges)expect(ok(`SELECT has_table_privilege('${role}','public.${table}','${privilege}')`)).toBe("f");
      const probe=sql(`SET ROLE ${role}; SELECT * FROM public.${table}`);expect(probe.status).toBe(3);expect(probe.stderr).toContain("42501");
    }
    expect(ok(`SELECT has_function_privilege('${role}','public.allocate_ipsm_identifier(text,integer,uuid,uuid)','EXECUTE')`)).toBe("f");
  });
  it("rejects conflicting receipt ownership and repairs legacy history without activation",async()=>{
    const family=await createFamilyWithCode(db,{name:"Receipt legacy"});
    const id=randomUUID(),number="RCPT-2018-0005";
    await db.$transaction(async tx=>{await imported(tx,"RCPT",number,id);await tx.payment.create({data:{id,familyId:family.id,paymentMethod:"cash",totalAmountCents:0,receiptNumber:number}});});
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID","");
    expect(await db.$transaction(tx=>ensurePaymentReceipt(tx,id))).toBe(number);
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID",activation);
    const other=await db.payment.create({data:{familyId:family.id,paymentMethod:"cash",totalAmountCents:0}});
    await expect(db.receipt.update({where:{paymentId:id},data:{paymentId:other.id}})).rejects.toThrow("immutable");
  });
  it("keeps a concurrent final-schema allocation atomic when reset locking times out",async()=>{
    const auth=(await db.userProfile.findFirstOrThrow({where:{role:"SUPER_ADMIN"}})).authId;
    const paymentsBefore=await db.payment.count();
    let ready!:()=>void,release!:()=>void;
    const started=new Promise<void>(r=>{ready=r;});const held=new Promise<void>(r=>{release=r;});
    const writer=db.$transaction(async tx=>{await createFamilyWithCode(tx,{name:"Concurrent final-schema writer"});ready();await held;},{timeout:15000});
    await Promise.race([started,writer]);
    try {
      const preview=await previewProductionReset(db,auth,{...emptyProductionResetSelection,financialData:true});
      await expect(executeProductionReset(db,{actorId:auth,requestId:preview.id,confirmation:RESET_CONFIRMATION,reviewed:true,financialAcknowledged:true})).rejects.toMatchObject({code:"P2010",meta:{code:"55P03"}});
      expect(await db.payment.count()).toBe(paymentsBefore);
    } finally {release();await writer;}
    expect(await db.family.count({where:{name:"Concurrent final-schema writer"}})).toBe(1);
  },20000);
  it("requires an explicitly enabled latest attestation and invalidates old activation IDs",async()=>{
    const disabled=randomUUID();
    await db.$executeRaw`INSERT INTO public.business_identifier_activations(id,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES(${disabled}::uuid,${digest},${digest},'Synthetic hold',0,now())`;
    await expect(createFamilyWithCode(db,{name:"Held"})).rejects.toThrow("certification");
    const fresh=randomUUID();
    await db.$transaction(async tx=>{await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/New_York'");await certification(tx,fresh);});
    vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID",fresh);
    await expect(db.$queryRaw`SELECT public.allocate_ipsm_identifier('FAM',2026,${randomUUID()}::uuid,${activation}::uuid)`).rejects.toThrow("certification");
  });
  it("preserves all identifier ledgers across all fourteen scopes and stales previews when reservations change",async()=>{
    const auth=(await db.userProfile.findFirstOrThrow({where:{role:"SUPER_ADMIN"}})).authId;
    const preview=await previewProductionReset(db,auth,{...emptyProductionResetSelection,financialData:true});
    await db.$transaction(tx=>allocateBusinessIdentifier(tx,"FAM",randomUUID()));
    await expect(executeProductionReset(db,{actorId:auth,requestId:preview.id,confirmation:RESET_CONFIRMATION,reviewed:true,financialAcknowledged:true})).rejects.toMatchObject({code:"stale"});
    const before=await ledgerSnapshot();
    for(const key of ["financialData","operationalData","scheduleData","studentsFamilies","teachers","seasons"] as const){
      const p=await previewProductionReset(db,auth,{...emptyProductionResetSelection,[key]:true});expect(p.preview.blocked).toEqual([]);
      await executeProductionReset(db,{actorId:auth,requestId:p.id,confirmation:RESET_CONFIRMATION,reviewed:true,financialAcknowledged:true});
    }
    const all = Object.fromEntries(productionResetScopes.map(key => [key, true])) as typeof emptyProductionResetSelection;
    const combined = await previewProductionReset(db, auth, all);
    expect(combined.preview.blocked).toEqual([]);
    await executeProductionReset(db, { actorId: auth, requestId: combined.id, confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true });
    expect(await ledgerSnapshot()).toBe(before);
    expect(ok("SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) FROM public.audit_logs a WHERE entity='TeacherPayroll'; SELECT md5(string_agg(to_jsonb(u)::text,',' ORDER BY id)) FROM public.users u; SELECT count(*) FROM auth.users; SELECT count(*) FROM auth.sessions")).toBe(protectedAudit);
  });
  it("requires post-backup issuance recovery and a fresh activation before restored issuance",async()=>{
    const packet=join(directory,"package");buildReleasePackage(packet);expect(verifyReleasePackage(packet).migrations).toHaveLength(3);
    const backedUpLedger=await ledgerSnapshot();
    const dump=join(directory,"before-new-issuance.dump");expect(command("pg_dump",["--format=custom","--file",dump,"--dbname",url!]).status).toBe(0);
    const backedUpActivation=process.env.IPSM_IDENTIFIER_ACTIVATION_ID;
    const postBackup=await db.$transaction(tx=>allocateBusinessIdentifier(tx,"STU",randomUUID(),new Date("2093-01-01")));
    const restored=new URL(url!);restored.pathname="/ipsm_identifier_restore";
    expect(command("createdb",["--maintenance-db",url!,"ipsm_identifier_restore"]).status).toBe(0);
    expect(ok("SELECT current_setting('ipsm.disposable_test_token')",restored.toString())).toBe(process.env.IPSM_DISPOSABLE_TEST_TOKEN);
    const result=command("pg_restore",["--exit-on-error","--single-transaction","--dbname",restored.toString(),dump]);expect(result.status,result.stderr).toBe(0);
    expect(await ledgerSnapshot(restored.toString())).toBe(backedUpLedger);
    const blocked=sql(`SET ROLE ${owner}; SELECT public.allocate_ipsm_identifier('STU',2093,gen_random_uuid(),'${backedUpActivation}')`,restored.toString());
    expect(blocked.status).toBe(3);expect(blocked.stderr).toContain("recovery certification");
    // Synthetic external journal is retained outside this backup; no private production history.
    const fresh=randomUUID();ok(`SET ROLE ${owner}; BEGIN;
      INSERT INTO public.business_identifier_imports(kind,value,purpose,manifest_sha256,approved_by,transaction_id) VALUES('STU','${postBackup}','recovery','${digest}','Synthetic external issuance journal','');
      INSERT INTO public.business_identifier_activations(id,enabled,non_use_sha256,recovery_sha256,approved_by,database_oid,server_started_at) VALUES('${fresh}',true,'${digest}','${digest}','Synthetic recovery approval',0,now()); COMMIT;`,restored.toString());
    expect(ok(`SET ROLE ${owner}; SELECT public.allocate_ipsm_identifier('STU',2093,gen_random_uuid(),'${fresh}')`,restored.toString())).toBe("STU-IPSM-2093-000002");
    expect(ok(`SELECT has_table_privilege('service_role','public.business_identifier_activations','SELECT')`,restored.toString())).toBe("f");
    const seedTarget=new URL(restored);seedTarget.username=owner;
    const seedEnv={DATABASE_URL:seedTarget.toString(),DIRECT_URL:seedTarget.toString(),IPSM_IDENTIFIER_ACTIVATION_ID:fresh};
    for(let repeat=0;repeat<2;repeat++){
      const seeded=command("./node_modules/.bin/tsx",["prisma/seed.ts"],undefined,seedEnv);
      expect(seeded.status,seeded.stderr).toBe(0);
    }
    expect(ok("SELECT count(*) FROM public.payments p JOIN public.receipts r ON r.payment_id=p.id WHERE p.receipt_number<>r.receipt_number",restored.toString())).toBe("0");
    expect(ok("SELECT count(*)>0 AND bool_and(family_code ~ '^FAM-IPSM-') FROM public.families",restored.toString())).toBe("t");
    const repeated=sql(delta());expect(repeated.status).toBe(3);expect(repeated.stderr).toContain("42701");
  },120000);
  it("fails closed after a server restart until a fresh recovery attestation is selected",async()=>{
    await db.$disconnect();
    const data=ok("SHOW data_directory");
    expect(data).toMatch(/^\/tmp\/ipsm-reset-tests\.[a-zA-Z0-9]+\/data$/);
    const result=command("pg_ctl",["-D",data,"restart","-m","fast","-w","-l",join(directory,"restart.log")]);expect(result.status,result.stderr).toBe(0);
    db=await createDisposableProductionResetTestClient();
    await expect(createFamilyWithCode(db,{name:"Restart blocked"})).rejects.toThrow("recovery certification");
    const fresh=randomUUID();await certification(db,fresh);vi.stubEnv("IPSM_IDENTIFIER_ACTIVATION_ID",fresh);
    expect((await createFamilyWithCode(db,{name:"Recertified"})).familyCode).toMatch(/^FAM-IPSM-/);
  },120000);
});
