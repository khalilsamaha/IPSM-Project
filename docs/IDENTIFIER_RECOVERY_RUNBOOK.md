# Identifier health and administrator-controlled recovery

Production is live at `c5de2a062db5f38e15f09aeb51cc1b5d9af2075d`, with all fourteen
reset groups. [Completed release evidence](https://github.com/khalilsamaha/IPSM-Project/blob/b73fd1666d6f2c9e87e3a5781325ff247dec346c/docs/PRODUCTION_RESET_FINAL_DELIVERY.md)
records the applied migrations, owner approvals, verified recovery scope and initial
activation. This runbook **does not authorize or perform a new activation**. No new
backup is requested. It maintains the [existing recovery contract](PRODUCTION_RESET_IDENTIFIER_IMPLEMENTATION.md).

## Routine read-only check

From the repository, with installed dependencies/generated Prisma client and the
existing private credential environment (do not copy a connection URL into commands):

```bash
node --env-file=.env.local --import tsx tools/production-reset/identifier-health.ts \
  --activation-id UUID_SELECTED_BY_CURRENT_PRODUCTION_DEPLOYMENT
```

Replace only the UUID using the actual deployed Production selection verified by
an authorized administrator in Vercel. It is a binding identifier, not a password.
Do not substitute the last release's UUID without checking it is still selected.
The command reads `IPSM_IDENTIFIER_HEALTH_DATABASE_URL`, or the existing
`IPSM_PRODUCTION_DATABASE_URL` profile; it never falls back to generic `DATABASE_URL`.
If credentials are already injected securely, omit `--env-file`. Do not edit an
application environment file for monitoring. Node22+ supports this invocation.
Only the exact IPSM direct endpoint or its project-qualified Supavisor profile,
TLS, and database `postgres` are accepted. It does not fetch or modify Vercel settings.

The query uses one REPEATABLE READ / READ ONLY transaction, a 10-second statement
limit and 2-second lock limit. `row_security=off` makes filtered reads **error**, not
bypass RLS. It acquires ordinary read locks only, calls no allocator, and changes
no tables, counters, attestations or configuration. Errors return a generic reason
rather than driver text. Results contain only identity/binding metadata, booleans
and aggregate counts; no codes, owners, personal records or audit payloads.

| Result / exit | Meaning and operator action |
| --- | --- |
| PASS / 0 | Supplied selection is the exact latest **enabled** attestation, bound to this database/postmaster; checked database invariants hold. Retain this timestamped summary. |
| REVIEW REQUIRED / 1 | Excess/unrecognized counters or ordinary connections defaulting read-only need explanation. Do not adjust counters or use this result to approve reactivation. |
| BLOCKED / 2 | Binding/selection/hold mismatch, missing attestation, standby, exhaustion, ledger/ownership regression, incomplete snapshot, missing tables, permission error, timeout or connection failure. Alert the administrator and investigate; never infer health from missing output. |

The latest attestation overall is checked: a newer disabled hold must not be ignored
in favor of an older enabled row. BIGINT counter comparisons never round through
JavaScript Number. Retained allocations without surviving business records are
valid after reset/deletion; unknown owners of legacy reservations remain unknown.

**Limits:** PASS is a point-in-time database result, not approval, proof of complete
external issuance history, or independent verification of the UUID supplied by the
operator. A coherently restored older ledger can look internally healthy; a logical
restore retaining database OID and postmaster lifetime can evade binding detection.
Platform event/restore evidence and independently documented issuance must therefore
be reviewed separately. Never use PASS alone to certify restoration completeness.

## On invalidation: hold, classify, reconcile

1. Record the alert, last successful summary, current binding/selection and platform
   restart/failover/restore event. Do not log secrets or private business payloads.
   New identifier allocation already fails closed; some reads, receipt reprints and
   other operations can still work. Do not retry with a legacy allocator or another ID.
2. An authorized incident owner establishes a verified maintenance/writer barrier
   covering application, cron, imports and external clients; drain in-flight work.
   Coordinate security/default changes explicitly, and retain obsolete-deployment
   protections. The health command does not install or remove a hold.
3. Classify using actual platform/event and retained-history evidence:

   | Event | Required review |
   | --- | --- |
   | Confirmed ordinary restart, no restore/replacement or lost commits | Verify data continuity, current reservations/allocations/imports, counters and ownership. Reconcile independently documented recent issuance. No imports are needed when continuity is established; prepare new recovery evidence for the changed server lifetime. |
   | Failover with uncertain continuity, restore, changed database identity, or unknown event | Treat as recovery from a recovery point. Identify the actual point and every independently documented issuance afterward. An unchanged row count or an internally consistent ledger is insufficient. |

4. For restoration, stop writers and withdraw the old selected binding under separate
   authorization **before** restoring. The post-activation contract requires a fresh
   database or server instance; the earlier accepted **pre-activation** in-place
   recovery scope is not authorization to reuse an active binding across a logical
   restore. Keep the existing managed-platform/backup coverage limitations explicit.
5. Compare schema/security, immutable reservations, allocation/import/attestation
   lineage, counters and business ownership with available trusted evidence. Every
   proven post-recovery-point IPSM value must remain reserved. Use the existing
   administrator `recovery` import path with exact canonical values, proven ownership
   where available, manifest SHA-256 and approver; it advances high-water marks.
   A reservation alone does not reconstruct a family, payment or financial posting.
   Restoring a business record requires an exact-owner `restoration` grant in the
   same transaction. Never guess an owner, decrement a counter, pick a larger floor,
   erase a conflict or rewrite issuance/activation history. Preserve the three
   acknowledged historical payroll audit events and all subsequent audit history.
6. If journals/documents are incomplete, counters/owners conflict, or original
   attestation lineage cannot be recovered truthfully, retain the hold. Record the
   precise missing evidence; a new hash or owner approval cannot manufacture it.

## Separately approved replacement and reopening

The administrator records: incident/event, old/new binding, selected/deployed IDs,
recovery point or proven restart continuity, reviewed manifest hashes, reconciled
issuance/ownership, remaining exceptions, approver identity/reference and maintenance
scope. Obtain explicit approval **for this recovery**, not automatic reuse of the
initial release approval. The original non-use declaration applies to its historical
cutoff; do not falsely declare the IPSM namespace has never been used after go-live.
Reference its unchanged reviewed bytes where still applicable and create an accurate
new recovery manifest. Preserve historical evidence.

Only after that review and approval:

1. Prepare the existing [modifying attestation template](sql/identifier-activation-review-template.sql)
   as a separate execution artifact. Recheck the exact project, role, writers and
   binding; choose a new UUID and reviewed hashes, record the actual approver and
   explicitly choose enabled=true. Never edit an old attestation. The trigger binds
   and audits the replacement; do not disable guards to make it succeed.
2. Verify the new record/current binding and run the health command with its ID.
   A newer disabled attestation is an intentional hold; do not select an older one.
3. Under the same approved window update only Vercel **Production**
   `IPSM_IDENTIFIER_ACTIVATION_ID`, then build/deploy compatible code. Vercel variable
   changes do not update existing deployments. Verify the exact candidate and its
   selected ID; no diagnostic endpoint, Auth impersonation or secret disclosure.
4. Repeat the read-only health check against the actual runtime connection and
   current deployed selection. Check authentication, normal registration/payment
   pages and an authorized non-destructive preview. No Production Reset, dummy
   registration, test receipt or financial posting is required or authorized here.
5. Reopen only after the administrator signs off on complete recovery evidence,
   PASS, candidate checks and compatible domain/cron routing. Restore approved
   original connection defaults/maintenance settings, keep obsolete deployments
   blocked, and watch the next genuine business issuance without inventing one.

## Monitoring and alerts — proposal, not installed

Use an existing authorized **private** scheduler/monitor every 1–5 minutes and after
platform restart/failover/restore notices or approved deployments. Inject the
existing connection securely and obtain the selected activation from authoritative
current Production configuration; do not pin a forgotten release UUID. No new role,
grant, endpoint, cron job, paid service or alert destination is created by this work.

Bound the scheduler process as well (for example, a 25-second external timeout).
Alert immediately on exit2, missing/invalid JSON, timeout or no successful sample
within two expected intervals. Route exit1 for administrator review. Include only
status/reason codes, check timestamp, database OID/server start and the incident
reference; keep access restricted. Compare successive binding metadata even when
someone has subsequently created a valid replacement. Deduplicate repeated alerts,
retain the incident until human closure, and alert if monitoring itself fails.
Never run the attestation template, modify Vercel, allocate a probe identifier or
clear the incident automatically after a restart. The monitor has no reauthorization
or repair path. A new PASS does not replace administrator recovery sign-off.

## Validation of this maintenance change

TypeScript, 25 focused unit/identifier tests and 20 isolated PostgreSQL17 tests
passed. At 2026-11-09 18:22:50 UTC the read-only Production check returned PASS,
using the independently read Production activation selection and unchanged deployed
candidate. No backup, allocation, attestation, grant, environment change, deployment
or reset was performed. Historical evidence and migration SQL remain unchanged.
