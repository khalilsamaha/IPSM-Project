# PR90 — private certification and financial acknowledgement forms

**Templates only. All decisions are PENDING / UNSIGNED.** Fill and retain the
completed records in the administrator's private evidence store. Commit only an
approved status/reference/hash, never personal records, financial audit payloads,
credentials or signatures. These forms do not create database attestations or
authorize migration, deployment, reset, new issuance or financial repair.

Use these records with the [minimal release admission package](PRODUCTION_RESET_RELEASE_ADMISSION.md).
Record C is the proposed scoped recovery/maintenance decision; it does not reopen
the completed exported-database restoration gate.

## A. Historical IPSM namespace and recovery certification

Record ID: ______  Revision: ______  UTC cutoff: ______
Production project: `rakzehtbpzseetldbohm`
Business owner / authority: ______  Independent DBA reviewer: ______
Private evidence location/reference: ______

**Verified inputs, not a signed conclusion:** the actual Production archive with
SHA-256 `c81a2e0c02b3cc89631d24fbde536e117c59757273f4d4e3866645a3fda47cfa`
restored successfully; all 63 exported table contents match, including 505 audits.
At that backup snapshot, families/students/payments/receipts were empty; recoverable
legacy 2026 audit maxima were RCPT 14 and STU 5, with no FAM maximum recovered.
New identifier infrastructure was absent, as expected before migration. These are
lower bounds on surviving **legacy** evidence, not complete historical reservations
or proof of IPSM namespace non-use. Deleted/external/manual/import history and the
interval after export remain uncertified. See the [actual recovery record](PRODUCTION_RESET_PRODUCTION_RECOVERY.md).

The already approved format is FAM-IPSM-YYYY-serial, STU-IPSM-YYYY-serial and
RCPT-IPSM-YYYY-serial. Year is UTC 2000–9999. Serial is positive decimal
1–9223372036854775807, padded to at least six digits and otherwise canonical.
Certification covers **every possible valid value**, not only the next year or
serial; a new-looking prefix alone does not prove non-overlap. Payment and receipt
share RCPT ownership through the payment UUID; no separate PAY sequence is assumed.

For each source below record the responsible custodian, entire historical period,
private artifact/reference and SHA-256, review method, coverage gaps and outcome.
Use “unavailable/unknown” rather than silently treating missing evidence as empty.

| Required historical coverage | Evidence / gaps / outcome — to be completed |
| --- | --- |
| Current and archived/deleted-source database history, surviving audit references and trusted backups | ______ |
| All historical imports, manual SQL/explicit assignments and data corrections | ______ |
| Issued/exported/printed/shared family, student and receipt documents, including voids/reprints | ______ |
| External spreadsheets, prior systems and staff/manual/offline issuance channels | ______ |
| Owners/custodians' substantiated account of the period before surviving records | ______ |
| Issuance between evidence cutoff and proposed activation; writer containment/review | ______ |

Review raw exact values and possible normalization/printing ambiguities privately;
do not publish codes linked to people. Repository generators and current zero row
counts cannot prove absence of historical arbitrary-text assignments. Previously
reported RCPT2026≥14 and STU2026≥5 are lower bounds; FAM history remains unknown.
These legacy unknowns must not become guessed floors or a fabricated certificate.

**Non-use conclusion — choose one:**

- [ ] Evidence establishes that no historical channel issued or reserved a value
      overlapping the approved IPSM namespace through the stated cutoff.
- [ ] Coverage is incomplete; historical non-use cannot be certified. Keep hold.
- [ ] An overlap or ambiguous ownership exists; retain private evidence and stop
      activation pending an explicitly reviewed resolution. Do not silently renumber.

Supporting complete non-use manifest SHA-256: ______
Unresolved exclusions (must be none for certification): ______

**Separate recovery completeness record:** backup/recovery point ______;
independent post-backup issuance journal/document coverage ______;
known legacy exact-value/owner reservations and unresolved ownership ______;
reviewed restoration/import manifest reference and SHA-256 ______;
verified restore integrity and immutable reservation retention ______;
control preventing an issuance gap before activation ______.

Recovery conclusion: [ ] complete and evidenced  [ ] incomplete — keep hold
Complete recovery-evidence manifest SHA-256: ______

Business owner decision/signature/date: ______
DBA evidence/recovery review/signature/date: ______

A hash authenticates a particular document, not the truth of its claims. Do not
supply dummy hashes or reuse synthetic staging evidence. If either conclusion is
incomplete, Production IPSM_IDENTIFIER_ACTIVATION_ID remains absent and no enabled
production attestation may be created. Even a completed certificate is evidence
for a later separately controlled activation; it is not activation itself.

## B. Financial-owner acknowledgement of historical payroll audit orphans

Record ID: ______  UTC review time: ______
Financial owner / authority: ______
Private administrator Query14 report reference/time/hash: ______
Changed evidence since that snapshot, if any: ______

> I acknowledge the reported three historical payroll audit events referencing
> absent records, and zero current payroll/payroll-expense rows at that reported
> snapshot. This is not a fresh population check. Available evidence cannot establish
> why those records disappeared, whether their deletion was legitimate, or reconstruct
> their postings. PR90 preserves the three events and does not create transactions,
> links or balances to fill the gap. My decision concerns acceptance of this stated
> historical limitation; it does not certify accounting completeness, authorize audit
> deletion or permit an invented financial reconciliation.

Decision: [ ] accept the documented limitation for release review
          [ ] require further historical investigation — release sign-off pending
Conditions / investigation owner and evidence needed: ______
Financial owner signature/date: ______

No engineer, test result or generic project authorization supplies this financial
acceptance automatically. Keep the original audits unchanged under either decision.

**Evidence available for record B:** actual archive recovery verified on
2026-11-09T14:05:19Z preserved all 505 audits and the three historical payroll
events. Of those three, two lack an expense-reference key; all reference absent
payroll/expense records. Restored current payroll/payroll-expense counts are zero.
The two missing references overlap the three events; they are not five events.
The existing read-only Query14 still classifies the historical findings as BLOCKER.
Financial acknowledgement accepts the documented historical limitation only;
any new live inconsistency remains a blocker. No signature or fresh live-population
claim is supplied by this snapshot verification.

## C. Scoped recovery and maintenance admission — owner/release operator

Record ID / date: ______  Owner / release operator: ______
Approved application SHA/artifact and scope (PR90; optionally separately approved PR92): ______
Maintenance window and effective ingress/job/import/direct-client hold: ______
Recovery operator and confirmed privileges for the affected objects: ______
Private backup custody / approved recovery point / post-backup change coverage: ______
Explicit permitted data-loss boundary (do not assume zero or accept unreviewed loss): ______

- [ ] Accept the existing-platform, pre-activation recovery boundary in admission
      section 1, retaining Supabase-managed services. No full-platform recovery
      claim; escalate if retained services fail or a safe object restore is unavailable.
- [ ] Accept continued maintenance and identifier hold after the three deltas and
      compatible application rollout. No ordinary registration/payment reopening,
      old-writer fallback or enabled attestation is authorized by this admission.
- [ ] Alternatively, defer installation until normal-service admission, including
      record A and a separate activation decision, is possible.

Selected option / conditions / recovery decision authority: ______
Owner approval / operator acknowledgement / date: ______

Acceptance here is a prepared decision record, not an executed release command.
Merge, deployment, Production migration execution, restoration and activation must
remain within their separately authorized scope. Record A remains mandatory before
identifier activation even if maintenance-only installation is approved.
