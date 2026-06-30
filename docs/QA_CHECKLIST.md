# Final MVP QA Checklist

Use this checklist before promoting the IPSM MVP to production.

## Authentication and authorization

- [ ] Logged-out users visiting `/dashboard` are redirected to `/login`.
- [ ] Logged-in users visiting `/login` are redirected to `/dashboard`.
- [ ] Admin can access dashboard, records, payments, expenses, reports, and payment void action.
- [ ] Reception can access dashboard, records, payments, expenses, and reports.
- [ ] Reception cannot see or perform payment void actions.
- [ ] Sign out returns the user to `/login`.

## Records workflows

- [ ] Family create form shows browser validation for required/invalid fields.
- [ ] Student create form requires a family and student name.
- [ ] Teacher create form validates email and numeric rate fields.
- [ ] Season create form validates required dates.
- [ ] Enrollment create form validates required student, season, course, and fee fields.
- [ ] Archive/end actions show a confirmation prompt before submitting.
- [ ] Empty or filtered lists remain understandable and do not show console errors.

## Payments and receipts

- [ ] Create payment requires a selected family.
- [ ] Allocation cannot exceed remaining enrollment balance.
- [ ] Successful payment creation redirects to payment detail with success feedback.
- [ ] Payment validation errors show clear user-facing messages.
- [ ] Receipt PDF downloads successfully.
- [ ] Admin void action shows a confirmation prompt and reverses allocations.
- [ ] Voided payments are visually marked as void.

## Expenses

- [ ] Expense creation requires category, date, amount, and description.
- [ ] Expense filter form works for date range, category, payment method, and archived toggle.
- [ ] Expense edit form loads existing values.
- [ ] Expense archive action shows a confirmation prompt.

## Reports

- [ ] Revenue, outstanding, expenses, profit/loss, and teacher salary report pages load.
- [ ] CSV exports require authentication.
- [ ] CSV exports contain the expected headers and filtered rows.

## Responsive and polish

- [ ] Primary navigation scrolls or wraps on mobile without overlapping content.
- [ ] Forms are usable on mobile/tablet and desktop.
- [ ] Tables remain horizontally scrollable on narrow screens.
- [ ] Loading state appears during route transitions where Next.js streams page loads.
- [ ] No console errors appear during normal create, filter, export, archive, or void workflows.

## Deployment readiness

- [ ] `.env` and `.env.local` are not tracked by Git.
- [ ] No Supabase service-role keys, database passwords, or access tokens are committed.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Vercel environment variables match production Supabase values.
- [ ] Supabase migrations have been applied in production.
