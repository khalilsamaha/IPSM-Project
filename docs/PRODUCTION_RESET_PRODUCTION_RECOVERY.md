# PR90 — actual Production archive recovery, 2026-11-09

**PASS for recovery of the four exported database schemas. Full Supabase platform
recovery is not certified; Production release remains NO-GO.** This is an actual
administrator-supplied IPSM Production archive, not the previous synthetic fixture.
The original file and Production were untouched. No migration, reset, activation,
merge or deployment was performed.

[Sanitized evidence](evidence/production-reset-production-recovery.json) records
the completed verification at `2026-11-09T14:05:19.746581+00:00`.

## Artifact and isolation

- Private artifact: `ipsm-production-2026-11-09T13-28-09-751Z.dump`, held in the
  administrator's secure backup directory. Its filename is not independent proof
  of the exact transaction snapshot time.
- SHA-256 before and after recovery:
  `c81a2e0c02b3cc89631d24fbde536e117c59757273f4d4e3866645a3fda47cfa`.
- 415106 bytes; regular file, not a symlink; owner/group `redeye`; file `0600`,
  parent directory `0700`. PostgreSQL custom archive version 1.16-0.
- Archive listing, schema decoding and full decoding to `/dev/null` all exited
  zero without stderr. There are 701 TOC entries and 63 table-data entries.
- Dedicated fresh volume/container `ipsm-pr90-production-recovery-20261109`,
  database `ipsm_production_recovery`, Supabase image `17.6.1.095`, PostgreSQL 17.6.
  The pinned image digest is in the evidence file.
- Docker network `none`, no published ports, no Auth/API services. `pg_cron` and
  `pg_net` workers were not loaded; cron jobs were disabled. Statement/audit logging
  and Docker logs were disabled for this private recovery target. No restored
  real Auth identity was used for login. The target is now **stopped**.
- Private working files and manifests are mode `0600` in a `0700` directory;
  the dedicated volume is retained for administrator custody. Neither private
  records, raw SQL bodies, credentials nor row fingerprints were committed.

## Restore method and explicit local adjustment

The pinned image supplied its standard Supabase roles. A fresh `template0`
database owned by `postgres` received the **entire unchanged archive** through
local platform owner `supabase_admin`, using `pg_restore --single-transaction
--exit-on-error`. Ownership and ACL restoration stayed enabled. No filtering,
`--no-owner`, `--no-acl`, trigger disabling, role rewriting or error suppression
was used. The restore exited zero with **zero stderr bytes**.

The archive includes `CREATE SCHEMA public`, so the empty target's default public
schema was removed before restoration. The first schema comparison then found
exactly one ACL difference: PUBLIC lacked USAGE on that schema. PostgreSQL 17
`pg_dump` calculates this schema's ACL against an assumed initdb baseline of
owner CREATE/USAGE and PUBLIC USAGE; its archive did not explicitly recreate the
latter. See [PostgreSQL 17's `getNamespaces` implementation](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/bin/pg_dump/pg_dump.c).

After verifying this was the sole SQL difference, the following correction was
reviewed and applied **only to the isolated recovery database**:

```sql
GRANT USAGE ON SCHEMA public TO PUBLIC;
```

This reconstructs the source baseline; it grants neither CREATE nor table access.
No role/membership or Production permission changed. The dump was not edited.
The final four-schema dump matches the source schema after normalization of line
endings, blank lines, version headers and generated psql guard tokens. Ownership,
ACL, default ACL, function, trigger and constraint SQL remains in the comparison.
Canonical schema SHA-256:
`b9e83517d63d32e722ff24cb06e05c4206774f2a5cb2c1279171fabc03d2023c`.

## Verified contents and integrity

| Check | Actual result |
| --- | --- |
| Complete exported table contents | **63/63** counts and sorted COPY-row SHA-256 comparisons match: public 25, auth 27, storage 10, Supabase history 1. Raw rows remained private. |
| Sequence state | The one archived sequence's value and `is_called` match. No sequence was advanced. |
| Application and Auth | 3 application users, 3 Auth users, 3 Auth identities and 7 sessions preserved; zero application profiles missing their `auth_id` counterpart. Auth's 82 migration records match. This is database recovery, not a login test. |
| Audit protection | All 505 audit records match, including the three historical payroll audit events referencing absent records. Current payroll and payroll expenses remain empty. Query14 still correctly reports the historical blocker; financial-owner acceptance is not supplied by recovery. |
| Constraints/indexes | 229 constraints across the exported schemas, including 91 public constraints and 75 FKs (45 public); zero unvalidated constraints or invalid/not-ready indexes. |
| RLS/triggers/functions | 51 RLS-enabled tables, zero policies, 14 user triggers with none disabled, 32 functions. Definitions/flags/ownership/ACLs match the archive. |
| Teacher guards | All three `prosrc` MD5s match the approved live hashes. In the local Supabase role model, all three deny EXECUTE to anon/authenticated and permit postgres/service_role, matching prior Query19 evidence. |
| Storage | One bucket and zero object rows restored; 80 Storage migration records match. External object bytes are outside the archive. |
| Identifier evidence | Families/students/payments/receipts are empty. Preserved audit history recovers legacy 2026 RCPT high-water 14 and STU 5; FAM history remains unknown. New reset/identifier tables are absent as expected before the future deltas. No reservation loss is inferred from that absence. |

The three Supabase history rows match both the prior provenance evidence and the
administrator's latest reported live baseline:

| Version | Statements | Joined-statement MD5 |
| --- | ---: | --- |
| `20260731171613` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `20260801163840` | 1 | `d34257683e5172ad7b1ede576a4b2591` |
| `20260801165129` | 1 | `6c4135265819300dd72a0fbc476f80c2` |

Prisma history is absent. No future delta was installed. The administrator also
reports independently verified Production runtime and migration profiles through
Kali Prisma: effective role and login role both `postgres`. This is attributed
administrator evidence, not a new agent connection to Production or Vercel.

## Recovery gate decision and limits

Close the **actual exported-database restore** gate for this artifact: application,
Auth, Storage metadata, historical ledger, protected audits, database object
ownership/ACLs, RLS, triggers, constraints and sequence state are recoverable.
No unrelated engineering tests were repeated and no implementation changed.

Do **not** close the broader platform/release coverage gate from this result:

- The archive has no cluster role definitions, passwords/membership graph,
  database-level settings or connection configuration. Roles came from the local
  image. Matching object ACLs does not certify the entire Production role graph.
- It has no extension installation objects or extension-managed schemas outside
  the four exports, physical cluster backup or WAL/PITR. The restored database
  contains only the built-in `plpgsql` extension. No missing managed extension or
  owner blocked this scoped restore.
- External Storage bytes, JWT/signing/API secrets, provider/SMTP settings, edge
  functions and other platform configuration are not in this file. Zero Storage
  object rows do not certify that the external object store is empty.
- Empty business tables and a successful restore do not certify historical
  identifier non-use, complete legacy reservations or issuance after the backup.
  Identifier activation remains held; no attestation was created.

These limits agree with [Supabase's platform-to-self-hosted recovery guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform).
The remaining recovery action is to document recoverable custody of the excluded
dependencies, or explicitly approve a scoped in-place recovery plan retaining the
existing platform/roles. An unqualified full-platform restore is not demonstrated.
Any later recovery must reconcile changes since this snapshot. **Stop here: this
verification does not proceed into migration application or deployment.**
