# Rollback — 20260817000003 payroll transaction repair

Do not rollback while a payroll run is in progress. No stored row is rewritten by migration install; the change adds RPCs.

Preferred recovery is a forward migration retaining a single database transaction.

Logical rollback:

1. Stop payroll mutations.
2. Reconcile each `payroll_runs` row, its line count, and linked `employee_advances`.
3. Revoke the two payroll RPCs from client roles.
4. Deploy a compatible client before dropping the functions.

Never restore the old browser-side multi-request sequence without accepting its partial-failure risk.

Verification:

- run/lines/advance statuses reconcile;
- duplicate month remains rejected;
- delete releases linked advances and removes the run together;
- ADMIN-only access, audit gate, types, payroll tests and build.
