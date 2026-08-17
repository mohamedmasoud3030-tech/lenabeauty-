# Rollback — 20260817000001 authorization boundary repair

This rollback is **not automatic** and must never be applied merely to make a failing client work. It intentionally weakens authorization. Use only on Demo/Staging after approval and after confirming that the application version is compatible.

## Preconditions

1. Stop writes to Settings, Accounting, Customer Experience, Entitlements and Employees.
2. Export the current function definitions, grants and policies.
3. Confirm the target is not Production.
4. Keep the migration history entry; use a forward repair migration rather than editing applied SQL.

## Logical rollback plan

- Revoke client execution from the ADMIN wrappers and employee governance RPCs.
- Restore the previous implementation function names only if no newer migration depends on them.
- Recreate the previous membership-scoped policies from the immediately preceding canonical migration state.
- Restore the prior employee relation grants only if the old application requires direct compensation reads/writes.
- Restore the previous storage insert/update policies.
- Restore direct `DELETE` or wrapper-managed table-write grants only if a separately approved lifecycle design and compatible application require them. The legacy employee delete-named RPC now deactivates; restoring its old hard delete would re-open payroll/attendance cascade risk.

Because this rollback reopens the exact cross-role access fixed by the migration, the preferred recovery is a **forward compatibility migration** that repairs a broken signature or policy while retaining ADMIN enforcement.

## Verification after any approved rollback

- `npm run audit:gate`
- `npm run db:types:check`
- direct STAFF calls to every sensitive RPC must be explicitly reviewed; a successful STAFF call is a known security regression
- ADMIN employee CRUD and operational employee-name reads
- cross-center denial
