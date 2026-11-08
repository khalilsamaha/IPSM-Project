# PR90 — exact isolated staging provisioning/change procedure

No isolated Supabase Auth/database resource or authorized runtime SQL session was
available to this review. The IPSM connector denied history/branch discovery.
Metadata-only Vercel inspection still shows DATABASE_URL, DIRECT_URL,
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
shared across Production/Preview. No secret values were retrieved or changed.

## Administrator procedure (requires separate resource/configuration approval)

1. Select an already-owned, explicitly non-production Supabase project/branch with
   **independent PostgreSQL 17 and Auth users/sessions**, or approve provisioning
   one after reviewing its cost. A separate database against production Auth is
   not isolated. Do not substitute an unrelated project or purchase resources
   under this task. Record only the approved project/branch reference and purpose.
2. Use its existing secure administrator connection to check current_database(),
   current_user, session_user and server_version in a READ ONLY transaction. Verify
   the connection context against the chosen Dashboard project, not just a generic
   database named postgres. Keep URLs/passwords/API keys in the secret manager.
3. Reconstruct a sanitized schema using the reviewed fixture/release inputs, with
   genuine existing history handled separately. Import **no** production people,
   financial rows, Auth identities, Storage objects or credentials. Create only
   synthetic test users in the isolated Auth project through approved Auth tooling.
4. In Vercel IPSM Project Settings → Environment Variables, prepare **Preview-only**
   replacements for all five listed variables from that same isolated project.
   Remove Preview targeting from the shared entries without changing their
   Production target/value. Ensure branch-specific entries cannot override these
   with production connections. Perform these changes only after explicit approval;
   never use an all-environments CLI command or publish values/screenshots.
5. Leave IPSM_IDENTIFIER_ACTIVATION_ID absent until synthetic staging certification
   is explicitly approved; then select only that staging database’s current enabled
   attestation. Never share this binding with Production. Isolate Auth site/redirect URLs to the selected staging domain; disable or sandbox
   email delivery, cron jobs, external payments, Storage and webhooks. No production
   service-role key, session or callback should be used by staging.
6. Verify the deployed Preview's actual connection and Auth project context through
   an already-authorized private session. Do not deploy a public diagnostic endpoint.
   If no such session exists, record the remaining verification rather than guess.
7. Apply only the reviewed ordered future delta to the disposable staging schema
   after staging authorization. Use synthetic attestations only there; never copy a
   staging activation UUID/certificate into Production. Keep the normal reset
   environment gate closed in Preview. Reset executor tests use the verified local
   disposable factory, never spoofed VERCEL_ENV=production.
8. Run the PG17 tests, normal synthetic registration/payment/receipt flows, restore
   checks and permission postchecks. Record actual role names, safe project metadata,
   test results and package hashes. No secrets or private production records in CI.

The local runner is immediately reproducible with
`PG_BIN=/usr/lib/postgresql/17/bin npm run test:migration`. It owns a fresh marked
loopback cluster and synthetic Auth stand-ins; it does **not** validate a real
Supabase Auth integration. A real isolated Auth resource remains an administrator
provisioning/access gate.
