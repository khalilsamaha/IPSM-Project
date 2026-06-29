# Architecture Documentation

## Application Stack

- Next.js app router for UI routes.
- Supabase for authentication and Postgres hosting.
- Prisma as the database schema/client layer.
- Vitest for business logic tests.
- Tailwind CSS for styling.

## Current Module Boundaries

- `app/` contains pages and route groups.
- `components/` contains reusable UI and form components.
- `actions/` contains server actions.
- `lib/auth/` contains authorization/session helpers.
- `lib/dashboard/` contains dashboard query and metric logic.
- `prisma/` contains the Prisma schema and TypeScript seed script.
- `supabase/migrations/` contains SQL migrations for Supabase/Postgres.
- `docs/` contains architecture, API, business rules, and database review documentation.

## Phase 3 Architecture Gate

Phase 3 should not add feature code until the database review is approved. The main architectural decision is whether Phase 3 billing and enrollment features will use the existing simple invoice/enrollment model or introduce normalized seasons, teachers, invoice lines, and payment allocations.
