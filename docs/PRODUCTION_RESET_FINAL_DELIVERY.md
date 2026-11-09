# Final coordinated delivery — awaiting one release approval

**Objective: all fourteen groups live, with normal registration and numbered
payments operational.** This supersedes the maintenance-only option in the earlier
admission package. No Production mutation, merge, deployment or activation has
occurred in this preparation. PR92 implementation remains unchanged.

## Completed final preparation

- The owner's [business-history declaration](evidence/production-reset-owner-namespace-declaration.json)
  is recorded as a statement in this conversation, without an invented signature
  or claim of independently examining external business documents.
- Fresh read-only Prisma checks through both existing Production profiles confirm
  exact IPSM project, database `postgres`, PG17.6, effective/login `postgres`,
  NOSUPERUSER/BYPASSRLS. Clients cannot assume postgres. This is independent SQL
  verification of the supplied profiles; no new diagnostic endpoint was deployed.
- At 2026-11-09T15:24Z, families/students/payments/receipts and IPSM audit text
  matches are all zero. All 505 audits and three unchanged historical payroll
  exceptions remain. At 15:26Z, all **63 table fingerprints and the schema match
  the verified backup**. No retained database changes or issuance since that
  backup were found. This does not prove future or unrecorded external activity.
- Exact stored SQL arrays match. Supabase CLI2.78.1 `migration list` and read-only
  `db push --dry-run` against the actual target succeed, proposing only:
  `20261107000000_teacher_guard_parity`, `20261107010000_reset_integrity`,
  `20261108000000_ipsm_identifiers`. All three reviewed checksums/mirrors match.
- PR90 and PR92 are draft, mergeable and have green checks on the inspected heads.
  Combining the branches locally is conflict-free. No completed suite or restore
  was repeated. The exported-database recovery gate stays **CLOSED**.
- Vercel has the five DB/Auth variables in Production only, no Preview variables
  and no activation key. Current Production still runs `a6abe1e`. Four legacy
  Production deployment URLs exist; cron is enabled; automatic domain assignment
  is enabled. Firewall status reports disabled, zero custom rules/bypasses and
  zero unpublished changes. These are **observations**, not an active writer hold.

[Sanitized preflight](evidence/production-reset-final-delivery-preflight.json)
contains timestamps, SQL fingerprints, proposed activation ID and the precise
evidence limits. The [recovery manifest](evidence/production-reset-release-recovery-manifest.json)
remains provisional until the owner accepts the scoped recovery boundary and the
final maintenance interval is reconciled.

## Concrete prepared operations — not submitted

Private candidates are in `/tmp/ipsm-final-delivery/`:

- `canonical/`: sealed six-file existing-database workspace; only three future
  deltas pending. No history repair or historical replay.
- `identifier-activation.proposed.sql`: proposed UUID and evidence hashes, expected
  database/server binding, existing trigger-based audit. An unconditional exception
  prevents accidental execution until actual release approval and final drain are
  recorded. Refresh the manifests/hashes after that approval; never treat the
  current provisional recovery hash as a signed certification.
- `vercel-activation.proposed.json`: the same UUID as encrypted
  `IPSM_IDENTIFIER_ACTIVATION_ID`, **Production only**. No existing secret changes.
- `firewall-rules.proposed.json`: one project-scoped all-path deny during
  maintenance, plus a deny for the four obsolete Production deployment hosts to
  retain after reopening. No deployment deletion or new project is proposed.

Vercel [custom deny rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
are the proposed existing-platform ingress barrier. Enable the project's firewall,
stage the exact rules without overwriting unrelated settings, inspect the diff,
and publish using the CLI's required effects digest and project-name confirmation
**only after approval**. Inspect effective precedence/bypass state. Verify blocking
on the production domain and old deployment hosts using harmless requests, not
cron execution or reset actions. This blocks HTTP application and cron entry;
direct database clients/imports additionally require the owner/operator freeze.
If effective blocking cannot be established, stop before any migration.

## Coordinated release order after approval

1. Record the financial-owner/delegate's decision and scoped recovery acceptance.
   Owner/operator stops manual/import/external writers. Install and verify the
   ingress barrier; drain active transactions. Snapshot the original Vercel
   settings and temporarily disable automatic domain assignment so an intermediate
   merge cannot reopen service. No Auth user/status/credential changes.
2. Recheck the exact target, history, checksums, namespace and changes since 15:26Z.
   If anything relevant changed, reconcile it and preserve a current recovery point
   before continuing. The verified restore procedure is not repeated. Confirm
   zero unexplained active writers and no unexpected reset/identifier objects.
3. Apply precisely the three deltas in order. Stop at any failure; each file has
   its own transaction. Inspect six actual migration transcripts, unchanged teacher
   guards, effective client denial, protected audits/Auth links and identifier
   guards. No Production Reset or trial identifier allocation is a postcheck.
4. Record the actual release approval reference, final evidence hashes and binding;
   insert the approved **enabled** attestation, then read-only Query20 must confirm
   its exact current database/server binding and no unreconciled namespace history.
   Set the matching activation UUID in the Production project configuration.
5. Merge PR90 to main with the pinned approved head and a merge commit; retarget
   PR92 to main, verify its feature-only diff is unchanged, then merge PR92. Keep
   all intermediate/automatic builds behind maintenance. Release only the final
   combined code with all fourteen groups; wait for its required checks/build.
6. Verify the candidate's source SHA, inherited Production configuration and exact
   activation selection. Use a controlled operator-only access window to inspect
   the real SUPER_ADMIN page and normal registration/payment forms through an
   authorized existing session. Do not extract Auth tokens from the backup, create
   accounts, issue test receipts or invent live financial transactions. Database
   postchecks verify allocator readiness without allocating a value.
7. Promote the final compatible deployment, verify production routing and database
   binding again, restore the prior domain-assignment setting and remove the
   temporary all-path deny. Retain the old-deployment-host deny so stale writers
   cannot return. Confirm cron targets the new deployment and normal operations
   are available. Never reopen on only six groups or a missing activation binding.

If an activation succeeds but deployment fails, keep the barrier and issuance
closed; do not reuse a pre-activation in-place recovery shortcut. Use the existing
post-activation recovery contract, including a fresh identity/recertification when
required. No fallback may reactivate a writable legacy application.

## One outstanding approval, with explicit acknowledgements

The owner's namespace declaration is received and corroborated. The owner has
**not yet supplied** the financial-history acceptance or final merge/deployment/
activation authorization. Request one decision covering:

- Short maintenance window and stopping all external/manual/import writers.
- Acceptance, as financial owner or authorized delegate, of the **three unchanged
  absent-record payroll audit events**, preserving them without invented postings.
- The documented existing-platform recovery scope and reviewed treatment of
  changes after the verified backup; no full-platform recovery claim.
- The exact three migrations, PR90 then PR92 merges, Production attestation/env
  activation, final combined deployment, and reopening only after successful checks.

Approval does not waive any technical stop condition. Until received: **NO-GO for
execution; ready for coordinated approval**, not another maintenance-only release.
