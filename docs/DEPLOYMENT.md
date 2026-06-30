# Deployment Guide

This checklist prepares the IPSM Music School Management System MVP for Supabase and Vercel production deployment.

## Security and access review

- All application pages are protected by `middleware.ts`; unauthenticated users are redirected to `/login`.
- Public routes are limited to `/login` and `/forgot-password`.
- Server pages and API routes also call `requireSession()` before reading or exporting private school data.
- Reception users can create and update operational records through `records:write`.
- Admin users inherit reception permissions and can additionally void payments through `finance:delete`.
- Report exports require `reports:read`.
- Keep service-role keys out of browser code. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed client-side.

## Required environment variables

Create these variables in `.env.local` for local development and in Vercel Project Settings for production:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase pooled or direct PostgreSQL connection string used by Prisma. |
| `DIRECT_URL` | Recommended | Direct Supabase database URL for migrations when using a pooled `DATABASE_URL`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key. Safe to expose but still project-specific. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Only add if future server-only maintenance scripts require it. Never expose with `NEXT_PUBLIC_`. |

`.env`, `.env.local`, and other local env variants are ignored by Git. Do not commit real credentials, database URLs, Supabase access tokens, or Vercel tokens.

## Supabase deployment checklist

1. Create or select the production Supabase project.
2. Confirm email/password authentication is enabled.
3. Configure allowed redirect URLs for the production Vercel domain and local development URL.
4. Apply migrations in order from `supabase/migrations/` using the Supabase CLI or SQL editor.
5. Run `npm run prisma:generate` after migrations are available locally.
6. Seed only non-sensitive demo data if needed; do not seed real credentials.
7. Create staff users in Supabase Auth.
8. Set user role metadata to `ADMIN` or `RECEPTION` in `app_metadata.role` where possible.
9. Verify Row Level Security policy strategy before exposing additional direct client database reads. Current application data access is server-side.
10. Test login, record creation, payment creation, receipt download, reports export, and admin-only payment voiding.

## Vercel deployment checklist

1. Import the repository into Vercel.
2. Set Framework Preset to Next.js.
3. Add all required environment variables from the table above.
4. Ensure production `DATABASE_URL` points at the production Supabase database.
5. Keep build command as `npm run build`.
6. Keep install command as `npm install` unless the team standardizes on another package manager.
7. Deploy a preview build first and run the QA checklist.
8. Promote to production only after `npm run typecheck`, `npm test`, and `npm run build` pass.
9. After production deployment, verify authentication redirects, role-specific actions, and CSV/PDF downloads on the live URL.

## Pre-release command checklist

Run these commands before deploying:

```bash
npm run typecheck
npm test
npm run build
```

## Rollback plan

- Use Vercel's previous deployment promotion for application rollback.
- For database issues, avoid destructive hotfixes. Restore from Supabase backups or apply a forward migration that preserves data.
- Rotate any credential that may have been exposed in logs or local screenshots.
