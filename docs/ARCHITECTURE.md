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

Phase 3 should not add feature code until the database review is approved. The main architectural decision is whether future billing features should stay with the MVP family-payment allocation model or introduce formal statements with line items and allocation rules.

## Production Reset integrity

The six Production Reset presets use an actor-bound, expiring server preview and
a repeatable-read preview snapshot. Execution rechecks that preview under an
ordered table write barrier inside a serializable transaction. Explicit
Financial Data is required for financial deletion. Protected identifier ledgers
and registration tombstones survive resets. See [Production Reset](PRODUCTION_RESET.md)
and [database verification](PRODUCTION_RESET_DATABASE.md) for scope, concurrency,
migration limitations and the staged eight-category expansion.
