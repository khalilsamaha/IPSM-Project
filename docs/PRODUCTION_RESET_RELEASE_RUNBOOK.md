# PR90 — consolidated release preparation and runbook

**NO-GO for production. Draft PR90 only.** This is a prepared procedure, not
permission to perform it. No production SQL mutation, grant, environment change,
reset, merge or deployment has been performed. All destructive tests use a fresh,
runner-owned local database; auth rows in the rehearsal are synthetic stand-ins.

## Current identifier delta and activation hold

The business-selected unversioned IPSM format is implemented. Read
[the identifier enforcement/recovery design](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md)
and [exact isolated staging procedure](PRODUCTION_RESET_STAGING_SETUP.md). The ordered
package now has **three** deltas; the third creates no activation. Certify non-use
and complete recovery before any separate environment/configuration activation.
A restart/failover or fresh restored database invalidates the selected attestation;
recertification is required before new issuance. Unsupported in-place logical
restoration into the same running database must not reuse a deployment binding.

## Completed gates and scope

- Baseline/branch verified against fetched origin: main `a6abe1e`, PR branch
  `4f39913` at the start of this work. Existing local `supabase/.temp/` untouched.
- 25 application tables; all 45 reviewed FKs and 22 exact accepted update variants.
- Teacher body equivalence and Query02's 545-item/16-observation reconciliation.
- **Query18 closed:** administrator reports PG17.6, 14/14 MATCH, no blockers at
  `2026-11-08T06:28:58.231143+00:00`.
- **Query19 closed for metadata/candidate permissions:** four REVIEW_REQUIRED
  items, no blockers at `2026-11-08T06:32:02.008971+00:00`; all three functions,
  triggers, owner/config/attributes match. Functions/tables owned by postgres;
  candidate postgres roles can execute; existing guard grants postgres/service_role,
  anon/authenticated effective EXECUTE false. This is not runtime identity proof.
- New-object ACL restrictions and fail-closed invoker state guard remain unchanged.
  The rehearsal adds successful execution under a non-superuser owner role,
  accepted live FK actions, actual guard bytes/ACL shape and creator defaults.
- Offline future-delta packaging, mid-migration rollback, duplicate rejection,
  all six reset scopes, lock timeout/stale preview, known historical reservations,
  before/after backup restoration and protected-record fingerprints are tested.

No repeat of Queries18/19 or body reconstruction is requested. Raw 18/19 reports
were not independently queried; closure is based on the administrator's explicit
results in [the evidence summary](evidence/production-reset-final-admin-summary.json).
Refresh only relevant evidence after intervening changes before an authorized release.

## Actual runtime identities and isolation

Repository architecture: `lib/prisma.ts` instantiates the shared Prisma client;
`prisma/schema.prisma` selects DATABASE_URL for runtime and DIRECT_URL for Prisma
schema tooling. Supabase Auth uses the Supabase client configuration, not Prisma's
SQL role. A Supabase service_role API key is not proof of the Prisma role.

Current metadata-only Vercel CLI inspection (known IPSM project/team; no --json,
pull, decrypt or environment values) confirms these five shared entries:
DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY — each targets **Production and Preview**. The explicit
PR-branch Preview filter returns no overrides. This establishes unsafe shared
configuration, not independently observed deployed connection identities. Vercel's
connector returned 404; the local linked CLI metadata path succeeded. No database
connection was opened through Vercel and no secret value was retrieved.

There is no already-authorized runtime SQL session exposed here. The smallest
remaining administrator procedure is to use existing secure clients bound to
(a) the actual deployed Prisma runtime configuration and (b) the intended migration
connection. In each, run only:

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT current_user AS effective_role, session_user AS login_role;
ROLLBACK;
```

Record project/deployment/context and the two role names only, plus who verified
that connection context. SQL Editor's already-known postgres result is not a
substitute. Do not retrieve environment values, paste connection strings, create
an endpoint, deploy or change configuration merely to discover identity. If no
existing runtime-context client is available, keep this pending.

The intended migration role should be the verified existing owner postgres,
subject to administrator confirmation of the chosen connection. Existing parity
assertions require that exact owner relationship. The proposed infrastructure
retains owner access only. If the actual backend is different, stop and review its
specific required privileges/membership/RLS model separately; do not grant broad
client/service_role access or weaken invoker guards. A synthetic non-superuser
owner proves that superuser/BYPASSRLS is not inherently required, not that an
unverified production role has the right entitlements.

Required target architecture (configuration changes need separate authorization):

| Environment | Database / Auth / allowed validation |
| --- | --- |
| Production | IPSM production PostgreSQL + production Auth; verified runtime/migration identities. No reset executed as a smoke test. |
| Preview / staging | Separate non-production database **and separate Auth**, separate keys, synthetic users/data only; isolated storage/cron/email/payment side effects. Verify project/database identity from safe metadata and authorized sessions before mutation tests. |
| Local automated tests | Fresh PG17 cluster, random server marker, explicit loopback URL/port/database; no ambient URLs or production Auth. |

The existing reset gate stays fail closed for Preview/Development/local. Staging
application flows can test normal operations after isolation; reset executor tests
remain in the verified disposable factory, never by setting VERCEL_ENV=production
on an ordinary local client. Shared Preview currently blocks mutation testing for
**all** application features, not only Production Reset. No environment changes
are made in this work. [Vercel environment scopes](https://vercel.com/docs/environment-variables).

## Provenance and package outcome

[Provenance worksheet](evidence/production-reset-migration-provenance.json): 298
reachable commits at the research baseline were searched for migration paths.
None supplies files named by `20260731171613`, `20260801163840`, `20260801165129`.
Candidate repository SQL lineage/hashes are recorded, not assigned to live versions
by date or matching function text. The private SQL snippet is one byte; the only
IPSM archive found holds the already-reviewed schema reports, not original history.
The targeted Supabase read-only history query was denied; no other project was used.

Query16 administrator evidence (2026-11-08T15:44:55.544114+00:00) now maps counts to actual versions: 20260731171613=0 (MD5 d41d8cd98f00b204e9800998ecf8427e), 20260801163840=1 (MD5 d34257683e5172ad7b1ede576a4b2591; availability/schedule mentions), 20260801165129=1 (MD5 6c4135265819300dd72a0fbc476f80c2; enrollment mention). This is statement metadata, not original SQL provenance. The
worksheet leaves each count/hash/attributable object **unknown**. No Prisma ledger
is invented. Supabase is the single future migration mechanism; Prisma is limited
to schema/client generation and byte-identical mirror checks.

The offline builder has no database/deployment dependency:

```bash
./node_modules/.bin/tsx tools/production-reset/release-package.ts /tmp/ipsm-pr90-review-package
```

Use a new output directory. It emits only the three genuine reviewed **future** SQL
files in `future-delta/`, ordered parity, integrity, then IPSM identifiers, plus SHA-256 manifest and
an explicit `REHEARSAL_ONLY_PRODUCTION_BLOCKED` status. It refuses mirror drift,
changed/reordered/extra SQL and overwriting a package. It is intentionally **not**
a `supabase/migrations` deployment workspace and contains no fabricated old SQL.
The two foundation migration pairs remain unchanged; the third pair is additive. The rehearsal applies this
exact checked bundle and rejects reapplication of the integrity migration.

Supported next provenance step for an authorized administrator: retain the
mapped Query16 evidence and privately recover actual recorded SQL/deployment files.
Supabase's documented `migration fetch` retrieves history files; `migration list`
compares version timestamps. Use fetch only in an isolated release workspace with
an existing authorized connection, review its SQL privately for sensitive literals,
and preserve exact source bytes/hash. A genuine empty statement array is an
**incomplete recorded transcript**, not a recovered original migration; never
handwrite a fictitious no-op or claim it explains the schema. If an authentic
transcript cannot yield a truthful, reviewed pending list, packaging remains blocked
until the DBA/vendor approves an explicit existing-database history reconciliation.
Do not run `migration repair` or accept a `db pull` prompt to modify production
history under this task. [Supabase history commands](https://supabase.com/docs/reference/cli/supabase-migration-list).

After authentic history is reconciled, the release workspace must show exactly
the three reviewed future versions pending, and none of the historical repository tree. Review hashes and tool
version; apply only once through the canonical mechanism. Do not replay both mirrors.
No CLI production pending-list certification is claimed in the absence of authentic
history/connection access. Package order/checksums and repeat rejection are proved
in the isolated rehearsal; production CLI packaging remains pending.

## Reproducible isolated rehearsal

Prerequisites: existing installed dependencies; matching PG17 initdb/pg_ctl/psql/
createdb/pg_dump/pg_restore. No dependency upgrade or production connection needed.

```bash
npm run prisma:generate
npm run typecheck
npm test
PG_BIN=/usr/lib/postgresql/17/bin npm run test:migration
DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/ipsm_unavailable \
DIRECT_URL=postgresql://fixture:fixture@127.0.0.1:1/ipsm_unavailable \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=isolated-build-placeholder \
SUPABASE_SERVICE_ROLE_KEY=isolated-build-placeholder npm run build
```

For local build, keep DATABASE_URL/DIRECT_URL and Supabase URLs explicitly pointed
at unavailable loopback fixtures; do not load production credentials. The existing
runner overrides ambient database URLs, initializes a fresh cluster, verifies its
random marker and stops only its own cluster. The release test runs last, rebuilds
only that disposable public schema, and creates two fresh restore databases in the
same cluster. Never repoint it to an existing database or change its identity checks.

Reconstruction uses the repository baseline/SQL-only supplements and historical
DDL as **schema construction inputs**, not a claim those migrations ran live. It
installs reviewed live guard variants and explicit FK variants, then models the
reported guard ACL and broad creator defaults. Synthetic owner is LOGIN,
NOSUPERUSER, NOBYPASSRLS. The approved delta runs as that owner; normal backend and
reset calls use a separately verified client for that role. Unknown production
roles, elevated RPCs, extra extensions and unrecorded objects remain outside this
synthetic model. Other mandatory suites retain broader inherited-role tests.

Recovery verification uses custom-format pg_dump and pg_restore --exit-on-error
--single-transaction. Pre/post restores compare all synthetic table data plus
columns/defaults, constraints, indexes, enum definitions, guard definitions,
expanded sorted ACLs, owners, RLS flags and policies. Physical OIDs/xmins are
excluded across restores; exact OIDs/xmins **are** checked across parity execution.
Initial comparison failures were traced to ACL ordering and tied public.users /
auth.users sort order; deterministic metadata comparison fixed the test without
excluding privilege differences. Expected failure SQLSTATEs are asserted, including
22012 injected division-by-zero, 42P07 repeated migration and 55P03 lock timeout.

Restore tests use separate databases within the owned cluster, with role objects
already present. pg_dump does not back up cluster-global roles, external Auth
services, secrets, storage or documents. The synthetic auth tables prove only that
reset does not touch those fixture relations, not operational Supabase Auth recovery.
Production needs its separately tested platform/role/storage backup procedure.
[PostgreSQL dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[restore](https://www.postgresql.org/docs/17/app-pgrestore.html) documentation.

The 2,000-row preview/2,001-row deletion and 5s lock-timeout tests are a modest
regression workload, **not** production capacity/SLA certification. See recorded
[rehearsal metrics](evidence/production-reset-release-rehearsal.json) for local timings; rehearse realistic approved volume and writer load
before selecting a production maintenance window.

## Future production procedure — separate approval required

| Stage | Operator requirement / stop condition |
| --- | --- |
| Admission | Close runtime identities, historical namespace non-use/recovery certification, authentic history/pending list, Preview/Auth isolation and financial sign-off. Obtain explicit migration and application deployment authorization. CI alone cannot admit release. |
| Freeze | Stop relevant application writes, registration/payment/payroll jobs and cron activity; account for shared previews and external imports. Do not modify user accounts as a maintenance mechanism. Prohibit concurrent schema/function DDL. |
| Backup | Record recovery point, verified DB/platform/role/storage coverage and checksums. Restore to an authorized isolated target and verify integrity/ACLs before proceeding. Keep an independent issuance record after the backup point; retain it through recovery. |
| Recheck | Compare only changed evidence since the approved snapshot; verify current schema, roles/memberships, blockers and approved identifiers. Confirm exactly reviewed pending files/hashes. Unknown drift or timeouts stop the release. |
| Migrate | Apply the approved canonical future delta once, in reviewed order, with bounded lock/statement limits sized from staging. Each file has its own transaction; failure of the second does not roll back an already committed first. Keep writes paused on any error. No constraint/trigger disabling or ad hoc cleanup. |
| Postcheck | Read-only confirmation of actual migration records, unchanged guard bodies/ACLs/owners, required unique/FK constraints, protected users/audits, ledger high-water/reservations and effective client denial. Validate the real backend role's normal writes only under the separately approved smoke-test policy. Never execute Production Reset as a smoke test. |
| Deploy | Release the compatible application only after DB checks, then re-enable approved writers/jobs gradually. No automatic merge/deploy is part of PR90 preparation. |
| Recover | Before compatible application release, rollback the failed file transaction; inspect which earlier file actually committed. Prefer a reviewed forward correction with writes paused. Do not rerun blindly or invent applied-history records. |
| Restore decision | If full restore is required, obtain approval for the exact recovery point and data loss; recover all required platform components. Reconcile every identifier delivered after that point before reopening writes. Never simply decrement counters, delete audits or run destructive down SQL. Validate permissions and role ownership on the recovered database. |

## Smallest outstanding decision/evidence set

1. **DBA/deployment owner:** actual runtime and chosen migration connection role
   names/context, relevant membership/ownership confirmation; mapped Query16 evidence
   (already supplied) and authentic recorded/deployment SQL. Resolve truthful canonical
   packaging, not historic-schema attribution by guesswork.
2. **Business/financial owner:** the `IPSM` display format is selected; certify
   historical non-use or complete reservations, approve operational delivery/recovery
   constraints, and review the full implementation/test contract in
   [identifier decision](PRODUCTION_RESET_IDENTIFIER_DECISION.md); acknowledge the
   three preserved payroll audit events using the form below. Identifier engineering is implemented; no production activation is implied.
3. **Deployment/release owner:** authorize and establish separate Preview database/
   Auth, attest actual identities without secrets, perform representative staging
   and platform backup/restore, then explicitly authorize any production release.

No further broad schema report or Query18/19 rerun is requested. If these inputs
are deferred, keep draft/NO-GO; independently executable repository preparation is
complete and the next changes are precisely scoped by those decisions.

## Financial-owner acknowledgement (pending, not signed)

> I acknowledge the administrator's finding of three historical payroll audit events
> referencing absent records, with zero current payroll and payroll-expense rows at
> the observed snapshot. Available evidence cannot establish why the records were
> removed or reconstruct their postings. The release preserves all three audit
> events and does not invent expense links, transactions or balances. This acceptance
> concerns the documented historical limitation, not authorization for deletion or
> a statement that the missing postings were legitimate.
>
> Owner/name: ______  Date: ______  Evidence reference: ______
> Accept documented limitation / request further historical investigation: ______

No engineering test or administrator summary substitutes for this sign-off.
