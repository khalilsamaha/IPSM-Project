# Deployment Guide

This guide prepares the IPSM Music School Management System MVP for production on Supabase and Vercel.

## Production readiness summary

- Protected routes: `middleware.ts` redirects unauthenticated users away from every non-public route.
- Public routes: `/login` and `/forgot-password` only.
- Server-side authorization: pages, actions, and API routes call `requireSession()` before accessing private data.
- RBAC: `ADMIN` and `RECEPTION` are the only supported roles.
- Admin-only capability: payment voiding and user management.
- Reception capability: operational record entry, payments, expenses, scheduling, and reports.
- Secrets: never commit database passwords, service-role keys, access tokens, or Vercel tokens.

## Required environment variables

Create these variables in local `.env.local` and in Vercel Project Settings for Preview and Production environments.

| Variable | Required | Scope | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Server | Supabase transaction pooler connection string for Prisma runtime on Vercel. Use port `6543` and append `?pgbouncer=true&connection_limit=1` to keep serverless connection usage low. |
| `DIRECT_URL` | Recommended | Server | Supabase session/direct PostgreSQL connection for migrations and direct operations. Use port `5432`; do not add PgBouncer parameters. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser/server | Public Supabase project URL. Safe for browser exposure. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/server | Public anon key. Safe for browser exposure but still project-specific. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Required by Admin User Management server actions for Supabase Admin API operations. Never prefix with `NEXT_PUBLIC_`, expose to browser code, commit, or log it. |

Local env files are intentionally ignored by Git. Confirm `.gitignore` contains `.env` and `.env*.local` before adding credentials.

### Prisma connection handling on Vercel/Supabase

Use Supabase's transaction pooler for serverless runtime traffic and keep Prisma's per-function connection usage intentionally small:

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

- `DATABASE_URL` must use the Supabase transaction pooler on port `6543` with `?pgbouncer=true&connection_limit=1` for Vercel deployments.
- `DIRECT_URL` should use the Supabase session/direct connection on port `5432` for migrations and Prisma direct connections.
- Application code must import the shared Prisma singleton instead of constructing `PrismaClient` in pages, components, server actions, or route handlers.

## Supabase setup

1. Create or select the production Supabase project.
2. In Authentication settings, enable email/password authentication.
3. Add redirect URLs for:
   - Production Vercel domain, for example `https://your-app.vercel.app/**`.
   - Any custom production domain.
   - Local development, for example `http://localhost:3000/**`.
4. Bootstrap the first administrator account in Supabase Auth and `public.users`, linking `auth.users.id` to `public.users.auth_id`. The application user table is `public.users`; do not create or seed a separate `user_profiles` table for app RBAC.
5. After the first Admin can log in, use `/users` to create additional Admin or Reception users.
6. Confirm the anon key is used only through `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
7. Confirm the service-role key exists only in server-side environment variables and is never exposed to browser code.

## SQL migration steps

Apply migrations in timestamp order from `supabase/migrations/`.

1. Install and authenticate the Supabase CLI if using CLI-based deployment.
2. Link the project if needed: `supabase link --project-ref <project-ref>`.
3. Review migration files locally and confirm they target the intended production project.
4. Apply migrations using the Supabase CLI or the Supabase SQL editor in this order:
   - `20260629000000_phase_2_operations.sql`
   - `20260629010000_phase_3_database_review_indexes.sql`
   - `20260629020000_season_billing_refactor.sql`
5. Generate Prisma client locally after schema changes: `npm run prisma:generate`.
6. Run a migration smoke test against a preview database before production.
7. Seed only non-sensitive demo data if required; never seed real credentials.
8. Verify schema alignment for families, students, teachers, seasons, enrollments, payments, payment items, expenses, audit logs, and schedule sessions.

## Storage bucket setup

The current MVP generates receipt PDFs on demand and streams report CSVs from authenticated API routes. No persistent bucket is required for the default deployment.

If the production operation chooses to archive generated receipts or exports in Supabase Storage later:

1. Create a private bucket, for example `receipts` or `exports`.
2. Keep the bucket private; do not use a public bucket for financial documents.
3. When managing buckets with SQL, reference the Supabase Storage buckets table as `storage.buckets` (schema-qualified identifier), not `'storage.buckets'` (a string literal).
4. Add server-side upload/download logic only after defining storage RLS policies.
5. Grant access through authenticated server routes, not direct public object URLs.
6. Document retention policy, backup expectations, and deletion workflow before storing production financial documents.

To create or repair the private receipts bucket in the Supabase SQL editor, run:

```sql
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update
set
  name = excluded.name,
  public = false;
```

## Vercel deployment steps

1. Import the repository into Vercel.
2. Set Framework Preset to Next.js.
3. Use `npm install` as the install command unless the team standardizes on another package manager.
4. Use `npm run build` as the build command.
5. Add all required environment variables for Preview and Production.
6. Confirm `DATABASE_URL` points to the matching Supabase environment for each Vercel environment.
7. Deploy a Preview build.
8. Run the full `docs/QA_CHECKLIST.md` against the Preview URL.
9. Promote to Production only after typecheck, tests, and build pass.
10. After production deployment, smoke test login, dashboard, record creation, scheduling validation, payment creation, receipt download, reports export, and admin-only voiding.

## RBAC verification matrix

| Area | Admin | Reception |
| --- | --- | --- |
| Dashboard | Allowed | Allowed |
| Families/students/teachers/seasons/enrollments | Allowed | Allowed |
| Schedule | Allowed | Allowed |
| Payments and receipts | Allowed | Allowed |
| Void payments | Allowed | Denied |
| Expenses | Allowed | Allowed |
| Reports and CSV export | Allowed | Allowed |
| Users page | Allowed | Denied |

## Payment and schedule production checks

- Payment creation validates family ownership, positive allocations, and allocation amounts not exceeding remaining balances.
- Payment creation updates enrollment paid and remaining balances in a transaction.
- Receipt downloads require authentication and create audit entries.
- Payment voiding requires Admin `finance:delete`, reverses allocations in a transaction, and records audit metadata.
- Schedule session validation rejects invalid time ranges.
- Schedule save logic must reject overlapping active sessions for the same teacher or student on the same date.

## Pre-release command checklist

Run these commands before deploying:

```bash
npm run typecheck
npm test
npm run build
```

## Rollback plan

- Application rollback: promote the previous successful Vercel deployment.
- Database rollback: prefer forward-only corrective migrations that preserve data. Use Supabase backups only after confirming data loss risk and recovery point.
- Credential incident: rotate exposed credentials immediately in Supabase and Vercel, then redeploy.
- Failed release: disable new traffic by rolling back Vercel first, then investigate Supabase logs, Vercel function logs, and audit logs.

## Optional student family migration

Migration `20260703000000_optional_student_family_workflow.sql` makes `students.family_id` nullable and changes the foreign key to `ON DELETE SET NULL`. Apply it with the normal Supabase/Prisma migration process before deploying code that creates independent students.

## Phase 10 pre-deployment gates

Run `npm run typecheck`, `npm test`, and `npm run build` before promoting a release. After deployment, sign in as Admin and Reception to verify route authorization and review `/admin/diagnostics` for data-integrity warnings.
