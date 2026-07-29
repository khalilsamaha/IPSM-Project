# Teacher operations

## Attendance
The default policy is **assume completed unless cancelled or missed**. A server service interprets the lesson's date and end time in `APP_TIME_ZONE`, adds the singleton grace period (15 minutes by default), and conditionally changes only `SCHEDULED` rows. Invalid, archived, future/in-progress, exception, invalid-enrollment, and approved/paid-payroll rows are skipped. Automatic and manual provenance, reason, time, and audit events are retained. Admin can run the service from Teacher Operations; payroll preview and generation invoke the same service.

Deployment must set a valid IANA `APP_TIME_ZONE` and `CRON_SECRET`. `/api/cron/finalize-attendance` uses constant-time Bearer-secret comparison and runs nightly from `vercel.json`.

## Corrections and locking
Cancellation, missed attendance, and correction/revert require a reason. A draft payroll can be cancelled to return lessons to correction. Approved payroll blocks corrections; paid payroll is immutable.

## Monthly payroll
New payroll uses `YYYY-MM`; boundaries and money are derived server-side. Previous and older completed months can be generated. Current month is preview-only and future months are unavailable. Completed lessons are payable; cancelled/scheduled are not. Missed lessons require both global enablement and individual approval. Historical custom periods remain visible.

## Availability calendar
The route defaults to a Monday-first weekly calendar with a detailed-list alternative. Weekly rules are expanded to real dates through the shared calendar availability module, which applies effective dates, season scope, archives, bookings, closures, and interval unions. Overlap summaries do not double-count time. Reception is read-only; Admin/Super Admin can manage rules, and destructive changes never silently cancel lessons.
