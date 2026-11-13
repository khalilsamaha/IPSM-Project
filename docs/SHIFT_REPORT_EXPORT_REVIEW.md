# Shift-report completeness — comparison with receptionist's daily workbook

## Scope (review-only application changes)

This change improves reporting for **already recorded** IPSM shifts, without altering financial calculations, database schema, transaction posting, or Production settings. The owner's workbook has two sheets: `Paiet des clients` (student payments/expenses/cash handed over) and `vente inst. livres` (instrument and book sales). The existing IPSM cashier shift workflow already calculates cash/Whish receipts, expenses/payroll, expected vs declared cash, variance and close/reopen audit history.

### Improvements

1. The closing-shift PDF no longer uses a one-page, first-70-lines cutoff. It renders every section on measured, multi-page A4 (shift report format, **not** the independently enforced A5-only payment receipt). Long fields wrap, sections flow to additional pages, and every page shows its shift ID and page number.
2. Closed-shift CSV and PDF now include existing student codes/names, course/activity and level, seasons, payment notes and individual allocations for each receipt, without changing payment totals or introducing new payment records.
3. The on-screen closing report includes this transaction context.
4. The general Shift Closures CSV includes **all** filtered shifts, rather than silently exporting the default 25-row page.
5. Filtered shift-closure summary totals use **all** matching shifts even when the screen is paginated; the existing shift calculation helper remains authoritative.

### Unchanged behavior

- Receipt V4 A5-only output, branding and stamp
- Cash expected = opening cash + valid cash payments - active cash expenses
- Whish separately tracked, payroll separated, void/archived treatment
- Close/reopen authorization, receipts, numbering, audits and database migrations
- Existing CSV section names and original fields (new payment detail columns are appended)
- Shift CSV/PDF export still requires a closed or auto-closed shift and existing report permission
- No Production Reset, historical data rewrite or Vercel Production configuration changes

### Excluded future requirements

The user's spreadsheet also tracks LBP, exchange rates, expense invoice numbers, and instrument/book merchandise sales with quantities. These are **not** merely display fields in the current data model. They are excluded pending separate business decisions about actual LBP collections, currency exchange/reconciliation and whether merchandise sales require an inventory workflow. Do not invent transactions or mislabel tuition as merchandise revenue.

### Validation

Use `npm run typecheck`, `npm test`, `npm run test:migration` and `npm run build` in GitHub CI. Focused tests cover more than 70 PDF lines, complete 270-shift filtered results, detailed allocation metadata and stable cash/Whish calculations. Review the generated Preview and use synthetic fixtures only; no fabricated payments or expense entries in Production.
