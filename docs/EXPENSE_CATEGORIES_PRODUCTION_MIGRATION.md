# PR94 expense-category migration — R1 correction; Production still blocked

## Current R1 outcome (2026-11-12)

Starting head `e201cd0ad50331f406f1fae11a27a70469622045` matched the freshly
fetched remote branch; PR94 was OPEN/DRAFT and its CI passed. No intervening commits
or conflicting migration edits were present. The original full-logo metadata and
asset checksum remain unchanged. No application business logic was changed in R1.

[Sanitized R1 evidence](evidence/expense-categories-recovery-r1-20261112.json)
supplements the **unchanged** prior failed-attempt record below.

| Gate | Result |
| --- | --- |
| Direct endpoint DNS | PASS: expected IPSM hostname resolves to AAAA; no A address |
| Executing Kali host routing | BLOCKED: no IPv6 default route; exact-target route lookup and TCP/5432 both report Network is unreachable (errno 101) |
| Approved profile | PASS: existing scoped credentials loaded privately; direct host/5432/postgres, required TLS and read-only session defaults verified without opening a session |
| Current Production identity/history/table absence | NOT VERIFIED: TCP failed before TLS/authentication; no database SQL executed |
| Revised name CHECK | PASS locally on disposable PostgreSQL 17.6; Unicode and ASCII regression coverage |
| Migration mirrors/scope | PASS: identical; all SQL outside the CHECK unchanged |
| Production dry run / application / postchecks | NOT EXECUTED / NOT EXECUTED / SKIPPED |

The DNS result is not a database identity verification. The failure is an unavailable
route on the actual Kali execution host, not evidence of a bad password, TLS failure
or database-side firewall rejection. Link-local/private IPv6 interfaces do not supply
an outbound route. No already-authorized alternative IPv6 execution host was established
in this session. The safest recovery route is for the administrator to restore working
IPv6 routing on this Kali host, then repeat the bounded direct-endpoint TCP check and
read-only identity/history preflight. No networking changes, alternate project, pooler,
paid IPv4 add-on or new infrastructure were used.

### Revised artifact and whitespace contract

Version remains `20261112000000_expense_categories`. Revised SHA-256:

`99b8d371e150e7b007aba7db272b45b253815914c4a67454c298bc3dee84f0e2`

The CHECK retains `length(name) BETWEEN 1 AND 80`, replaces ordinary-space `btrim`
with a boundary-whitespace regex, and uses the same whitespace class to normalize
only the **reserved-name comparison**. That class combines PostgreSQL `[[:space:]]`
with explicit ECMAScript whitespace code points U+00A0, U+1680, U+2000–U+200A,
U+2028, U+2029, U+202F, U+205F, U+3000 and U+FEFF. It rejects blank and wrapped names
and any case/whitespace variant of `Teacher Payroll`. It does not rewrite stored
names, normalize the uniqueness index, or change legitimate internal spacing.

Actual PostgreSQL 17.6/C-locale probes confirm POSIX matches tab/newline but not NBSP
or BOM, hence the explicit Unicode additions. Tests cover every one of JavaScript's
25 trim/whitespace characters. Application input still trims/collapses whitespace
before storage; direct SQL must already have clean boundaries. Other database locales
may classify additional POSIX whitespace more strictly. U+200B ZERO WIDTH SPACE is
not JS trim whitespace; a legitimate name containing it remains accepted. The existing
PostgreSQL character-count limit and application's JavaScript UTF-16 length limit are
unchanged (the application remains stricter for supplementary-plane characters).

The case-insensitive unique index, eight active defaults (including `Ogero / Internet`),
RLS, object-only privilege revocations, transaction boundaries and lack of expense
backfills/FKs are preserved. No other migration file changed. The prior attempt made
no database write; **today's remote applied state cannot be certified while unreachable**.
No assertion is made about application of this version in another environment.

### Local validation and next gate

R1's focused PostgreSQL suite has 50 passing tests (previously 15), including 150
whitespace rejection attempts, exact constraint SQLSTATE checks, valid 1/80-character
names, 81-character rejection, case-insensitive duplicates, default categories,
privilege denial including MAINTAIN, retained historical expenses and atomic rejection
of repeat application. All fixtures use the disposable local database safety marker.
The accompanying evidence records the full validation results.

**NO-GO for Production execution.** Next: restore approved direct connectivity; verify
current identity/roles/history and absence of this migration/table; review this revised
checksum and obtain explicit authorization for the next execution phase. That phase
must certify the canonical workspace and exactly one pending migration through the
supported Supabase dry run before any tracked application. R1 applies nothing to
Production. PR94 remains draft; merge, deployment and activation remain unauthorized.

## Historical initial attempt (retained verbatim below)


On 2026-11-12 the owner authorized **only** the tracked
`20261112000000_expense_categories` Production migration and necessary verification.
The attempt stopped before any database write because the approved direct PostgreSQL
connection returned **Network is unreachable** from the executing environment.
No pooler or alternate project was substituted. No automatic retry or repair occurred.

[Sanitized evidence](evidence/expense-categories-production-migration-20261112.json)
records the exact results. Starting PR head
`94a3122fb6fc13a9c60158d8aa9c3fe6525e2824` was verified open/draft with successful
[CI](https://github.com/khalilsamaha/IPSM-Project/actions/runs/43186039608).
The local branch was fast-forwarded without discarding or rewriting any commits.

| Check | Result |
| --- | --- |
| Complete original logo for browser/shortcut/Apple icons and login/sidebar | PASS; original SHA-256 unchanged; fingerprint-only PNG and file-based overrides absent |
| Prisma/Supabase migration copies | PASS; byte-identical, SHA-256 `69bc7afdc9ecc543fb8cbbccbd444d721f5f4406255abf44ce1ccddbf4eccd87` |
| Additive SQL scope | PASS; new catalogue only; no existing-expense backfill/FK, destructive operation or global ACL change |
| Name CHECK semantics | REVIEW REQUIRED; see below |
| Supabase CLI | PASS; installed 2.78.1; supported dry-run/push flags inspected |
| Actual current Production database identity, roles and capability | NOT VERIFIED; direct connection failed |
| Current migration history, table absence and expense/data baseline | NOT EXECUTED; no database session established |
| Canonical current-history alignment / one-pending dry run | NOT EXECUTED |
| Migration application | NOT EXECUTED; no migration was applied |
| Post-migration defaults, constraints, RLS, ACLs, history and data preservation | SKIPPED; no migration, and no fresh database baseline available |
| Existing public login service | PASS; unauthenticated GET returned HTTP 200 with IPSM sign-in form at 09:02:20 UTC |
| Authenticated business workflows | NOT TESTED; no login, registration, payment or reset submission |

## Additional SQL review finding

The reviewed CHECK uses `name = btrim(name)` and a positive length. PostgreSQL's
one-argument `btrim` trims ordinary spaces. Consequently a tab-only or newline-only
name satisfies the nonempty/trim conditions. The reserved-name comparison normalizes
whitespace but does not trim the normalized result, so a tab-wrapped `Teacher Payroll`
can also pass. The application normalizes input, but that does not establish the
requested database-level rejection of invalid names.

This is a static SQL-review finding. A synthetic, read-only expression probe was
prepared but **did not execute** because the direct connection failed. No migration
or business logic was changed to address it under this migration-only authorization.
A reviewed correction should explicitly reject leading/trailing whitespace and
whitespace-only values, and trim the normalized reserved-name comparison. Test tabs,
newlines, spaces, mixed case, length boundaries and valid names on disposable PostgreSQL;
review both mirrored files and the revised checksum before authorizing that artifact.

## Resume conditions

1. Restore reachability to the approved IPSM direct endpoint from the executing
   environment. Verify the exact project/database/server, roles and capability;
   collect a fresh read-only migration/schema/data/ACL baseline. No credentials
   should be pasted into chat or committed.
2. Resolve the CHECK review above. Do not silently apply changed SQL under the old
   reviewed fingerprint or claim unexecuted validation passed.
3. Align the existing canonical workspace with the actual recorded history. Its
   old six-file workspace is available but was not certified against today's target.
   Require exactly one pending reviewed migration in the supported CLI dry run;
   then apply once and complete the requested critical postchecks.

Production data, activation, grants, deployed application and Vercel settings were
not changed by this attempt. No new backup/database/infrastructure was created.
The full-logo commit and all feature changes are preserved. PR94 remains draft;
merging and application deployment still require separate owner approval.
