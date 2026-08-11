# Rollback — 20260810000006_security_grant_repair

This migration intentionally removes inherited client EXECUTE grants that were broader than the shipped staff UI requires.

## Default rollback policy

**Do not automatically restore the old grants.** Restoring them would re-open public booking/client-portal RPCs and the legacy checkout overload to client roles.

If a staff RPC was omitted accidentally, add a new forward migration that grants only that exact audited function signature to the required role. Do not use a broad `GRANT ... ON ALL FUNCTIONS` rollback.

If the future customer-booking phase needs public booking/client-portal RPCs, that phase must explicitly grant the exact required signatures after its own authorization and abuse-control review.
