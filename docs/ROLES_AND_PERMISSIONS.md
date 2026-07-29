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
| Pricing matrix / teacher assignments | Yes | Yes | No |

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

## Shift management permissions

- **Reception**: may open and close their own shift and create payments/expenses only while a shift is open.
- **Admin / Super Admin**: may review all shifts and reopen a closed shift with a required reason. Reopen actions are audited and are never silent unlocks.
- Closed-shift transaction locks are enforced by server actions, not only by UI controls.


## Payroll permissions

Reception users have no payroll access. Admin and Super Admin users can generate teacher payroll drafts, approve payroll, mark approved payroll as paid, and cancel non-paid payroll with an audit trail.

## Temporary deletion visibility update (July 2026)

Delete access for eligible, dependency-safe records is temporarily visible to all authenticated application roles with `records:write` permission: RECEPTION, ADMIN, and SUPER_ADMIN. Financial safeguards, audit logging, dependency checks, and closed-shift protections remain required.

Expenses now show Delete from the active and archived expense lists. Users must type `DELETE` to confirm after reviewing the date, category, description, amount, payment method, creator, and shift status. Expenses tied to CLOSED shifts remain blocked; OPEN and REOPENED shift expenses may be deleted when all safety checks pass.

Payments and receipts must not expose a normal Delete action. Use the established Void, Reprint, or Regenerate workflows so financial history remains auditable.

Reports now show only filters relevant to the selected report type. Use Reset Filters to clear report filters, and confirm that family/student choices use readable codes and names instead of internal IDs.

### Attendance and payroll

Only `ADMIN` and `SUPER_ADMIN` may bulk-finalize attendance, generate/approve/cancel payroll, mark payroll paid, or export payroll. Attendance audit entries record session identifiers and transition details without student personal data. Approved payroll locks financial and attendance history; paid payroll is fully immutable.
