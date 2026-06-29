# IPSM Music School Management System

Production-ready MVP for internal administration of a private music school. Development is incremental by phase.

## Phase 1 implemented

- Supabase email/password authentication routes: `/login` and `/forgot-password`.
- Middleware-protected application routes.
- Admin and Reception role definitions with permission checks.
- Initial Prisma schema for user profiles and audit logs.
- Placeholder authenticated dashboard for the Phase 2+ metrics.

## Local setup

1. Copy `.env.example` to `.env.local` and fill Supabase/PostgreSQL values.
2. Install dependencies with `npm install`.
3. Generate Prisma client with `npm run prisma:generate`.
4. Run checks with `npm run typecheck` and `npm test`.
5. Start the app with `npm run dev`.
