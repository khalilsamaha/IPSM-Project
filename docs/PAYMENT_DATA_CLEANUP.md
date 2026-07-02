# Payment data cleanup helper

Admin-only review queries for payment data quality. These queries identify records; do not delete payments automatically.

```sql
-- Payments missing receipt numbers
select id, family_id, payment_date, total_amount_cents, created_at
from payments
where receipt_number is null;

-- Payments with zero allocations
select p.id, p.receipt_number, p.family_id, p.payment_date, p.total_amount_cents
from payments p
left join payment_items pi on pi.payment_id = p.id
group by p.id
having count(pi.id) = 0;

-- Payments missing receipt records
select p.id, p.receipt_number, p.family_id, p.payment_date
from payments p
left join receipts r on r.payment_id = p.id
where r.id is null;
```
