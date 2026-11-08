# PR90 — exact teacher guard equivalence and preservation

**GO for the identified source-body equivalence; NO-GO for production rollout.**
This review reconstructs administrator-reported live hashes from unchanged
historical repository sources. It is not a new production query, migration-history
claim, or authorization to replace functions or deploy. See the
[metadata and reference manifest](evidence/production-reset-guard-equivalence.json).

## Exact text findings

| Function | Canonical prosrc MD5 | Reconstructed live prosrc MD5 | Only change |
| --- | --- | --- | --- |
| validate_enrollment_teacher_availability | e85ba87b42cfa5e5b60c2d3aaa0ccfc1 | 2e995c04ca6865d8160d798ee9e5099f | All 59 LF characters become CRLF: 1,880 → 1,939 UTF-8 bytes. |
| validate_schedule_teacher_availability | e9d829cecb69aedc692d7b1a5fdaaf07 | 8bf0ff83d02322ec49fb6500f794a74e | Remove exactly 109 bytes: the two-line legacy/import comment and its LF terminators. 1,302 → 1,193 bytes. All remaining line endings stay LF. |
| validate_teacher_availability_scope | ce495851f4dce1da05f507f4af587a61 | ce495851f4dce1da05f507f4af587a61 | Identity: 1,128 bytes. |

Sources: `prisma/migrations/20260801190000_enrollment_teacher_availability/migration.sql`
and `supabase/migrations/20260801101500_teacher_consistency.sql`. Neither changes.
The enrollment body matches after line-ending conversion only. The schedule's
removed text is exactly:

```text
  -- Legacy/imported sessions without an enrollment retain their existing
  -- application-managed behavior.
```

There is no executable-text difference in either reconstructed body. In particular,
the live schedule variant already has the NULL-enrollment early return. PostgreSQL
[lexical rules](https://www.postgresql.org/docs/17/sql-syntax-lexical.html) treat this
comment as whitespace. Tests install each reconstructed body and verify **PostgreSQL's
own `md5(prosrc)`**, not just a client-side hash. SHA-256 values are also recorded
for future reproduction; they are reconstructed-source hashes, not separately
administrator-reported live SHA-256 evidence. Original full exports were not read
in this workspace; the supplied MD5 values and transformations reproduced exactly,
so the task's original-export fallback was not needed.

## Validate-and-preserve implementation

Only the two mirrored, unapplied `20261107000000_teacher_guard_parity` files change.
The prior reset ACL/state correction is byte-for-byte unchanged.

- Accept only each exact canonical body and its one explicitly reconstructed live
  variant. Compare full `prosrc` text; incoming code is **never** normalized by
  whitespace stripping, comment stripping or line-ending conversion. Internal
  source/hash assertions detect accidental edits to the reviewed literals.
- Require the reviewed language/return type, invoker mode, volatility, strictness,
  parallel/leakproof flags, cost/row estimates, argument metadata, empty search_path,
  and function owner matching both its table owner and the executing migration role.
  Unknown overloads also block. These extra attribute assertions are intentionally
  fail-closed, not claims that every attribute has been re-collected from production.
- Require the approved trigger definition hash, target function, enabled state,
  timing/events/update columns, no arguments/WHEN/transition tables, and no
  constraint/deferred/partition trigger behavior.
- For approved existing functions and triggers, execute **no replacement, ALTER,
  DROP, recreation or ACL modification**. Preserve source bytes, attributes, owners,
  permissions, OIDs and catalog tuple versions. Tests use a DDL event-trigger tripwire
  plus complete catalog snapshots, including a nondefault fixture ACL.
- If both availability/schedule function and trigger are absent on the documented
  older-schema path, create the same canonical guard with the prior creation ACL
  policy. An existing function with a missing/changed trigger is rejected rather
  than silently repaired. The enrollment guard is a historical prerequisite:
  absence blocks; this migration neither creates nor replaces it.
- Acquire affected table locks in the migration transaction. The release procedure
  must prohibit concurrent privileged function/schema DDL; table locks alone do not
  freeze another administrator's ALTER FUNCTION operations.

The creation branch remains for repository parity; all three functions/triggers
are reported present in IPSM, so production's intended branch is validation and
preservation only. Existing teacher-function ACLs are preserved, not newly certified
or hardened. Review their effective rights separately; no new entitlement is inferred.

## Independent non-function DDL review

The source-body finding does not establish that the rest of the parity migration
is redundant. It still adds **missing** intended schema objects, and now verifies
existing definitions instead of trusting their names. Any mismatch rolls back the
whole transaction; there is no automatic conversion, reindexing or constraint repair.

| Object | Required definition / rollout implication |
| --- | --- |
| TeacherCompensationBasis enum | Exactly HOURLY, SESSION_UNIT in order. Unknown variants block. |
| teachers.compensation_basis | Enum, NOT NULL, default HOURLY. A missing column fills that default; approve its meaning for existing teachers before deployment. |
| teachers.session_rate_cents | Nullable integer, no default. No historical rate is inferred. |
| teachers.session_unit_minutes | Integer, NOT NULL, default 30. A missing column fills 30; approve operational meaning. |
| teachers.hourly_rate_cents | Existing prerequisite: integer, NOT NULL, default 0. |
| teacher_availability.course_id | Nullable UUID without default; missing column adds no inferred course assignment. |
| Payroll/payroll-item snapshot columns | Nullable compensation-basis enum and integer rate-unit snapshot, no defaults. No historical compensation snapshots are fabricated. |
| Teacher rate/unit checks | Exact validated nonnegative-rate and positive-unit CHECK definitions; NOT VALID, weaker expressions or changed inheritance behavior block. New checks scan existing data and may fail/lock. |
| Availability course FK | Exact validated, immediate FK to public.courses(id), DELETE RESTRICT / UPDATE CASCADE. This specific FK matched the original live baseline; no blanket NO ACTION exception is introduced here. |
| Availability course index | Exact valid/ready/live ordinary btree on course_id. Wrong keys, expression, uniqueness or INCLUDE shape block. |
| All-level assignment uniqueness | Exact valid/ready/live unique btree on (teacher_id, course_id), partial predicate level_id IS NULL. Duplicate existing assignments block creation; no records are removed. |

Column checks include type OID/modifier, nullability, default and identity/generated
flags. Constraint/index checks include definitions and relevant integrity flags.
These are scoped checks of the objects this migration touches, not certification
of every unrelated live table, policy, trigger or extension. The recorded reference
was generated on an isolated PostgreSQL 17.6 schema from repository fixtures.
**Actual production column/default/check/index definitions still require reconciliation**
with that reference and the full current schema; table presence and function hashes
are insufficient. Do not apply a migration just to discover whether it passes.

## Isolated comparison and regression tests

`tests/teacher-guard-parity.postgres.test.ts` has **70 tests**:

- 43 cases execute both canonical and reconstructed live bodies in independent
  rolled-back fixtures. They require identical outcomes, SQLSTATEs and guard errors,
  plus explicit expected acceptance/rejection (not equality alone).
- Coverage includes positive/boundary dates and time windows; actual weekday
  occurrence versus calendar overlap; NULL teacher/enrollment/course/level;
  exact/all-level/mismatched/archived assignments; archived availability; global,
  seasonal and course-specific scopes; cancelled/archived lessons; and seasonal
  availability date/assignment checks.
- Two preservation tests verify PostgreSQL body hashes and unchanged complete
  function/trigger catalog snapshots, while forbidding function/trigger DDL.
- 24 negative migration tests reject unknown bodies (even an extra comment),
  executable changes, attributes, configuration, owner, overload, missing/changed
  triggers, missing enrollment prerequisite, and enum/column/constraint/index drift.
  Expected error messages are checked, then a clean transaction proves rollback.
- One additive-schema test verifies the reviewed missing-object path.

Existing tests additionally cover first creation of availability/schedule guards,
byte-identical migration mirrors, preflight redaction, reset integrity and security.
No teacher business rule was changed. Notably, the schedule guard still does not
recheck teacher-course assignment/level or enforce enrollment-date bounds; the
NULL-enrollment early return remains. Equivalence does not imply these guards
alone validate every academic invariant. Existing application/other constraints
remain responsible for their respective checks.

## Remaining release gates

The earlier body-hash mismatch blocker is resolved for the exact reviewed variants.
Still required: full production attributes/trigger/schema/ACL reconciliation with
migration assertions; actual Vercel runtime and migration-role verification;
historical identifier policy; truthful Supabase migration provenance/release
packaging; preserved-payroll-history acknowledgement; Preview database isolation;
representative isolated staging, backup/restore and human approval. No new function
bodies or migrations are applied to production by this work. Keep PR90 draft.
