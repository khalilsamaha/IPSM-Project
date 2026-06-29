# IPSM Music School Management System

Production-ready MVP for internal administration of a private music school. Development is incremental by phase.

## Phase 2 implemented

- Supabase email/password authentication routes: `/login` and `/forgot-password`.
- Middleware-protected application routes.
- Admin and Reception role definitions with permission checks.
- Initial Prisma schema for user profiles and audit logs.
- Phase 2 operational data model for families, students, enrollments, invoices, payments, and expenses.
- Dashboard metrics backed by Prisma aggregate-ready records.
- Supabase SQL migration for applying Phase 1/2 tables directly to a Supabase project.

## Local setup

1. Copy `.env.example` to `.env.local` and fill Supabase/PostgreSQL values.
2. Install dependencies with `npm install`.
3. Generate Prisma client with `npm run prisma:generate`.
4. Run checks with `npm run typecheck` and `npm test`.
5. Start the app with `npm run dev`.


## Supabase deployment notes

Apply `supabase/migrations/20260629000000_phase_2_operations.sql` with the Supabase CLI or SQL editor after configuring the project connection. This repository does not contain Supabase access tokens or linked project metadata, so direct remote application requires environment-specific credentials.
