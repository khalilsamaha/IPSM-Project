# Receipt template handoff — no template activated

The current authenticated `app/api/receipts/[paymentId]/route.ts` retains its payment
lookup, receipt-number repair/idempotency, family-balance snapshot, reprint audit,
void-copy selection and safe failure responses. `lib/payments/receipt-renderer.ts`
is the narrow rendering boundary and points directly to `buildReceiptPdfV3`.
The existing A5 and A4 two-copy engine, pagination and stamp checks are unchanged.

An administration-provided PDF is **not yet supplied or approved**. No upload,
custom-template selection, alternate engine or template environment switch exists.
The logo source is `public/assets/branding/ipsm-logo-original.jpg`, SHA-256
`ce96d609dc682392b5b98dfa1057c351ad40ada7d7534352ec7f4c3708b337f4`.
It is used unchanged in login/sidebar/browser icons. The stamp remains its separate
existing PNG; a logo must never satisfy the stamp requirement. Receipt-logo placement
and any derived print asset await the approved template, rather than changing the
working PDF during this interface-only preparation.

Before a future renderer can be approved, administration must supply the exact PDF,
its revision/ownership, A5 dimensions, print margins and font permissions; identify
variable-field and stamp/logo areas; and approve visual A5 and A4 two-copy proofs.
The renderer consumes the existing `ReceiptPaymentV2`, layout and mode arguments;
it must not query the database, allocate identifiers or mutate payments. Keep the
current route as the authority and return a PDF buffer or the existing typed safe
rendering error. Do not accept active scripts, external URLs or embedded payloads.

Acceptance cases: long names, multiple students/courses, many-page balances,
legacy and IPSM receipt numbers, Cash/Whish, partial/full payment, discounts,
voided copy, reprint, both copies on every A4 page, overflow and clipping, accurate
balances, missing/unreadable stamp failure, and original-vs-template visual approval.
Until those proofs are approved, use the current renderer without a fallback that
silently omits the stamp or financial fields.
