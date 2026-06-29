# API Documentation

This project currently uses server-side data access helpers and Supabase/Prisma database access rather than a versioned public REST or GraphQL API.

## Current Auth and Data Access Surface

- Authentication actions live in `actions/auth.ts` and support login, logout, and password reset flows.
- Server Supabase client creation lives in `lib/supabase/server.ts`.
- Role and session helpers live in `lib/auth/roles.ts` and `lib/auth/session.ts`.
- Dashboard data access lives in `lib/dashboard/data.ts` and dashboard metric calculations live in `lib/dashboard/metrics.ts`.

## API Design Requirements Before Phase 3

Before implementing new Phase 3 endpoints or actions, document the contract for:

1. Families and students CRUD.
2. Season enrollment creation and updates.
3. Teacher assignment and reassignment.
4. Payment creation, enrollment allocation, and receipt generation.
5. Reporting endpoints for revenue, balances, expenses, and enrollment rosters.
6. Audit log writes for financial and enrollment changes.

## Error Handling Standard

Future API actions should return typed success/error shapes, avoid leaking database internals to users, and include audit logging for changes to financial or enrollment records.
