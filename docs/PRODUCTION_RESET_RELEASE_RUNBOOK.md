# PR90 — consolidated release preparation and runbook

> Current operational evidence (2026-11-08): the owner has accepted the
> existing-database-only provenance scope and supplied conditional migration
> authority. Five shared Vercel variables now target Production only; all 28
> approved old Preview snapshots have been removed. Real local Supabase Auth/browser, scoped
> logical recovery and full physical PostgreSQL recovery have passed. Production roles, recoverable platform backup,
> hosted isolation and business certifications remain pending. See the
> [operational rehearsal](PRODUCTION_RESET_OPERATIONAL_REHEARSAL.md), including
> the removed unintended diagnostic deployment and production-backup evidence limit.
> Earlier access/authorization statements below describe their historical stage.

**NO-GO for production. Draft PR90 only.** This is a prepared procedure, not
evidence that release safeguards passed. Conditional migration authority is supplied.
No IPSM production SQL mutation, grant, environment change, reset, merge or application
deployment occurred. The separate diagnostic deployment incident is documented.
Destructive tests use owned local data; the latest rehearsal also uses real local
Supabase Auth with synthetic accounts.

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

Initial metadata-only Vercel CLI inspection (known IPSM project/team; no --json,
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

Required target architecture (Preview-only configuration changes are authorized; Production changes remain conditional):

| Environment | Database / Auth / allowed validation |
| --- | --- |
| Production | IPSM production PostgreSQL + production Auth; verified runtime/migration identities. No reset executed as a smoke test. |
| Preview / staging | Separate non-production database **and separate Auth**, separate keys, synthetic users/data only; isolated storage/cron/email/payment side effects. Verify project/database identity from safe metadata and authorized sessions before mutation tests. |
| Local automated tests | Fresh PG17 cluster, random server marker, explicit loopback URL/port/database; no ambient URLs or production Auth. |

The existing reset gate stays fail closed for Preview/Development/local. Staging
application flows can test normal operations after isolation; reset executor tests
remain in the verified disposable factory, never by setting VERCEL_ENV=production
on an ordinary local client. All 28 old Preview snapshots have been removed after explicit owner approval.
Preview targeting has been removed; Production values and three deployments remain
unchanged. Hosted mutation tests await isolated database/Auth configuration. [Vercel environment scopes](https://vercel.com/docs/environment-variables).

## Provenance and package outcome

[Provenance worksheet](evidence/production-reset-migration-provenance.json): 298
reachable commits at the research baseline were searched for migration paths.
None supplies files named by `20260731171613`, `20260801163840`, `20260801165129`.
Candidate repository SQL lineage/hashes are recorded, not assigned to live versions
by date or matching function text. The private SQL snippet is one byte; the only
IPSM archive found holds the already-reviewed schema reports, not original history.
The targeted Supabase read-only history query was denied; no other project was used.

Query16 administrator evidence (2026-11-08T15:44:55.544114+00:00) maps counts to actual versions: 20260731171613=0 (MD5 d41d8cd98f00b204e9800998ecf8427e), 20260801163840=1 (MD5 d34257683e5172ad7b1ede576a4b2591; availability/schedule mentions), 20260801165129=1 (MD5 6c4135265819300dd72a0fbc476f80c2; enrollment mention). The administrator later supplied both nonempty stored SQL bodies. Each recorded MD5 is reproduced from the repository teacher-consistency/enrollment SQL after removing only the documented explanatory comment blocks and terminal LF (teacher), or terminal LF only (enrollment). This proves source-text fingerprint compatibility, **not** the original bootstrap or full DDL history. The
worksheet records known counts/hashes without attributing unproven bootstrap execution. No Prisma ledger
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

The [canonical workspace procedure](PRODUCTION_RESET_CANONICAL_WORKSPACE.md) now
packages the actual recorded arrays plus the three future deltas. CLI2.78.1 exports
the empty array as `;\n`; this is an authentic transcript representation, not a
substitute bootstrap or claim that empty SQL was historically executed. Original
history names and the empty entry's purpose remain unknown. Descriptive local
filenames do not change or invent ledger metadata.

Build a separate workspace with:

```bash
node --import tsx tools/production-reset/canonical-workspace.ts /tmp/ipsm-pr90-canonical-review
```

Never use the repository's complete Supabase migration tree as the release directory.
An existing-database incremental release can preserve the empty record without
replaying history. The owner has accepted the explicit incomplete-bootstrap boundary for this existing
database. No invented bootstrap or history repair is needed. Before
any conditionally authorized production migration, verify the fresh target history,
file checksums and exact three-version CLI pending list with the reviewed tool.
Do not repair, relabel or replay historical entries. Current production pending
state has not been queried by this work; all CLI application tests are disposable.

## Reproducible isolated rehearsal

Prerequisites: existing installed dependencies; matching PG17 initdb/pg_ctl/psql/
createdb/pg_dump/pg_restore; Supabase CLI2.78.1 for the explicit canonical-workspace
rehearsal. No dependency upgrade or production connection needed.

```bash
npm run prisma:generate
npm run typecheck
npm test
PG_BIN=/usr/lib/postgresql/17/bin IPSM_TEST_SUPABASE_CLI=1 npm run test:migration
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

## Conditional production procedure — safeguards must pass

| Stage | Operator requirement / stop condition |
| --- | --- |
| Admission | Close runtime identities, historical namespace non-use/recovery certification, authentic history/pending list, Preview/Auth isolation and financial sign-off. Conditional migration authority is supplied. Application deployment remains separately controlled. CI alone cannot admit release. |
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
   names/context and relevant membership/ownership confirmation. Refresh actual target
   history/pending state before release. The owner has accepted the tested existing-database-only
   workspace boundary; no repeat scope approval is needed.
   The recorded SQL and empty-array serialization no longer require investigation.
2. **Business/financial owner:** the `IPSM` display format is selected; certify
   historical non-use or complete reservations, approve operational delivery/recovery
   constraints, and review the full implementation/test contract in
   [identifier decision](PRODUCTION_RESET_IDENTIFIER_DECISION.md); acknowledge the
   three preserved payroll audit events using the form below. Identifier engineering is implemented; no production activation is implied.
3. **Deployment/release owner:** establish hosted isolated database/
   Auth, attest actual identities without secrets and demonstrate platform recovery.
   Conditional migration authority is supplied; application deployment is separate.

No further broad schema report or Query18/19 rerun is requested. If these inputs
are deferred, keep draft/NO-GO; independently executable repository preparation is
complete and the next changes are precisely scoped by those decisions.

## Financial-owner acknowledgement (pending, not signed)

The canonical unsigned form is now [record B](PRODUCTION_RESET_EXTERNAL_SIGNOFFS.md#b-financial-owner-acknowledgement-of-historical-payroll-audit-orphans).
Record A separately covers historical namespace non-use and recovery certification.
Neither record has been signed; no engineering test substitutes for either decision.
See the [external handoff](PRODUCTION_RESET_EXTERNAL_HANDOFF.md) for the exact remaining
resource, private-connection, fresh-history and production-backup evidence.
