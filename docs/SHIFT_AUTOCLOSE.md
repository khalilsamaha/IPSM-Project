# Shift midnight closure

IPSM uses `Asia/Beirut` as its business timezone. Vercel cron expressions are UTC, while Beirut midnight occurs at either 21:00 UTC during daylight time or 22:00 UTC during standard time.

Two daily, idempotent cron invocations therefore call the same stale-shift service:

- `/api/cron/close-stale-shifts` at `0 21 * * *`
- `/api/cron/close-stale-shifts-late` at `0 22 * * *`

At each invocation, the application calculates the current Beirut business date and closes only `OPEN` or `REOPENED` shifts whose `business_date` is earlier. The invocation that does not correspond to local midnight safely performs no work.

`CRON_SECRET` must be configured in the production Vercel environment. The route uses a constant-time bearer-token comparison and returns a configuration error when the secret is absent.

As a second safeguard, opening a new shift first closes any stale shift belonging to that user. This fallback prevents a missed or disabled cron from blocking the next business day.

Automatic closure records expected cash and transaction totals, marks the shift `AUTO_CLOSED`, and leaves declared cash and variance empty. A user must later reconcile the shift by entering physically counted cash, after which it becomes `CLOSED`.
