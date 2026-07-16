# Shift Management

Receptionists must open a shift from **Daily Operations → Shift** before recording payments or expenses. The system attaches new front-desk payments and expenses to the current open shift automatically.

## Policy

- Existing historical payments and expenses may keep `shiftId = null` and display as **Legacy / No Shift**.
- Each user can have only one `OPEN` or `REOPENED` shift at a time. The database also prevents a duplicate open shift for the same user and business date.
- Admin and Reception-created payments/expenses both require an open shift. This is the cleaner accounting implementation because every new cash/Whish transaction follows the same controlled daily workflow instead of creating unaudited override rows.

## Closing formula

Expected closing cash = opening cash + posted cash payments - cash expenses.

Whish payments and Whish expenses are reported separately and never affect physical cash.

## Locked transactions

When a shift is `CLOSED`, linked payments cannot be voided and linked expenses cannot be edited, archived, restored, or permanently deleted. Server actions enforce this and return: “This transaction belongs to a closed shift and can no longer be modified.”

## Admin reopen

Admins may reopen a closed shift only with a reason. Reopen and close actions are written to audit logs. Reclosing recalculates expected cash, declared cash, and the difference.

## QA checklist

- Open a shift as Reception, then create a cash payment and cash expense.
- Confirm the shift dashboard expected cash equals opening cash plus posted cash payments minus cash expenses.
- Confirm Whish appears separately.
- Close the shift and verify payment void and expense archive/edit are blocked.
- Reopen as Admin with a reason, correct a transaction, and close again.
- Verify legacy no-shift transactions remain visible in payment and expense lists.
