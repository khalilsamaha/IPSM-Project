# PR90 — external release handoff

**2026-11-08; reviewed code baseline `5765740`; NO-GO; PR remains draft.**
This follow-up does not repeat the completed local tests, browser investigation or
Preview cleanup. It creates no resources, deployments, grants, activations or
production database changes. Existing-database provenance-scope approval is complete.

## Current access results

| Gate | Fresh observation | Minimum action needed |
| --- | --- | --- |
| Hosted staging | Exact-IPSM connector project/branch calls denied. Authorized CLI branch listing returns no records. No independently authorized hosted staging reference is supplied in the available evidence. This does not prove no standalone staging project exists. | Supply the exact dedicated IPSM staging project/branch reference and ownership/purpose authorization; or approve a concrete provisioning quote. Do not substitute an unrelated project. |
| Preview configuration | CLI metadata lists no Preview variables for `prj_LMoZdJAsGS2EJleZ2Zfis5VYgHnJ`. Connector metadata access returns 404; the existing CLI is the working path. | Populate only verified staging values using the mapping below after resource verification. No change to Production values/targets. |
| Actual SQL identities | Exact-target read-only connector query denied; no existing runtime-configured private connection is available to this agent. | Administrator uses the actual deployed Prisma connection and intended migration connection; returns role names/context only. SQL Editor/local postgres is not a substitute. |
| Production recovery | Exact-target CLI reports zero listed backups, no physical-backup metadata, PITR false and WAL-G true. No recovery point or restorable artifact is verified. | Supply a supported recovery point/artifact and an authorized private isolated restore target. Resolve any provisioning cost first. |
| Fresh target history/pending list | Read-only history query denied. Earlier administrator evidence remains valid as a snapshot, not a fresh target check. | Refresh Query16 and exact workspace pending list using an authorized private connection; reject any drift. |
| Business/financial evidence | Namespace non-use and payroll acceptance remain unsigned. | Complete the two [private sign-off records](PRODUCTION_RESET_EXTERNAL_SIGNOFFS.md), with evidence or an explicit inability to certify. |

Only `rakzehtbpzseetldbohm` was addressed for production metadata/SQL. No unrelated
project was queried. No credentials, environment values or authentication records
were retrieved. Do not repair access by exporting secrets, making a diagnostic
endpoint/deployment or changing production credentials.

## Preview-only configuration ready for operator completion

Scope: Vercel project `prj_LMoZdJAsGS2EJleZ2Zfis5VYgHnJ`, team
`team_evfbYf1gRSSV7wJj7ZELLDzL`, **Preview only**. Preserve the existing Production
entries. All source values must come from the same independently authorized staging
project, whose reference must differ from `rakzehtbpzseetldbohm`.

| Variable | Required source / verification |
| --- | --- |
| DATABASE_URL | Staging Prisma runtime connection; privately verify target, TLS and effective/login roles. |
| DIRECT_URL | Staging direct/session tooling connection; privately verify its target and intended owner role. |
| NEXT_PUBLIC_SUPABASE_URL | Staging Auth/API endpoint, not Production Auth or an alias pointing to it. |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | That staging project's client key; never copy the Production value. |
| SUPABASE_SERVICE_ROLE_KEY | That staging project's server key; server-only, never logged or exposed to browser code. |
| IPSM_IDENTIFIER_ACTIVATION_ID | Leave absent until that independently empty synthetic staging namespace/recovery evidence is validated. Select only its own attestation; never Production's. |

Record project/branch reference, PG17 version, owner, Auth project identity and
configuration operator/time privately. Check branch-specific overrides as well as
Preview defaults. Keep signup policy, redirect URLs, mail sink and external jobs
isolated; do not reuse production Auth sessions/users. New synthetic Auth users
must be independently created. No values or screenshots belong in Git or this report.

Once these prerequisites pass, deploy only a normal authorized Preview of PR90,
verify its actual runtime identity privately and run hosted synthetic Auth,
registration, Cash/Whish payment/receipt, scheduling and payroll workflows. Keep
Production Reset unavailable in Preview; do not spoof Production or rerun destructive
reset tests on hosted data. Hosted end-to-end results remain **NOT RUN — staging
unavailable**, not failed application tests or a reason to repeat the local suite.

## Production role and history evidence

In each already-authorized private connection, use the existing read-only
identity check from the [release runbook](PRODUCTION_RESET_RELEASE_RUNBOOK.md#actual-runtime-identities-and-isolation).
Record effective/login role, context (actual Production Prisma or chosen migration
connection), exact project reference, deployed revision/configuration provenance,
server version, UTC observation and operator. A generic database name `postgres`
is not target identity. Then use Query10 with the verified role names for effective
permissions/memberships; do not grant anything to make a check pass.

Refresh only [Query16](sql/production-reset-dashboard/16_migration_provenance.sql),
not the already reconciled teacher reports. Expected existing versions/counts are
`20260731171613`/0, `20260801163840`/1, `20260801165129`/1, with exact arrays/MD5s
in the [provenance worksheet](evidence/production-reset-migration-provenance.json).
The empty transcript's original bootstrap purpose remains unknown and accepted
within the existing-database-only boundary; no historical replay or repair.

Use CLI2.78.1 and the verified [canonical workspace](PRODUCTION_RESET_CANONICAL_WORKSPACE.md)
for private read-only `migration list` and `db push --dry-run`. It must report only:

1. `20261107000000_teacher_guard_parity`
2. `20261107010000_reset_integrity`
3. `20261108000000_ipsm_identifiers`

Verify the reviewed SQL SHA-256s separately: CLI version matching alone does not
verify content. Missing, extra, changed or partially installed migrations stop the
release. A denied/timed-out/incomplete query is a blocker, not an empty success.
Do not use a linked login flow that creates temporary roles or run an actual push.

## Production backup: select a supported path, then prove recovery

The preferred platform path, if eligible, is Supabase **Restore to a New Project**
from an actual listed recovery point. It creates a separately billed database copy
including Auth data, while API/Auth settings and Storage objects need separate
handling. Obtain the displayed cost approval before starting; no quote or eligibility
has been established here. [Supabase restore-to-new-project procedure](https://supabase.com/docs/guides/platform/clone-project).

That recovery copy is **not** the synthetic Preview staging database. Keep it
private, disconnected from Vercel and application clients; arrange containment of
copied jobs/webhooks before they can cause external effects. Preserve copied Auth
and audit records; do not log in as real users or delete them for testing. If safe
containment cannot be guaranteed, stop and obtain a supported isolated procedure.

If platform cloning is unavailable, the DBA can propose the documented CLI logical
export/restore route using existing private access and a compatible initialized
isolated target. It requires explicit managed-schema/Auth/role/extension coverage.
The generic guide's password-reset and `session_replication_role=replica` steps are
**not authorized here**. Do not disable integrity checks or transplant the local
container replication/HBA recipe into hosted Production. A schema-only dump is not
a production recovery proof. [Supabase CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

Return a private backup record containing: source project and UTC recovery point;
method, provider backup ID or encrypted-artifact SHA-256 and custody; explicit
coverage/gaps for application data, Auth, roles, migration ledger, identifier
reservations, Storage and platform settings; approved restore-target identity;
restore result; integrity/ownership/ACL/RLS/constraint/guard comparisons; and any
post-backup issuance requiring recovery. Supply aggregates/hashes, not records or
credentials. The prior local physical proof does not certify this production
backup. No in-place Production restore, migration or issuance activation is part
of this handoff. [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups).
