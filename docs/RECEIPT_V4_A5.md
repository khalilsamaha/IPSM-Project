# Receipt V4 — measured A5, complete official branding

V4 is a rendering-only replacement behind `lib/payments/receipt-renderer.ts`.
The authenticated API still owns payment lookup, receipt-number repair/idempotency,
family-balance construction, download/reprint/void auditing and safe failure responses.
No payment calculations, stored records, schema, migration, identifier or reset code changes.

## Output and compatibility

Every page is portrait **148 × 210 mm** (419.527559 × 595.275591 points).
The API normalizes every layout request, including old `?layout=a4-two-copies`
links, to `a5` and audits the actual `a5` layout. The rendering boundary also ignores
legacy layout arguments. The payment detail page offers A5 and reprint downloads;
other download/share links continue to work. V1/V2/V3 legacy utilities and their
existing regression tests remain available but are not the active receipt API.

The renderer is asynchronous and returns a PDF Buffer or `ReceiptGenerationError`.
`pdf-lib` 1.17.1 is pinned for actual Helvetica text measurement, safe binary image
embedding, page/resource construction and byte-correct serialization. Its API
[documents JPEG embedding and font measurement](https://pdf-lib.js.org/docs/api/classes/pdfdocument).
No fixed template, uploaded PDF, external resource, script or network request is used.

## Complete data and pagination

The existing authoritative balance helpers and amount-in-words conversion are reused.
Payer, family name/code, all available contact values, Cash/Whish, receiving staff,
paid activities/levels/seasons, total paid and family remaining balance flow without
truncation. Each authoritative balance row includes student name/code and its full
activity/level/season description, with unchanged before/paid-now/remaining amounts.
The helper's student-level aggregation is preserved: V4 does not invent per-enrollment
financial allocations or suppress zero-paid rows.

Text wraps using actual font widths, including long unbroken codes/emails. Rows use
measured line counts at a stable 8.5-point body size; numeric columns are measured and
right-aligned. Summary text can itself continue across pages. Table headings appear
only with row content and repeat on table continuation pages. Every page carries the
complete logo, title, number/date/status and `Page n of N`.

The final row is kept with totals/footer where space allows. An unusually tall single
row can split across pages, labelled as continued detail; its financial values appear
only on its first fragment. Final family totals, full amount in words, original
confirmation text and official stamp appear **once, on the final page**. Intermediate
pages explicitly direct the reader to that page, never presenting a subtotal as final.
Voided receipts show `VOIDED COPY` on every page and an additional final-page disclaimer.
A direct caller cannot override a payment's voided state with an original mode.

## Logo and stamp

The original `public/assets/branding/ipsm-logo-original.jpg` is untouched. SHA-256:
`ce96d609dc682392b5b98dfa1057c351ad40ada7d7534352ec7f4c3708b337f4`.
The renderer verifies this hash and embeds the original JPEG bytes as a DCT image.
No JPEG is converted through UTF-8, re-encoded or replaced. PDF clipping removes only
blank margins: reviewed ink bounds x149–920/y264–816 in the 1070-square image are
surrounded by twelve pixels of padding (clip x137/y252, width796/height577).
Fingerprint, IPSM wordmark and full institute name remain visible. No derived asset
is committed. The logo appears at a 118-point visible width on every page.

V2's existing stamp reader/validator is exported unchanged and reused directly rather
than extracting objects from an entire throwaway PDF. The RGB and alpha streams remain
separate, with a PDF soft mask. The stamp is not replaced by the logo, and is never
silently omitted. Next.js output tracing includes both official assets.
Missing/unreadable/corrupt logo produces a specific typed error. Existing stamp error
codes remain intact; the API returns its existing safe failure message, leaving the
payment recorded. Accented Latin characters now survive instead of V3's ASCII dash
substitution. **Helvetica/WinAnsi does not support Arabic or other non-Latin scripts**:
unsupported characters produce `TEXT_UNSUPPORTED` and a safe API error, not a lossy PDF.
A licensed Unicode font/shaping design would need separate review if those names must
be printed. No such font or transliteration policy is silently introduced here.

## Reproduce synthetic review artifacts

```bash
npx tsx tools/receipts/generate-samples.ts /tmp/ipsm-receipt-v4-review
python3 tools/receipts/verify-samples.py /tmp/ipsm-receipt-v4-review
```

The second command requires Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`). It independently
parses every page size and text bounding box, rejects out-of-margin or overlapping
words, and rasterizes **every** V4 page. All data is synthetic; neither command reads
a database or credentials. PDFs/PNGs remain outside the repository and Production
storage. `verification.json` records the results. V3 comparison PDFs use the same inputs.

Review examples: 1 student/1 activity, 3 students including multiple enrollments and
zero-paid/full/partial balances, 6 and 10 rows, 24 long-name rows, 100 activities in one
row, Whish reprint and void copies. All 18 rendered V4 pages were inspected: complete
branding, aligned amounts, wrapped labels, repeat headers, final totals/stamp and margins
show no overlap or clipping. The long-name 24-row sample uses 6 A5 pages; the oversized
single-row sample uses 4. The one- and three-student samples each use one page.

Automated coverage also includes 2/5 students, 250-activity overflow, an oversized
family summary, maximum BIGINT receipt number, original/reprint/void modes, unchanged
financial inputs, exact embedded JPEG bytes, independent stamp/alpha, missing/corrupt
assets, unsupported text, authentication, safe API failure and actual A5 audit metadata
for legacy A4 links. Local validation and hosted CI results are recorded in the PR.

Owner visual and functional approval is required before merge or Production deployment.
This branch may receive only the normal Vercel Preview deployment; no live receipt
requests, fabricated payments, Production mutations or database migrations are needed.

## Owner-requested alignment refinement (2026-11-13)

The identity block moves 12 points right and aligns its last baseline near the logo's
lower edge, retaining the logo size and normal header height. Two 4-point gaps separate
family/contact, payment context and the bold summary. No other rendering/business
behavior changes. Refreshed samples are in `/tmp/ipsm-receipt-v4-refined`; all eight
sample page counts and extracted monetary sequences match the original V4 examples.
See [refinement evidence](evidence/receipt-v4-layout-refinement.json). Original review
artifacts and evidence are retained.
