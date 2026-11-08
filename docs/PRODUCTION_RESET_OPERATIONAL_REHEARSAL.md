# PR90 — authorized operational rehearsal, 2026-11-08

**Production NO-GO; draft PR90 remains open.** The owner's expanded authorization
accepts the existing-database-only provenance boundary and conditionally permits
three production deltas after all safeguards pass. It does not certify those
safeguards. No production SQL mutation, migration, reset, identifier activation,
application deployment or merge was performed on IPSM.

## Access and actual changes

- Target remains `rakzehtbpzseetldbohm`. Targeted Supabase connector project/SQL
  calls were denied. There is no newly verified production runtime or migration
  SQL identity. SQL Editor `postgres` and local staging `postgres` are distinct
  evidence contexts. Secret Vercel variables were not exported.
- Supabase CLI2.78.1 read-only backup metadata returned `backups: []`, empty
  physical-backup metadata, PITR false and WAL-G true. This does **not** prove no
  external backup exists; it supplies no recoverable platform backup for this
  release. Branch listing returned no branch records. No unrelated project was
  queried or reused and no billable resource was created.
- In Vercel project `prj_LMoZdJAsGS2EJleZ2Zfis5VYgHnJ`, Preview targeting was
  removed from DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. Postchecks show
  all five still present as **Production-only** Secrets, with no Preview entries
  or PR-branch overrides. Production values were neither read nor changed.
- This contains **future** Preview configuration only. The 28 existing Preview
  deployment snapshots can retain their original environment. Their removal was
  proposed explicitly because it permanently removes review URLs; it remains
  pending. No claim of complete Preview isolation is made. A subsequent push may
  create another Preview snapshot, which must use the now-empty Preview scope.

## Diagnostic command incident and cleanup

A Vercel65.11.0 `env run` attempt intended to execute a read-only role probe
unexpectedly created a separate project/deployment instead of running the probe.
The CLI reported that the five Secrets could not be pulled. The unintended
`ipsm-runtime-role` project and deployment `dpl_BRAPymgCF5BtFKopKWBvjc5MQQjt`
were immediately removed. The existing IPSM project and its Production deployment
set were checked and left intact. The temporary diagnostic contained no embedded
credentials; no production SQL connection was established. This incident must not
be described as “no deployments occurred.” Do not use `vercel env run` for role
verification; use an already-authorized private database connection instead.

## Real local Supabase/browser rehearsal

This is **local staging**, not a hosted Vercel Preview or a production clone.
Supabase CLI2.78.1 started PostgreSQL17.6, Auth, PostgREST, Kong and a local mail
sink in the dedicated `ipsm-pr90-synthetic` stack. Database/API/mail ports were
bound to `127.0.0.1` through a dedicated Docker network. Auth had no host port.
Storage, external mail, Realtime, analytics and edge functions were excluded.
No other local Supabase stack was used. The initial Auth population was zero and
application tables were absent; an independently generated marker bound all
mutating scripts to this owned fixture.

Schema construction used the existing baseline/bootstrap fixture plus repository
teacher guards as synthetic inputs, not a claim of historical production execution.
The copied three-row recorded ledger was unchanged by native CLI dry-run/push.
Only the three reviewed deltas applied, in order; a second push applied nothing.
The synthetic namespace certificate was created only after proving this new local
fixture empty. It is not evidence or authorization for production issuance.

Actual local runtime/migration `current_user` and `session_user` were `postgres`:
NOSUPERUSER, BYPASSRLS. Four synthetic Auth users were paired with application
profiles. The email provider was enabled while public signup stayed disabled;
initially disabling both had correctly prevented email login. Chromium150 with
a temporary Playwright-core1.65.0 installation exercised the real Next application.
Browser requests were restricted to the loopback app/API. No repository dependency
versions were changed.

| Executed workflow | Observed result |
| --- | --- |
| SUPER_ADMIN login | Real Auth session, authenticated dashboard. |
| Open cashier shift | UI created the synthetic shift with opening cash. |
| Full registration | UI created one family/student/enrollment, initial Cash payment, one recurring pattern and four lessons. FAM/STU/RCPT-IPSM codes and outstanding balance verified in PostgreSQL. |
| Follow-up Whish payment | UI posted 500 cents; allocation sum matched; durable receipt existed. |
| Receipt download | Authenticated endpoint returned HTTP200, application/pdf and a valid PDF header. |
| Attendance | UI finalized the four generated lessons. |
| Payroll | UI drafted, approved and paid 13,000 cents; exactly one linked expense and shift reference; reload did not create a duplicate posting. |
| Reset access | Local SUPER_ADMIN received “unavailable”; ADMIN/RECEPTION denied; inactive/unauthenticated redirected to login. No environment spoofing or UI reset execution. |
| Effective new-table ACLs | Zero allowed privileges across 3 client roles × 8 infrastructure tables × 8 PG17 privileges (192 checks), including BYPASSRLS service_role. |

The six reset execution scopes, overlapping/dependent selections, closed shifts,
concurrency, stale previews, rollback, exact teacher preservation, immutable
reservations and protected records remain covered by the separate owned PG17
runner. Those are executor integration tests, not claims of hosted UI reset tests.
No application defect requiring a business-logic or migration change was found.
Prisma generation, TypeScript, 436 unit tests, 207 PG17 tests (including seven
real-CLI checks), migration/redaction fixtures and the production build passed.
The 40 Dashboard cases run before and after migration. The build retains its
existing nonfatal ESLint compatibility warning; no lint fix or dependency upgrade
was hidden in this operational follow-up. Hosted results are verified on the
published commit and recorded in PR90, separately from these local results.

## Recovery results and limits

A custom-format logical backup of `public`, `auth`, `supabase_migrations` and the
fixture-marker schema restored atomically into a new database in the owned stack.
**17 table fingerprints matched**, including application users/audits, four Auth
users, five Auth sessions, payments/receipts, payroll/expenses and identifier/history
records. The old activation failed against the restored database. A synthetic
post-backup reservation retained outside the dump was recovered using the reviewed
import path; fresh synthetic certification allocated a strictly higher code.

Two failed recovery attempts are material:

1. Ordinary `postgres` cannot transfer Auth schema ownership to `supabase_admin`.
   The scoped successful restore used the local platform owner, without adding grants.
2. A full platform dump did not reconstruct the extension-owned
   `graphql_public.graphql` wrapper before its ACL was restored. The transaction
   failed and rolled back. No ACL/extension check was disabled. The successful
   **scoped** restore is not a full Supabase platform recovery certificate.

The synthetic dump and private Auth material remain outside Git, mode0600.
The local app and only the named synthetic stack were stopped after testing;
local volumes were retained. Restart invalidates its old issuance certificate.
[Sanitized evidence](evidence/production-reset-operational-rehearsal.json) records
results and checksum, not credentials, account records or financial payloads.
Production requires its own supported backup, platform ownership/extension/Auth
coverage and demonstrated isolated restoration. Empty metadata cannot satisfy it.

## Remaining external work

1. An authorized DBA must provide actual runtime/migration role names and connection
   context, fresh target history/pending checks, current content/Auth-dependency
   inventory and a recoverable production backup with a platform-supported restore.
   No original SQL-body comparison, teacher report or provenance-scope approval is
   requested again. The scope is accepted; bootstrap purpose remains unknown.
2. Retire or effectively contain the old Preview snapshots, then supply an explicitly
   approved IPSM staging database/Auth resource and its private configuration access.
   No branch was available through current metadata; no cost authorization is assumed.
   Future Preview variables already exclude Production. Hosted end-to-end and actual
   deployment identity checks remain pending; local results do not replace them.
3. Business/DBA owners must substantiate IPSM historical non-use, including external,
   manual and deleted history, and recovery completeness before activation. No new
   trusted history was available. RCPT14/STU5 are still lower bounds; FAM is unknown.
   Keep Production IPSM_IDENTIFIER_ACTIVATION_ID absent and issuance held.
4. Financial owner acknowledgement of the three retained absent-record payroll audit
   events remains pending. Preserve all three; do not invent transactions or links.

Production migration authority is conditional and already supplied. Deployment,
merge, production reset and identifier activation remain separately controlled.
Even after a schema-only migration, the old allocator will reject new issuance;
maintain the write hold until the compatible application release and independently
certified activation are separately authorized. Do not migrate merely because CI
is green or current business tables were previously reported empty.
