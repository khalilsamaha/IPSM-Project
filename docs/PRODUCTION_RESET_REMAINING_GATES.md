# PR90 — remaining evidence and administrator decisions

Review baseline: `46bd8f4e0de891acf147e1472542f579e740ccc9`.
**Production NO-GO; keep draft.** Exact teacher-body equivalence is resolved and
is not re-investigated here. This follow-up changes documentation, two read-only
metadata reports and their tests only; neither migration pair nor application
logic changes.

## Evidence actually available

- `/home/redeye/Downloads/IPSM_PR90_Codex_FKs_and_TeacherGuards.txt` is the
  administrator's excerpt of Query 02 (545 items, observed November 7 at
  22:02:24.628833 UTC) and Query 03 (14 items, 22:02:52.844139 UTC), explicitly
  attributed to IPSM `rakzehtbpzseetldbohm`. Its hash and safe metadata are already
  committed in `docs/evidence/production-reset-2026-11-07.json`.
- The administrator subsequently supplied both original files under
  `/home/redeye/ipsm-private/evidence/`: `IPSM_PR90_02_schema_full_report.json`
  and `IPSM_PR90_teacher_parity_schema_evidence.json`. The complete report has
  completed=true, READ ONLY / REPEATABLE READ and exactly **545** items. Its
  SHA-256 is `ffca529d1d219385e53f5c63cb8cc322fe0722eacecbdcd2d113a02dbbf10b26`,
  matching the extract's provenance field. Every one of the **16** extracted
  observations equals an original report item; filtering the complete report
  finds exactly those 16 (including exactly two enum labels). The
  [committed scoped evidence](evidence/production-reset-teacher-schema-query02.json)
  retains metadata only, plus verification notes; the broader private report is
  not republished. Its source timestamp remains November 7, not a fresh live query.
- `/home/redeye/ipsm-private/guards/live-teacher-guards.json` contains the two
  administrator function exports. Header-only review confirms the enrollment
  and schedule functions are zero-argument public functions returning trigger,
  LANGUAGE plpgsql, with only an empty search_path SET clause. The header omits
  nondefault volatility/security/strictness/parallel/cost clauses; that is
  consistent with the required defaults, but catalog-only metadata, ownership
  and ACLs are not in CREATE FUNCTION output. No bodies are republished or
  compared again. File SHA-256:
  `0f935181e083bbec386f601d9692bb596da2e2e44d9d0648323e22f6dbabd084`.
- `/tmp/ipsm-reviewed-teacher-guards.json`, `/tmp/ipsm-parity-reference.json` and
  committed guard reference manifests are **disposable fixture output**, not
  production observations. The similarly named unrelated Downloads schema has
  no IPSM attribution and is excluded.
- Later Query 10/12–17 findings remain administrator summaries with their
  previously documented limits. No new live database request was made.

## Non-function parity reconciliation

All column expectations below also require typmod -1, no identity/generated
expression. Types must resolve to the intended pg_catalog/public type OID in the
same database, not numerically equal OIDs across databases.

| Object | Exact expected definition | Available live conclusion |
| --- | --- | --- |
| public.TeacherCompensationBasis | enum HOURLY, SESSION_UNIT in that order | **Confirmed** both public-enum labels and order from full Query 02. |
| teachers.hourly_rate_cents | integer, NOT NULL, default 0 | **Confirmed** displayed type/NOT NULL/default hash of 0; existing prerequisite. |
| teachers.compensation_basis | public enum above, NOT NULL, default HOURLY | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teachers.session_rate_cents | integer, nullable, no default | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teachers.session_unit_minutes | integer, NOT NULL, default 30 | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teacher_availability.course_id | uuid, nullable, no default | **Confirmed** uuid, nullable, no default/identity/generated; FK also confirmed. |
| teacher_payrolls.compensation_basis_snapshot | public enum above, nullable, no default | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teacher_payrolls.rate_unit_minutes_snapshot | integer, nullable, no default | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teacher_payroll_items.compensation_basis_snapshot | public enum above, nullable, no default | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teacher_payroll_items.rate_unit_minutes_snapshot | integer, nullable, no default | **Confirmed** displayed type, nullability, no identity/generated and expected default hash/absence. |
| teachers_rates_nonnegative | hourly_rate_cents >= 0 AND (session_rate_cents IS NULL OR session_rate_cents >= 0) | **Confirmed** expected pretty definition hash, ordered columns, validated=true and both deferral flags=false. |
| teachers_session_unit_positive | session_unit_minutes > 0 | **Confirmed** expected pretty definition hash, validated=true and both deferral flags=false. |
| teacher_availability_course_id_fkey | course_id → public.courses(id), UPDATE CASCADE, DELETE RESTRICT | **Confirmed** columns/actions/validated=true and pretty definition hash `b23e7b4402ee6fd4b8589e7dcfa55f9d`; SIMPLE match and both deferral flags=false also confirmed; local/inheritance flags still absent. |
| teacher_availability_course_id_idx | ordinary btree(course_id) on public.teacher_availability | **Confirmed** exact definition hash, keys/counts, ordinary nonunique/nonprimary btree, valid/ready; live/exclusion/nulls-not-distinct flags absent. |
| teacher_courses_teacher_course_all_levels_key | unique btree(teacher_id, course_id), predicate level_id IS NULL | **Confirmed** exact definition/predicate hashes, ordered keys/counts, unique/nonprimary, valid/ready; live/exclusion/nulls-not-distinct flags absent. |

All **15 scoped objects are reported present** (16 report items because the enum
has two label rows), with no mismatch in the properties Query 02 actually exports.
This closes the earlier definition/default/presence gaps: none of these additions
is indicated as needed by the supplied snapshot. It does not prove the remaining
strict catalog flags or ownership, or that the entire parity transaction is a no-op.
Columns' displayed types do not expose raw type namespace/OID or typmod; CHECK/FK
inheritance flags and three index flags are absent. These are the only schema
assertion gaps retained, alongside DDL ownership. No migration correction is justified
by the supplied evidence; both mirrors remain byte-for-byte unchanged.

### Catalog rendering is evidence context

Query 02 hashes `pg_get_constraintdef(oid, true)`; parity compares
`pg_get_constraintdef(oid)` (pretty=false). CHECK parentheses/spacing differ on the
same PG17 object. `pg_get_expr`, type display and schema qualification also depend
on visibility/search_path; OIDs are local identifiers, not portable fingerprints.
Query 02 did not fix its search_path. Therefore a differing display string/hash
alone does not prove executable drift and must not expand the migration allowlist.
PostgreSQL documents these as reconstructed definitions, including pretty-print
variants: [catalog information functions](https://www.postgresql.org/docs/17/functions-info.html).

Verified default hashes: 0 → `cfcd208495d565ef66e7dff9f98764da`,
30 → `34173cb38f07f89ddbebc2ac9128303f`,
`'HOURLY'::"TeacherCompensationBasis"` → `4072a85438a965800c208255b63b0765`.
All six remaining columns have no default. Both index definition hashes reproduce
from the migration strings: availability index `bde579a15fd2cbf558e89191b0090b8d`,
all-level index `417f86dfd1230f1a8b54525da8cc2921`; predicate `(level_id IS NULL)`
reproduces `764c3b415de9e86ab0c18cd8f418fb57`.

PostgreSQL fixture tests reproduce all three **pretty** constraint hashes from the
reviewed definitions: rates `a0ba59ce816f85d082988fd91153f0a7`, positive unit
`3f0aca81ae46654c337e560e3b89a54d`, FK `b23e7b4402ee6fd4b8589e7dcfa55f9d`.
They also compare the fixture's non-pretty definition to the exact migration
reference. Thus the expected CHECK hash discrepancy is explained by rendering;
no allowlist expansion or production re-query of the definitions is warranted.

[Query 18](sql/production-reset-dashboard/18_teacher_schema_gaps.sql) is now narrowed
to **14 missing metadata items**: nine type identity/modifier/ownership rows, three
constraint inheritance rows, two index flag/ownership rows. Public enum ownership
is included in its column-type rows. It does **not** repeat known enum labels,
defaults, nullability, CHECK/FK definitions or index definitions. Use its result
with the verified Query 02 snapshot; it is deliberately not a fresh full-schema
certificate. At final release, refresh only evidence affected by intervening DDL.
Do not normalize arbitrary incoming definitions or weaken assertions to force a match.

## Guard metadata, ownership and ACL reconciliation

| Requirement | Proven / outstanding |
| --- | --- |
| Exact three bodies | Resolved by prior review; no new source export required. |
| Configuration | All three configuration hashes match; two original headers explicitly set only empty search_path. Exact array equality remains a cheap catalog assertion. |
| Owner / security mode | Excerpt reports all three owner postgres and SECURITY INVOKER. **Table ownership and intended migration execution role equality are not established.** |
| Function shape | Two export headers confirm plpgsql/trigger/zero args. Omitted default attributes support parity. Full three-function catalog flags, support function, argument metadata, binary/sql body absence and same-name overload absence were not collected in the excerpt. |
| Trigger definition | All three definition hashes, enabled O, type bits 23 and zero argument counts confirmed. Hashes support the definition text, including target/columns; do not infer all hidden catalog flags from a hash. |
| Trigger catalog-only properties | Exact function binding, no internal/parent/constraint relation/index association, no deferral/transition/WHEN/argument-byte anomalies still need the scoped assertion. |
| DDL ownership outside guard tables | Enum and teachers/teacher_courses/payroll table ownership is not established by DML grants. Query 18 reports scoped table/type/index owners; compare with verified migration-role ownership/membership, schema CREATE/USAGE and a live-compatible staging rehearsal. |
| Existing guard ACLs | Query 10 reports candidate postgres execution. Complete expanded ACL and anon/authenticated/service_role effective EXECUTE remain unproven. Parity **preserves**, and does not validate an allowlist for, existing guard ACLs. Do not claim a migration ACL assertion that does not exist. |
| Actual backend/migration identity | Dashboard postgres/postgres is still not evidence of the actual configured runtime or selected migration connection. |

[Query 19](sql/production-reset-dashboard/19_teacher_guard_metadata_gaps.sql)
returns **four items**: role input and three guard metadata entries. It checks the
remaining migration assertions without reading/returning prosrc or executing any
guard. Expanded ACLs include PUBLIC's built-in default if proacl is NULL; effective
EXECUTE includes ordinary inherited privileges for the three clients and supplied
roles. ACLs are review evidence, not an automatic deny rule for these pre-existing
invoker trigger functions. A grant is not by itself proof of a callable elevated
RPC; analyze trigger attachment rights, caller data privileges and the separately
reviewed reset-state guard together. This query does not establish every possible
SET ROLE path, elevated RPC safety, or runtime provenance; retain the actual role
membership/security staging gate from Query 17. No permission change is proposed.

## Identifier decision — business approval required

Current families/students/payments/receipts are empty. Recoverable 2026 receipt 14
and student 5 are **lower bounds**, family unknown. The current allocator still
produces KIND-YYYY-number; regex audit recovery can miss arbitrary imported codes.
No safe family starting value or complete historical upper bound is established.

| Decision | A. Complete historical reservation | B. New provably disjoint namespace |
| --- | --- | --- |
| Evidence required | All prior issuers/import paths, kind/year coverage, backups/exports/receipts and owner relationships; account for cancellations, voids, deleted rows and nonstandard codes. Financial/business owner signs completeness. | Define historical accepted/issued identifier language and prove the proposed namespace was outside it. Account for manual imports/external issuance; repository generator format alone is insufficient proof. |
| Concrete artifact | Private versioned reservation manifest: kind, exact value, verified owner or historical-only, source, certainty; per-kind/year maximum and coverage gaps. Public review receives counts/checksum/coverage/sign-off only. | Business-approved grammar with a dedicated immutable epoch component, e.g. KIND-IPSM-EPOCH1-YYYY-number (**illustration, not selected**), collision-proof separation argument, rollout date and compatibility contract. |
| Non-reuse proof | Every issued value is reserved, deleted-owner values cannot be reassigned, counters exceed all issued numeric values; imported explicit codes obey the same ledger rules. | Legacy accepted set L and approved new set N must satisfy L ∩ N = ∅. Different component grammar can prove this for a bounded old language; arbitrary historical text/imports require additional evidence. A random prefix, higher number or next year alone is not a proof. |
| Required implementation after approval | Reviewed seed/import with conflict rejection; ownerless legacy entries not adopted by unrelated new rows; monotonic counters and immutable identifiers; historical restore policy. Current reset ledgers supply the mechanism, not the missing history. | Change allocator, database creation/import validation, ledger parsing/recovery, counter keys and readers/exports/receipts together. Preserve legacy codes and known reservations; disallow ordinary new issuance in old grammar. Existing code does **not** enforce this policy. |
| Tradeoff | Preserves existing displayed format; potentially impossible completeness and labor-intensive recovery. | May avoid reconstructing every old numeric counter if disjointness is proven; requires business acceptance and coordinated format/compatibility changes. |
| Tests before release | Deleted history; conflict/owner ambiguity; manual imports; restored receipts sharing only proven payment ownership; voids; concurrency; counter overflow; idempotent manifest application. | Same tests plus old-namespace rejection for new rows, new/old parser separation, unknown epoch rejection, immutable namespace across resets, mixed legacy lookup/export and no rollback to old issuance. |
| Decision now | NO-GO without complete history. | NO-GO without proof and business approval; recommendation if complete recovery is infeasible, not authorization. |

Do not renumber historical receipts. Do not seed only RCPT=14/STU=5 and FAM=0 as a
claim of safety. If neither option can be proven, keep issuance/rollout blocked.
No policy or production reservations are implemented by this follow-up.

## Truthful Supabase provenance and release packaging

| Existing record | Known | Not established |
| --- | --- | --- |
| 20260731171613 | Version exists | Per-version statement-count attribution, original SQL, deployment artifact and effects. |
| 20260801163840 | Version exists | Per-version statement-count attribution, exact trusted SQL bytes and which objects it explains. |
| 20260801165129 | Version exists | Same provenance gaps; date/name resemblance cannot map it to a repository migration. |

The administrator reported counts **0, 1, 1 in report order**. The existing evidence
summary explicitly marks the version-to-count mapping as not independently
verified; no raw Query 16 rows were supplied. Do not assign 0/1/1 to the sorted
versions by assumption. Reuse the administrator's retained Query 16 rows to fill
that worksheet field (no new broad query needed). Zero stored statements is not
proof of no DDL; one stored statement may contain compound SQL.

No public._prisma_migrations exists; none of the three versions names a repository
migration. The private SQL snippet mentioned earlier is one byte and cannot supply
provenance. Do not execute it, invent missing statements, fabricate Prisma applied
rows, rename unrelated repository migrations to these versions, or replay the tree.

1. Preserve all three original records unchanged. Use existing Query 16 results
   and administrator-held original artifacts first. Privately inspect the two
   stored statements, classify their DDL scope and compare trusted deployment
   files byte-for-byte. Share versions, counts, hashes, object mapping and explicit
   unknowns only; stored SQL may contain secrets and must not be pasted publicly.
2. Create a provenance worksheet with one row per actual record: timestamp if
   known, original source/hash, exact-match versus semantic-only attribution,
   objects accounted for and unrecovered gaps. Record manual/unattributed schema
   changes separately as **observations**, not invented past migrations.
3. Maintain a sanitized current-state schema reconstruction outside the deployable
   migration directory for isolated staging. Label it observed-as-of, not applied
   history. Include the actual guards, constraints and relevant role/default ACL
   behavior; no production data/secrets needed.
4. Adopt Supabase as the single canonical future migration mechanism, with Prisma
   only for client/schema generation and mirror verification. Build a separate
   reviewed release workspace with authentic recoverable history and only the
   approved future delta. Do not put a fictitious no-op into the zero-statement
   version to silence tooling. If authentic history cannot satisfy the chosen
   CLI version's reconciliation, **packaging remains blocked** pending an explicitly
   reviewed supported history strategy; no repair command is authorized here.
5. In disposable staging, prove the release's pending list contains only approved
   future work, apply that delta once and verify integrity, permissions, rollback
   and backup restoration. Record the release SQL hashes and tool version. A
   current snapshot proves reconstructability, not historical application.

Supabase tracks applied versions separately from local files; the distinction is
why an unrestricted repository push is unsafe here. [Supabase migration guide](https://supabase.com/docs/guides/deployment/database-migrations).
No CLI history repair, database pull with side effects or live deployment is part
of this review.

## Exact remaining administrator actions

1. Preserve the supplied original Query 02 and extract with their checksums.
   Definitions/defaults/presence are reconciled; no rerun of broad Query 02 is
   requested. Keep the snapshot date and report any later DDL affecting this scope.
2. Run only **18** for the remaining catalog flags/owners and **19** for remaining
   guard metadata. No need to repeat body equivalence, Query 13 or known schema
   definitions. Entire files, one at a time in the IPSM Dashboard; expected counts
   **14 and 4**. Both use read-only repeatable-read, 45s statement/3s lock limits,
   and rollback. Share full metadata JSON, timestamp, selected project/branch and
   PR commit. Errors, missing objects/roles, unsupported catalogs, partial results
   or timeouts are blockers.
3. Obtain only current_user/session_user role names from existing authorized
   **actual runtime-configured** and intended migration connections. Do not expose
   credentials, retrieve environment values or deploy an endpoint. Fill Query 19
   role placeholders only when independently confirmed; leaving them unchanged
   intentionally blocks role approval while still returning object evidence.
4. DBA reviews any schema/attribute mismatch or missing intended object, expected
   lock/scan/default-population effects, and existing ACLs. Never apply parity to
   find out whether its assertions pass. Reconstruct live-compatible staging and
   verify both proposed migrations with the actual creator/runtime role model.
5. Business/financial owners choose and sign one identifier strategy and acknowledge
   the three preserved historical payroll audit events. No financial rewrite or
   audit deletion follows from that acknowledgement.
6. Release owner completes the three-record worksheet and truthful canonical
   release package. Confirm Preview database isolation, staging/load/restore
   validation and final human review before requesting separate deployment approval.

**Resolved:** reviewed FK deletion behavior, body equivalence, and isolated security
fixes. **Still NO-GO:** remaining catalog flags/ownership and guard metadata, actual identities and
role graph/staging permissions, historical identifiers, provenance/package,
historical payroll acknowledgement, Preview isolation and operational acceptance.
CI success certifies tests, not these production decisions. PR90 remains draft.
