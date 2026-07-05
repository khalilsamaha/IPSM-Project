# Roles and permissions

IPSM supports three application roles with a strict hierarchy:

**SUPER_ADMIN > ADMIN > RECEPTION**

- **SUPER_ADMIN** is the internal system owner role. The built-in `admin@ipsm.local` account is treated as the protected system owner, has all permissions, and is hidden from normal administration.
- **ADMIN** users are operational administrators. They can manage normal staff users and administrative modules, but they are not system owners and cannot see, edit, deactivate, delete, or otherwise modify `SUPER_ADMIN` / system-owner accounts.
- **RECEPTION** users have daily operational access for families, students, teachers, enrollments, schedules, payments, receipts, and expenses where allowed. Reception cannot access user management or protected administrative configuration.

| Module / Action | SUPER_ADMIN | ADMIN | RECEPTION |
| --- | --- | --- | --- |
| User management | All users, including system owners | Normal Admin/Reception users only | No |
| Create staff users | Admin and Reception | Admin and Reception | No |
| Edit/deactivate staff users | Admin and Reception | Normal Admin/Reception users only | No |
| Protected system owner account | Full access | Hidden and blocked | Hidden and blocked |
| Settings and admin configuration | Yes | Yes | No |
| Records and daily operations | Yes | Yes | Yes |
| Reports | Yes | Yes | Yes |
| Void/delete sensitive finance records | Yes | Yes | No |

## Protected system owner account

The `admin@ipsm.local` account is reserved for highest-access internal ownership. If a matching row exists in `public.users`, it must use the `SUPER_ADMIN` role. If it exists only as a seed/local account and is not linked to a real Supabase Auth user, it still remains hidden from normal user management.

Normal Admin users must not see the system owner in the Users list, dropdowns, or management views. Direct action attempts against that account must fail safely with a Not Authorized response or redirect and must not crash the application. Attempts to modify protected users are blocked and may be recorded in audit logs.

## Route behavior

All application pages and API routes require authentication. `/users` is available only to `SUPER_ADMIN` and `ADMIN`; `RECEPTION` users should see a friendly Not Authorized page or be safely redirected. Other admin-only pages are available to `SUPER_ADMIN` and `ADMIN` unless a future permission narrows access further.

## Operational note

Admin users should be considered operational administrators, not system owners. Use `SUPER_ADMIN` for unrestricted ownership-level access and future permissions that should bypass normal Admin limits.

## Hotfix permissions

- Admin and SUPER_ADMIN may permanently delete unused seasons, unused/archived academic configuration records, and archived students after explicit confirmation.
- Reception keeps daily record editing and payment creation access, including Family / Group and independent-student payments, but cannot perform permanent deletes or payment voids.
- All destructive workflows require confirmation and should return friendly errors instead of raw database failures.

## Hotfix permissions notes

- SUPER_ADMIN and ADMIN can edit enrollments, manage teacher profiles, manage teacher courses/instruments, and manage teacher availability.
- RECEPTION keeps operational records access and can book lessons using enrollment-derived teacher/season data. Existing RBAC remains in force for restricted admin configuration.
- Booking does not accept a manually different teacher or season when an enrollment is selected; server validation derives those values from the enrollment.
