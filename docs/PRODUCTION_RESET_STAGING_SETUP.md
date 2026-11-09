# PR90 — exact isolated staging provisioning/change procedure

> Current operational evidence (2026-11-08): the owner has accepted the
> existing-database-only provenance scope and supplied conditional migration
> authority. Five shared Vercel variables now target Production only; all 28
> approved old Preview snapshots have been removed. Real local Supabase Auth/browser, scoped
> logical recovery and full physical PostgreSQL recovery have passed. Production roles, recoverable platform backup,
> hosted isolation and business certifications remain pending. See the
> [operational rehearsal](PRODUCTION_RESET_OPERATIONAL_REHEARSAL.md), including
> the removed unintended diagnostic deployment and production-backup evidence limit.
> Earlier access/authorization statements below describe their historical stage.

A dedicated local Supabase17.6/Auth fixture and real browser workflows now pass;
see the operational report above. This is not hosted Preview isolation. All 28 approved old
Preview snapshots were removed, preserving the three Production deployments. Five shared
configuration entries now target Production only; no Production value changed.
No hosted IPSM staging branch was returned by the authorized CLI metadata request.
Production SQL/runtime access remains unavailable through the connected tools.

## Hosted staging procedure (resource identity and any cost approval required)

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
   with production connections. Preview-only changes are authorized after resource verification;
   never use an all-environments CLI command or publish values/screenshots.
5. Leave IPSM_IDENTIFIER_ACTIVATION_ID absent until the independently empty synthetic
   staging namespace/recovery evidence is validated; select only that database’s current enabled
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
Supabase Auth integration. The separate local Supabase browser rehearsal validates real Auth. Hosted isolated
Auth/resource access remains an administrator gate.
