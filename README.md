# IPSM Music School Management System

Production-ready MVP for internal administration of a private music school. The app is built with Next.js, Prisma, PostgreSQL/Supabase, and Supabase Auth.

## MVP capabilities

- Supabase email/password authentication routes: `/login` and `/forgot-password`.
- Middleware-protected application routes with server-side session checks.
- Admin and Reception role definitions with permission checks.
- Family, student, teacher, season, enrollment, payment, receipt, expense, and report workflows.
- Payment allocation validation, receipt PDF download, and admin-only payment voiding.
- Audit logs for sensitive create/update/archive/export actions.
- Deployment and QA documentation in `docs/DEPLOYMENT.md` and `docs/QA_CHECKLIST.md`.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` and fill in the required values:

   ```bash
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   ```

3. Apply database migrations to your Supabase/PostgreSQL database. For local-only development, use your team's preferred Supabase CLI or SQL editor flow with files in `supabase/migrations/`.

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Run verification checks:

   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:3000` and sign in with a Supabase Auth user whose role metadata is `ADMIN` or `RECEPTION`.

## Environment and secrets

- `.env`, `.env.local`, and `.env*.local` files are ignored by Git.
- Do not commit Supabase service-role keys, database passwords, access tokens, or Vercel tokens.
- Only variables prefixed with `NEXT_PUBLIC_` are intended for browser exposure.
- See `docs/DEPLOYMENT.md` for the production environment variable checklist.

## Deployment

- Supabase deployment checklist: `docs/DEPLOYMENT.md`.
- Vercel deployment checklist: `docs/DEPLOYMENT.md`.
- Final MVP QA checklist: `docs/QA_CHECKLIST.md`.

Before promoting to production, confirm:

```bash
npm run typecheck
npm test
npm run build
```

## Documentation

- `docs/ARCHITECTURE.md` — application architecture notes.
- `docs/API.md` — API/export route notes.
- `docs/BUSINESS_RULES.md` — domain and workflow rules.
- `docs/DATABASE.md` — database overview.
- `docs/DEPLOYMENT.md` — deployment and security checklist.
- `docs/QA_CHECKLIST.md` — final MVP QA checklist.
