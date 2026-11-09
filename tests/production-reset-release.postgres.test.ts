import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createDisposableProductionResetTestClient } from "@/lib/production-reset-test-client";
import { executeProductionReset, previewProductionReset, emptyProductionResetSelection, productionResetScopes, RESET_CONFIRMATION } from "@/lib/production-reset";
import { allocateBusinessIdentifier } from "./helpers/legacy-identifiers";
import { buildReleasePackage, verifyReleasePackage, releaseVersions } from "../tools/production-reset/release-package";
import { guardInstallSql } from "./helpers/teacher-guard-bodies";

const originalUrl = process.env.RESET_TEST_DATABASE_URL;
// Verification occurs BEFORE any psql/DDL/dump tool is allowed to run.
const proof = originalUrl ? await createDisposableProductionResetTestClient() : null;
const owner = "ipsm_rehearsal_owner";
let db: PrismaClient;
let work: string;
let packet: string;
let guardsBefore: string;
let preSnapshot: string;
let protectedBefore: string;
let authId: string;
const metrics: Record<string, number | string | boolean> = {};
function command(binary: string, args: string[], input?: string) {
  if (!proof) throw new Error("Verified disposable runner required");
  return spawnSync(binary, args, { input, encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
}
function sql(input: string, url = originalUrl!) {
  return command("psql", [url,"-X","-qAt","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"], input);
}
function ok(input: string, url = originalUrl!) {
  const r = sql(input,url); expect(r.status,r.stderr).toBe(0); return r.stdout.trim();
}
const file = (name: string) => readFileSync(name,"utf8");
function migration(index: number) {
  verifyReleasePackage(packet);
  return `SET ROLE ${owner};\n` + file(join(packet,"future-delta",`${releaseVersions[index]}.sql`));
}
function protectedRecords() {
  return ok("SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM public.users t; SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM auth.users t; SELECT md5(string_agg(to_jsonb(t)::text,',' ORDER BY id)) FROM auth.sessions t;");
}
function guards() {
  return ok(`SELECT md5(string_agg(to_jsonb(p)::text || p.xmin::text,',' ORDER BY p.proname)) FROM pg_proc p WHERE proname IN ('validate_enrollment_teacher_availability','validate_schedule_teacher_availability','validate_teacher_availability_scope');
   SELECT md5(string_agg(to_jsonb(t)::text || t.xmin::text,',' ORDER BY t.tgname)) FROM pg_trigger t WHERE tgname IN ('enrollment_teacher_availability_guard','schedule_teacher_availability_guard','teacher_availability_scope_guard');`);
}
// Logical dump comparison deliberately excludes physical OIDs/xmins which change on restore.
function snapshot(url = originalUrl!) {
  const tables = ok("SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY 1",url).split("\n");
  const data = tables.map(table => {
    if (!/^(public|auth)\.[a-z_]+$/.test(table)) throw new Error("Unreviewed fixture relation");
    return `${table}:${ok(`SELECT count(*)||':'||coalesce(md5(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text)),'empty') FROM ${table} t`,url)}`;
  });
  const schema = ok(`SELECT md5(string_agg(pg_get_functiondef(p.oid)||pg_get_userbyid(p.proowner)||coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)::text FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),''),',' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
    SELECT md5(string_agg(pg_get_triggerdef(t.oid,true)||t.tgenabled::text,',' ORDER BY c.relname,t.tgname)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal;
    SELECT md5(string_agg(n.nspname||'.'||c.relname||coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)::text FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),'')||pg_get_userbyid(c.relowner)||c.relrowsecurity::text||c.relforcerowsecurity::text,',' ORDER BY n.nspname,c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind='r';
    SELECT md5(string_agg(c.relname||co.conname||pg_get_constraintdef(co.oid)||co.convalidated::text,',' ORDER BY c.relname,co.conname)) FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';
    SELECT md5(string_agg(indexname||indexdef,',' ORDER BY indexname)) FROM pg_indexes WHERE schemaname='public';
    SELECT md5(string_agg(n.nspname||c.relname||a.attname||format_type(a.atttypid,a.atttypmod)||a.attnotnull::text||a.attidentity::text||a.attgenerated::text||coalesce(pg_get_expr(d.adbin,d.adrelid),''),',' ORDER BY n.nspname,c.relname,a.attnum)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname IN ('public','auth') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped;
    SELECT md5(string_agg(t.typname||pg_get_userbyid(t.typowner)||e.enumlabel,',' ORDER BY t.typname,e.enumsortorder)) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public';
    SELECT coalesce(md5(string_agg(c.relname||p.polname||p.polcmd::text||p.polpermissive::text||p.polroles::text||coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),',' ORDER BY c.relname,p.polname)),'no-policies') FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth');`,url);
  const aclMetadata=ok(`SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),'[]'::jsonb)) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND c.relkind='r'`,url);
  writeFileSync(join(work,`acl-${new URL(url).pathname.slice(1)}.json`),aclMetadata);
  const summary = {data, schema: schema.split("\n")};
  writeFileSync(join(work, `snapshot-${new URL(url).pathname.slice(1)}.json`),JSON.stringify(summary,null,2));
  return createHash("sha256").update(JSON.stringify(summary)).digest("hex");
}
function backup(name: string) {
  const start=Date.now(); const path=join(work,`${name}.dump`);
  const r=command("pg_dump",["--format=custom","--file",path,"--dbname",originalUrl!]);
  expect(r.status,r.stderr).toBe(0); metrics[`${name}_dump_ms`]=Date.now()-start;
  return path;
}
function restore(path: string, name: string) {
  if (!/^ipsm_rehearsal_restore_(before|after)$/.test(name)) throw new Error("Unapproved restore target");
  const url = new URL(originalUrl!); url.pathname=`/${name}`;
  let r=command("createdb",["--maintenance-db",originalUrl!,name]); expect(r.status,r.stderr).toBe(0);
  expect(ok("SELECT current_setting('ipsm.disposable_test_token')",url.toString())).toBe(process.env.IPSM_DISPOSABLE_TEST_TOKEN);
  const start=Date.now(); r=command("pg_restore",["--exit-on-error","--single-transaction","--dbname",url.toString(),path]);
  expect(r.status,r.stderr).toBe(0); metrics[`${name}_ms`]=Date.now()-start;
  return url.toString();
}
async function reset(key: keyof typeof emptyProductionResetSelection) {
  const preview=await previewProductionReset(db,authId,{...emptyProductionResetSelection,[key]:true});
  expect(preview.preview.blocked).toEqual([]);
  return executeProductionReset(db,{actorId:authId,requestId:preview.id,confirmation:RESET_CONFIRMATION,reviewed:true,financialAcknowledged:true});
}

describe.skipIf(!originalUrl)("synthetic current-schema release and recovery rehearsal",()=>{
  beforeAll(async()=>{
    await proof!.$disconnect();
    work=mkdtempSync(join(tmpdir(),"ipsm-release-rehearsal-")); packet=join(work,"review-package");
    buildReleasePackage(packet);
    // Rebuild ONLY the owned runner DB after its previous suites. This is a schema
    // reconstruction, not a claim that these historical files ran in production.
    ok("DROP SCHEMA public CASCADE; CREATE SCHEMA public;" + file("tests/migrations/reset-baseline.sql") + file("tests/migrations/reset-bootstrap.sql")
      + file("supabase/migrations/20260801101500_teacher_consistency.sql")
      + file("prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql") + guardInstallSql("live"));
    const evidence=JSON.parse(file("docs/evidence/production-reset-2026-11-07.json"));
    for(const fk of evidence.foreign_keys.filter((f: {update_action:string})=>f.update_action==='a')) {
      const quote=(s:string)=>{if(!/^[a-z_]+$/.test(s))throw new Error("Unsafe evidence identifier");return `"${s}"`;};
      const child=fk.child.split('.')[1]; const parent=fk.parent.split('.')[1];
      const deletes: Record<string,string>={c:"CASCADE",n:"SET NULL",r:"RESTRICT",a:"NO ACTION"};
      ok(`ALTER TABLE public.${quote(child)} DROP CONSTRAINT ${quote(fk.constraint_name)};
        ALTER TABLE public.${quote(child)} ADD CONSTRAINT ${quote(fk.constraint_name)} FOREIGN KEY (${fk.child_columns.map(quote).join(',')}) REFERENCES public.${quote(parent)}(${fk.parent_columns.map(quote).join(',')}) ON UPDATE NO ACTION ON DELETE ${deletes[fk.delete_action]};`);
    }
    ok(`CREATE ROLE ${owner} LOGIN NOSUPERUSER NOBYPASSRLS;
      ALTER SCHEMA public OWNER TO ${owner};
      DO $$ DECLARE r record; BEGIN
       FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO ${owner}',r.tablename); END LOOP;
       FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' LOOP EXECUTE format('ALTER TYPE public.%I OWNER TO ${owner}',r.typname); END LOOP;
       FOR r IN SELECT p.oid::regprocedure::text AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO ${owner}',r.signature);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,ipsm_fixture_acl_parent',r.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
       END LOOP;
      END $$;
      ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
      ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,fixture_only boolean NOT NULL DEFAULT true);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id));`);
    authId=randomUUID(); const userId=randomUUID();
    ok(`INSERT INTO auth.users(id) VALUES('${authId}'); INSERT INTO auth.sessions VALUES('${randomUUID()}','${authId}');
      INSERT INTO public.users(id,auth_id,name,email,role,updated_at) VALUES('${userId}','${authId}','Synthetic owner','owner@example.invalid','SUPER_ADMIN',now());
      INSERT INTO public.audit_logs(id,entity,action,entity_id,metadata) SELECT gen_random_uuid(),'TeacherPayroll','mark_paid',gen_random_uuid(),'{}'::jsonb FROM generate_series(1,3);
      INSERT INTO public.audit_logs(id,entity,action,metadata) VALUES(gen_random_uuid(),'SyntheticIdentifierHistory','fixture','{"receipt":"RCPT-2097-000050","student":"STU-2097-000040","family":"FAM-2097-000030"}');`);
    guardsBefore=guards(); protectedBefore=protectedRecords(); preSnapshot=snapshot();
    backup("before");
    metrics.postgresql=ok("SHOW server_version"); metrics.synthetic_only=true;
  },120_000);
  afterAll(async()=>{
    await db?.$disconnect();
    process.env.DATABASE_URL=originalUrl; process.env.DIRECT_URL=originalUrl; process.env.RESET_TEST_DATABASE_URL=originalUrl;
    if(work) writeFileSync(join(work,"metrics.json"),JSON.stringify(metrics,null,2)+"\n");
    if(work) console.log(`Synthetic rehearsal artifacts: ${work}`);
  });
  it("restores the pre-release backup with identical data, constraints, guards and ACLs",()=>{
    const restored=restore(join(work,"before.dump"),"ipsm_rehearsal_restore_before");
    expect(snapshot(restored)).toBe(preSnapshot);
  },120_000);
  it("validates/preserves existing live-variant teacher guards under a non-superuser owner",()=>{
    ok(migration(0)); expect(guards()).toBe(guardsBefore); expect(snapshot()).toBe(preSnapshot);
  });
  it("rolls back an injected failure after all integrity DDL and grants, without undoing prior migration history",()=>{
    const before=snapshot();
    const failed=sql(migration(1).replace(/COMMIT;\s*$/,"SELECT 1/0; COMMIT;"));
    expect(failed.status).toBe(3); expect(failed.stderr).toContain("22012");
    expect(ok("SELECT to_regclass('public.production_reset_state') IS NULL")).toBe("t");
    expect(snapshot()).toBe(before);
  });
  it("applies only the verified future delta, denies all eight client grants and preserves historical audits",async()=>{
    ok(migration(1)); expect(guards()).toBe(guardsBefore);
    const appUrl=new URL(originalUrl!); appUrl.username=owner;
    process.env.DATABASE_URL=appUrl.toString(); process.env.DIRECT_URL=appUrl.toString(); process.env.RESET_TEST_DATABASE_URL=appUrl.toString();
    db=await createDisposableProductionResetTestClient();
    const report=JSON.parse(ok(file("docs/sql/production-reset-dashboard/17_reset_client_permissions.sql")));
    const tableRights=report.items.filter((i:{section:string;details:{role:string}})=>i.section==='effective_table_permissions'&&['anon','authenticated','service_role'].includes(i.details.role));
    expect(tableRights).toHaveLength(15);
    const supportsMaintain = Number(ok("SHOW server_version_num")) >= 170000;
    for (const item of tableRights) {
      for (const privilege of ['select','insert','update','delete','truncate','references','trigger']) {
        expect(item.details[privilege]).toBe(false);
      }
      expect(item.details.maintain).toBe(supportsMaintain ? false : null);
    }
    expect(await db.auditLog.count({where:{entity:'TeacherPayroll'}})).toBe(3);
    expect(await allocateBusinessIdentifier(db,'RCPT',new Date('2097-01-01'))).toBe('RCPT-2097-000051');
    expect(await allocateBusinessIdentifier(db,'STU',new Date('2097-01-01'))).toBe('STU-2097-000041');
    expect(await allocateBusinessIdentifier(db,'FAM',new Date('2097-01-01'))).toBe('FAM-2097-000031');
  });
  it("rejects duplicate application without changing committed data or schema",()=>{
    const before=snapshot(); const repeat=sql(migration(1));
    expect(repeat.status).toBe(3); expect(repeat.stderr).toContain("42P07"); expect(snapshot()).toBe(before);
  });
  it("executes all six independent scopes on synthetic records while retaining users, auth and historical audits",async()=>{
    const family=await db.family.create({data:{familyCode:'FAM-2098-000001',name:'Fixture'}});
    const student=await db.student.create({data:{familyId:family.id,studentCode:'STU-2098-000001',firstName:'Fixture',lastName:'Student'}});
    const season=await db.season.create({data:{name:'Rehearsal',startDate:new Date('2098-01-01'),endDate:new Date('2098-12-31')}});
    const teacher=await db.teacher.create({data:{fullName:'Fixture'}});
    await db.enrollment.create({data:{studentId:student.id,seasonId:season.id,courseName:'Piano',enrollmentStartDate:season.startDate,enrollmentEndDate:season.endDate,registrationSubmissionId:randomUUID()}});
    await reset('operationalData'); expect(await db.enrollment.count()).toBe(0);
    await db.expense.create({data:{category:'Synthetic',description:'Rehearsal',amountCents:100,paymentMethod:'whish'}});
    await reset('financialData'); expect(await db.expense.count()).toBe(0);
    await db.scheduleSession.create({data:{studentId:student.id,teacherId:teacher.id,sessionDate:season.startDate,startTime:'09:00',endTime:'09:30',title:'Fixture'}});
    await reset('scheduleData'); expect(await db.scheduleSession.count()).toBe(0);
    await reset('studentsFamilies'); expect(await db.family.count()).toBe(0); expect(await db.student.count()).toBe(0);
    await reset('teachers'); expect(await db.teacher.count()).toBe(0);
    await reset('seasons'); expect(await db.season.count()).toBe(0);
    expect(await db.userProfile.count()).toBe(1); expect(await db.auditLog.count({where:{entity:'TeacherPayroll'}})).toBe(3);
    expect(protectedRecords()).toBe(protectedBefore);
    expect(await db.resetRegistrationSubmission.count()).toBe(1);
    await expect(db.family.create({data:{familyCode:'FAM-2098-000001',name:'Unrelated replacement'}})).rejects.toThrow();
  },60_000);
  it("protects synthetic Auth and historical audits with all fourteen groups selected", async () => {
    await db.course.create({ data: { name: 'All-scope course', archivedAt: new Date() } });
    await db.operationalSettings.create({ data: { id: 'school-default', attendanceFinalizeGraceMinutes: 0 } });
    const selection = Object.fromEntries(productionResetScopes.map(key => [key, true])) as typeof emptyProductionResetSelection;
    const p = await previewProductionReset(db, authId, selection);
    expect(p.preview.blocked).toEqual([]);
    const result = await executeProductionReset(db, { actorId: authId, requestId: p.id, confirmation: RESET_CONFIRMATION, reviewed: true, financialAcknowledged: true });
    expect(result.deleted.course).toBe(1);
    expect(result.updated.operationalSettings).toBe(1);
    expect(protectedRecords()).toBe(protectedBefore);
    expect(await db.auditLog.count({ where: { entity: 'TeacherPayroll' } })).toBe(3);
  });
  it("measures a 2000-row preview, detects changes and rolls back when a writer holds the reset lock",async()=>{
    await db.family.createMany({data:Array.from({length:2000},(_,i)=>({familyCode:`FAM-2099-${String(i+1).padStart(6,'0')}`,name:'Synthetic load'}))});
    const start=Date.now(); const stale=await previewProductionReset(db,authId,{...emptyProductionResetSelection,studentsFamilies:true});
    metrics.preview_2000_rows_ms=Date.now()-start;
    await db.family.create({data:{familyCode:'FAM-2099-009999',name:'Changed after preview'}});
    const execute=(id:string)=>executeProductionReset(db,{actorId:authId,requestId:id,confirmation:RESET_CONFIRMATION,reviewed:true,financialAcknowledged:true});
    await expect(execute(stale.id)).rejects.toMatchObject({code:'stale'});
    const current=await previewProductionReset(db,authId,{...emptyProductionResetSelection,studentsFamilies:true});
    let ready!:()=>void; const holding=new Promise<void>(r=>{ready=r;}); let release!:()=>void; const wait=new Promise<void>(r=>{release=r;});
    const writer=db.$transaction(async tx=>{await tx.$executeRawUnsafe('LOCK TABLE public.families IN ROW EXCLUSIVE MODE');ready();await wait;},{timeout:15000});
    await holding;
    try { await expect(execute(current.id)).rejects.toMatchObject({code:'P2010',meta:{code:'55P03'}}); } finally {release(); await writer;}
    expect(await db.family.count()).toBe(2001);
    expect((await db.productionResetRequest.findUniqueOrThrow({where:{id:current.id}})).consumedAt).toBeNull();
    const deletion=Date.now(); await reset('studentsFamilies'); metrics.delete_2001_rows_ms=Date.now()-deletion;
    expect(await db.family.count()).toBe(0);
  },30_000);
  it("restores a post-release backup including counters/tombstones/permissions and rejects historical reuse",()=>{
    const before=snapshot(); const dump=backup('after'); const target=restore(dump,'ipsm_rehearsal_restore_after');
    expect(snapshot(target)).toBe(before);
    expect(ok(`SET ROLE ${owner}; SELECT public.allocate_business_identifier('FAM',2099)`,target)).toBe('FAM-2099-010000');
    const rejected=sql(`SET ROLE ${owner}; INSERT INTO public.families(id,family_code,name,updated_at) VALUES(gen_random_uuid(),'FAM-2098-000001','Fixture collision',now())`,target);
    expect(rejected.status).toBe(3); expect(rejected.stderr).toContain('Business identifier was already issued');
    metrics.restore_integrity_verified=true;
  },120_000);
});
