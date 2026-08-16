# Rollback guidance — 20260816000001

Do not automatically roll this migration back after production writes: the role column and composite foreign keys become part of the authorization/integrity contract.

If deployment fails while validating a constraint, the transaction rolls back completely. Inspect and repair the reported cross-center/orphan rows, then reapply.

For an application rollback, leave the schema hardening in place. Older clients remain compatible with the original table columns and relationships, but users must retain valid membership roles. Reverting ADMIN-only payroll RLS or restoring ambiguous/simple foreign keys would reopen the security defects this migration closes and requires an explicit owner-approved emergency migration.
