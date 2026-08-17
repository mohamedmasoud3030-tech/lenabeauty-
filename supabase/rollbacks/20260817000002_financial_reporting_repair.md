# Rollback — 20260817000002 financial reporting repair

Do not rollback on Production without explicit approval. The migration only adds/replaces reporting RPCs; it does not rewrite stored invoices.

Preferred recovery is a forward migration that fixes the formula while preserving ADMIN checks.

Logical rollback:

1. Revoke `get_dashboard_summary_v1`, `get_dashboard_pnl_v1`, and `get_dashboard_revenue_entries_v1` from client roles.
2. Deploy an application version that does not call these RPCs.
3. Drop the three functions only after the old client is active.

Verification:

- STAFF receives no financial capability.
- VAT and prepaid fixtures are reconciled before restoring any older formula.
- `npm run audit:gate`, RPC check, types, focused financial tests and build.
