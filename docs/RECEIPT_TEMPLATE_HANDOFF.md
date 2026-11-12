# Receipt template handoff — no fixed template activated

The owner approved a dynamic, A5-only Receipt V4 using the complete original logo.
See [the V4 rendering contract and review procedure](RECEIPT_V4_A5.md).
`lib/payments/receipt-renderer.ts` remains the narrow rendering boundary; it now awaits
V4's PDF serialization. Payment lookup, repair/idempotency, authoritative family
balances, audit and safe error responses remain in the authenticated route.

No administration PDF template has been supplied or activated. V4 is measured flow
layout, not a fixed template. All active output is A5, including legacy A4 requests;
A4 two-copy behavior is retained only in legacy utilities, not the application API.
The unchanged original JPEG and separate official PNG stamp are embedded independently.

A future template proposal must identify ownership, revision, A5 print margins, font
permissions, complete dynamic-field coverage and overflow behavior. Owner visual
approval must precede any replacement. Do not add an upload/template switch, omit
financial rows or relax stamp/branding failures as a fallback. A future renderer must
remain database-free and return a PDF buffer or the typed rendering error.
