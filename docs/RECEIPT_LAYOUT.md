# Receipt PDF Layout

Receipts are generated from the original payment record and reuse the payment receipt number on every download or reprint.

## Routes

- `/api/receipts/[paymentId]?layout=a5` prints one A5 portrait receipt per PDF page.
- `/api/receipts/[paymentId]?layout=a4-two-copies` prints a Customer Copy and School Copy on one A4 page when the allocation table fits. The same receipt number is printed on both copies; no second payment or receipt record is created.

## A5 Layout

A5 pages use a `420 × 595` point MediaBox with safe margins, a school/logo area, receipt metadata, payer/student details, allocation table, totals, amount in words, received-by, signature/stamp area, and school contact placeholder.

The generator wraps long values rather than relying on fixed-character truncation. Allocation rows use dynamic heights based on wrapped course/student text. If rows do not fit in the available A5 table area, the generator creates a continuation A5 page and prints every allocation.

## A4 Two-Copy Layout

The two-copy layout embeds the A5 receipt twice on an A4 `595 × 842` point page, with Customer Copy above School Copy and a dashed cut line between them. If a very long allocation list needs continuation pages, the generator emits continuation pages rather than omitting rows.
# Official stamp asset

`public/assets/receipts/ipsm-official-stamp.png` is the production receipt stamp derived from the supplied authorized scan. Processing cropped away the complete CamScanner footer, removed the cream paper background and isolated scan speckles, preserved the source black IPSM mark and original blue signature in their original relative positions, and exported an RGBA PNG with minimal transparent padding. Because the repository's pull-request workflow does not accept binary files, neither the JPG scan nor the processed PNG is committed: deployment must provision the processed PNG at that exact path.

The authoritative receipt service reads this asset on the server and embeds it with a PDF transparency soft mask on every A5 logical receipt page and on both customer and school copies. Missing, unreadable, or unsupported stamp data causes a controlled receipt-generation error rather than an unstamped official receipt.
