# Production delivery completed — 2026-11-09

**All fourteen Production Reset groups are live. Public access is restored.**

- Site: https://ipsm-project-gamma.vercel.app
- SUPER_ADMIN workspace: https://ipsm-project-gamma.vercel.app/settings/production-reset
- Deployed commit: `c5de2a062db5f38e15f09aeb51cc1b5d9af2075d`
- Deployment: `dpl_A8DF84GqQ9m49EGP2xkLgrnLvbvh`
- PR90 merged first (`639055c988c2a252fa24a74b37f4fa0d4977f2c4`); PR92 was
  retargeted to main, its accepted diff verified unchanged, then merged.

[Sanitized completed-release evidence](evidence/production-reset-production-delivery-20261109.json)
records each stage, exact SQL fingerprints, timestamps, checks and limits. This
supersedes pending/NO-GO statuses in earlier historical readiness reports.

## Completed sequence

1. The owner explicitly approved maintenance, the three migrations, activation,
   merges/deployment and reopening after validation. The owner also accepted the
   three historical payroll-audit limitations and scoped existing-platform recovery.
2. Verified the real direct endpoint over IPv6/TLS: PG17.6, effective/login postgres,
   correct database/server binding, controlled write-capable migration session,
   one-minute statement and five-second lock timeout. Ordinary postgres writers
   remained read-only; public/legacy HTTP traffic and cron were held.
3. Rechecked the original three exact historical SQL arrays, reviewed pending SQL
   hashes/mirrors and the unchanged verified backup interval: all 63 table hashes
   and the original schema matched. No recovery rehearsal was repeated.
4. Supabase CLI2.78.1 applied only the reviewed three deltas in order:
   `20261107000000_teacher_guard_parity`, `20261107010000_reset_integrity`,
   `20261108000000_ipsm_identifiers`. The original history is unchanged and all
   recorded future statement bytes reproduce the reviewed source order. No history
   repair, historical migration rewrite or additional DDL was introduced.
5. Postchecks passed: all 62 original data tables unchanged, exact teacher bodies
   preserved, 46 valid FKs, valid indexes/constraints, eight RLS-protected reset
   tables with no client-role privileges, 25 generation guards and 16 retained
   legacy identifiers. Client denial includes memberships, column privileges and
   PostgreSQL17 MAINTAIN; service_role receives no bypass entitlement.
6. Finalized the owner's [namespace declaration/corroboration](evidence/production-reset-namespace-certification-20261109.json)
   and [accepted recovery evidence](evidence/production-reset-activation-recovery-20261109.json).
   The enabled attestation matches the verified database/server lifetime and the
   Production-only Vercel activation ID. All five existing DB/Auth variables were
   unchanged. Activation added one audit; it allocated no identifier.
7. Both approved PRs merged; the combined Production candidate built successfully.
   Hosted [main CI passed](https://github.com/khalilsamaha/IPSM-Project/actions/runs/42666828264):
   Prisma generation, TypeScript, 454 unit tests, 273 PostgreSQL test executions
   (233 distinct cases, including 40 Dashboard cases run before and after),
   migration/security fixtures and production build. Actual logs were inspected.
   Seven optional real-CLI cases are not claimed as part of this hosted run.
8. In the Vercel-authenticated candidate window, the owner confirmed SUPER_ADMIN
   access, all fourteen options and registration/payment page loading. The initial
   Rooms/Levels/Closures preview correctly blocked deletion because 13 retained
   pricing rows reference levels. The corrected settings-only preview was verified
   directly: 14 selection keys, version2, zero blockers and before/restored values
   of auto-finalization=true, grace=15, payable-missed=false. Neither preview ran.
9. Promoted that exact candidate. Public domain and all three cron definitions now
   point to it. Restored the original postgres database-role default (no override)
   and Vercel automatic domain assignment. Fresh ordinary connections are read/write.
   Removed temporary maintenance; retained denial of the five obsolete/intermediate hosts
   through one active firewall rule. No unpublished firewall changes remain.
10. Public login returned HTTP200; unauthenticated reset access redirected to login.
    The activation remained valid. All 505 original audit rows still hash-match
    the backup, including the three historical payroll events. There are 506 audits
    including activation, three application users, three Auth users, two unconsumed
    previews and zero allocated identifiers or new family/student/payment/receipt rows.

## Verification scope and continuing controls

No Production Reset, fabricated registration, receipt or financial transaction was
executed. Live checks cover authenticated pages, dependency handling and preview;
completed registration/payment workflows are supported by the prior isolated
integration evidence, not an invented live transaction. Normal access is reopened.

The four-schema recovery scope retains existing Supabase-managed services; it is
not a full-platform backup claim. Any server restart or restore invalidates identifier
activation and requires the documented recovery reconciliation and fresh attestation
before issuance. Never fall back to a writable legacy deployment.

No release blocker remains from the approved checks. The exact deployed commit above
is the operational release; this documentation-only evidence branch does not change
its application artifact or introduce another deployment requirement.
