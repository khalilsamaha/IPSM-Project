# Troubleshooting

## Not authorized

Reception users are intentionally blocked from `/users`, `/settings`, payment voiding, and admin repair actions. Confirm the user's `user_profiles.role` is either `ADMIN` or `RECEPTION`.

## Supabase admin client is not configured

User management needs `SUPABASE_SERVICE_ROLE_KEY` on the server only. Do not expose it to the browser or prefix it with `NEXT_PUBLIC_`.

## Duplicate receipt number

Receipt numbers use `RCPT-YYYY-000001` format and are retried on unique constraint conflicts. If legacy data is inconsistent, use the admin repair action or the diagnostics in `docs/ROLES_AND_PERMISSIONS.md`.

## Payments with no allocations

A valid payment must have at least one `payment_items` row, all belonging to enrollments from the same family, and `payments.total_amount_cents` must equal the item sum. Audit with:

```sql
select p.id, p.total_amount_cents, coalesce(sum(i.amount_cents),0) as allocated
from payments p left join payment_items i on i.payment_id = p.id
group by p.id having coalesce(sum(i.amount_cents),0) <> p.total_amount_cents or count(i.id) = 0;
```

## Safe logging

Server logs use sanitized structured messages. Never log passwords, tokens, service role keys, API keys, authorization headers, or database URLs.
