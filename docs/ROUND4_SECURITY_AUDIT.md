# Round 4 Supabase hardening audit

Date: 2026-09-03
Scope: canonical migration chain and generated database-contract evidence on `architecture/round-4-canonical-consolidation`.

## Decision

Round 4 does **not** add a speculative security migration or speculative indexes. The current canonical audit reports `0 high`, `0 medium`, and `0 low` findings. Security changes remain evidence-led: a migration is required only when the schema replay, frontend contract scan, live Demo gates, or a reviewed query pattern proves a gap.

## SECURITY DEFINER boundary

The contract gate blocks unpinned `SECURITY DEFINER` functions through the `security-definer-search-path` category. Canonical privileged functions use an explicit search path such as `pg_catalog, public, app_private`; the current visit/checkout functions follow that contract.

Public booking/client-portal RPCs remain intentionally dormant: the generated audit confirms they have no `PUBLIC`, `anon`, or `authenticated` execute grants while their routes are unregistered. They must be re-audited for rate limiting and abuse controls before any future enablement.

## Internal / idempotency tables

`public.checkout_idempotency` is deliberately server-owned:

- RLS is enabled.
- `PUBLIC`, `anon`, and `authenticated` receive no direct table privileges.
- the client enters through `process_checkout_idempotent_v1` only;
- the RPC verifies center membership before touching the table;
- the legacy non-idempotent checkout entry point is revoked from client roles.

This is the correct boundary for an internal retry ledger; adding permissive RLS policies would weaken it rather than harden it.

## RLS and authorization

The canonical chain uses membership identity through `center_memberships.profile_id = auth.uid()` and contains dedicated authorization-boundary and grant-repair migrations. Generated contract evidence currently reports no blocking `rls-role-governance`, missing RPC grant, or SECURITY DEFINER search-path finding.

## Performance / indexes

The replayed schema currently contains 117 indexes. No new index is added in this round without a demonstrated query pattern and plan-level reason. Index-by-guessing would increase write amplification and maintenance cost. The next index change must be tied to an observed slow query or a clearly repeated filter/order pattern that is not already covered.

## Auth hardening

The canonical chain already contains the dedicated auth/security hardening and inherited-grant repair migrations. Password recovery is enumeration-safe at the repository contract boundary. No weakening or broad role grant is introduced in Round 4.

## Remaining manual-review items

The generated audit has information-only scanner limitations for dynamic `.from()` usage, one dynamic `.select()` usage, and untyped JSON/record RPC return shapes. These are not authorization findings. The RPC return-shape item is an application-contract improvement target and should be addressed with DTO/runtime contract coverage rather than a database permission change.

## Round 4 rule

Do not add a migration merely to make the security section look active. Preserve the current hardened boundary, keep the generated/live gates authoritative, and change SQL only when evidence identifies a concrete defect or performance need.
