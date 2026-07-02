# Admin receipt number repair SQL

Use this SQL in Supabase SQL Editor when production payments have `receipt_number = null`. It is intentionally idempotent: rerunning it only targets payments that are still missing a receipt number and keeps existing legacy (`RCPT-YYYY-0001`) or current (`RCPT-YYYY-000001`) numbers unchanged.

Run the preview first, then run the repair in a transaction.

## Preview missing payments

```sql
select id, payment_date, receipt_number, created_at
from payments
where receipt_number is null
order by payment_date, created_at, id;
```

## Repair missing receipt numbers

```sql
begin;

-- Serialize receipt repairs/generation so concurrent admins cannot assign the same number.
select pg_advisory_xact_lock(hashtext('ipsm_receipt_number_repair'));

with numbered_existing as (
  select
    coalesce(nullif(substring(receipt_number from '^RCPT-([0-9]{4})-[0-9]{4,}$'), ''), extract(year from current_date)::text)::int as receipt_year,
    substring(receipt_number from '^RCPT-[0-9]{4}-([0-9]{4,})$')::int as receipt_sequence
  from payments
  where receipt_number ~ '^RCPT-[0-9]{4}-[0-9]{4,}$'
), missing as (
  select
    id,
    extract(year from payment_date)::int as receipt_year,
    row_number() over (partition by extract(year from payment_date)::int order by payment_date, created_at, id) as repair_sequence
  from payments
  where receipt_number is null
), max_by_year as (
  select receipt_year, max(receipt_sequence) as max_sequence
  from numbered_existing
  group by receipt_year
), repaired as (
  update payments p
  set receipt_number = 'RCPT-' || missing.receipt_year || '-' || lpad((coalesce(max_by_year.max_sequence, 0) + missing.repair_sequence)::text, 6, '0'),
      updated_at = now()
  from missing
  left join max_by_year on max_by_year.receipt_year = missing.receipt_year
  where p.id = missing.id
  returning p.id, p.receipt_number
)
insert into receipts (payment_id, receipt_number, pdf_path)
select id, receipt_number, '/api/receipts/' || id
from repaired
on conflict (payment_id) do update
set receipt_number = excluded.receipt_number,
    pdf_path = coalesce(receipts.pdf_path, excluded.pdf_path),
    deleted_at = null;

commit;
```

## Verify no duplicate or missing numbers remain

```sql
select receipt_number, count(*)
from payments
where receipt_number is not null
group by receipt_number
having count(*) > 1;

select count(*) as missing_receipt_numbers
from payments
where receipt_number is null;
```
