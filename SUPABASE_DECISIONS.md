# Supabase Decisions — LenaBeauty

Date: 2026-08-18. One decision per problem, with the reasoning and the
alternatives that were rejected.

---

## D-1 — Declare the Data API grant contract explicitly

**Problem.** Every table privilege the app depends on was inherited from
Supabase's legacy auto-exposure default and appeared nowhere in the migration
chain. Supabase enforces the new opt-in behaviour on all existing projects on
2026-10-30.

**Decision.** Add one additive migration that writes the full privilege contract
down at least privilege, and adopt the post-2026-10-30 default for future
objects.

**Why this and not the alternatives**

| Option | Verdict |
|---|---|
| Set `auto_expose_new_tables = true` | **Rejected.** Supabase removes the flag on 2026-10-30. It buys weeks and re-hides the problem. |
| `GRANT ALL ON ALL TABLES ... TO authenticated` | **Rejected.** Would re-expose salaries, financial tables and the idempotency ledger, and undo deliberate hardening. Fastest to write, worst outcome. |
| Do nothing; the Demo project works today | **Rejected.** Guarantees a total outage on 2026-10-30 and makes disaster recovery impossible right now. |
| **Explicit per-table, per-role grants (chosen)** | Reviewable, diffable, reproducible on a fresh project, and matches Supabase's own guidance. |

**Key property:** on the live Demo project this is behaviourally a **no-op** —
it re-grants what the platform already granted. That is what makes it safe to
apply, and why it is worth applying now rather than under outage pressure.

**Reversibility.** Fully reversible; procedure in
`supabase/rollbacks/20260818000001_data_api_grant_contract.md`.

---

## D-2 — Keep the grant strictly narrower than the RLS policy

**Decision.** Grant only the verbs the UI actually issues. Notably: **no client
role receives `DELETE` on any table**, and `employees` is column-restricted so
compensation never crosses the Data API.

**Reasoning.** Grants and policies are independent layers, and a grant is the
cheaper, coarser one to reason about. If a bug or a future policy edit ever
widened row visibility, the missing grant still blocks the operation. Defence in
depth costs nothing here because the UI never needed those verbs.

**Rejected:** granting the full CRUD set and relying on RLS alone. That makes RLS
a single point of failure for operations the product does not even perform.

---

## D-3 — Prove authorization by executing it, not by reading SQL

**Problem.** All 36 pre-existing `supabase.*.test.ts` files assert on migration
*text*. That is structurally incapable of detecting a privilege that was never
written — exactly the critical defect found here.

**Decision.** Add an executable harness (`scripts/audit/lib/rls-harness.mjs`)
that replays the chain into PGlite and runs statements under `SET ROLE` with a
working `auth.uid()`, plus 77 assertions built on it.

**Why PGlite is the right oracle.** It is a bare PostgreSQL with **none** of
Supabase's legacy default privileges. A test that passes there is a test that
passes on a newly provisioned Supabase project — which is precisely the property
that was broken and that text assertions could never check.

**Deliberate design points**

- The harness distinguishes `denied` (42501, page errors) from `ok` with zero
  rows (page shows empty state), because those are different user-visible bugs.
- It grants `USAGE ON SCHEMA auth` to mirror the real platform baseline; without
  that it would report false failures that do not exist on Supabase.
- It asserts both directions: journeys that must work, and boundaries that must
  not.

**Validation of the tests themselves.** Removing the migration fails 27 of the 77
assertions. The suite is load-bearing, not decorative.

**Rejected:** testing against the live Demo project. Slow, network-dependent,
mutates shared state, and cannot run in CI or offline.

---

## D-4 — Surface real errors instead of rendering plausible wrong data

**Problem.** Four read paths turned a failed query into confident output via
`(data || [])`.

**Decision.** Check every response and return a labelled error.

**Reasoning.** For a salon owner, a visible error ("could not load the report")
is recoverable — they retry or call support. A silently wrong number is not: an
overstated revenue figure or a backup missing four tables gets **trusted**, and
the damage is discovered much later, if ever. Financial correctness must fail
loudly.

**Rejected:** logging the error and continuing with partial data. That preserves
the illusion of success, which is the actual harm.

---

## D-5 — Page exports past the PostgREST row cap

**Problem.** PostgREST silently truncates at `max_rows` (1000) with HTTP 200 and
no error. Exports read every table unpaged.

**Decision.** Page with `.range()` in the export path specifically, until a short
page proves the end of the set.

**Why only exports.** Truncation is harmless for a screen showing recent records
but is **data loss** for a full-tenant backup. Scoping the change to the export
path fixes the real harm without adding pagination overhead to every list query.

**Rejected:** raising the server `max_rows`. It weakens a deliberate protection
against oversized responses for every query in the project, and a client
`.limit()` is clamped by the server anyway, so it would not even be reliable.

---

## D-6 — Scope the inventory forecast through the parent invoice

**Decision.** Filter `invoice_items` via `invoices!inner(center_id)` rather than
adding a denormalized `center_id` column.

**Reasoning.** `invoice_items` intentionally has no `center_id`; it derives
tenancy from its invoice, and its RLS policy already works that way. Adding a
duplicate column would create a second source of truth that could drift and would
require a backfill on financial history. Making the existing relationship
explicit costs nothing and keeps one source of truth.

---

## D-7 — Fix the audit tool rather than the query it misjudged

**Problem.** The contract matrix flagged the correct embedded filter
`invoices.center_id` as a missing column.

**Decision.** Teach the tool to resolve `embed.column` filters against the
embedded relation.

**Reasoning.** The query was right and the tool was wrong. Rewriting correct code
to satisfy a broken check would have hidden the tool's blind spot and left it to
misfire on the next legitimate embed. A gate that produces false positives gets
ignored, which is how real findings get missed.

---

## D-8 — Do not touch any live environment

**Decision.** All work is local, additive and reversible. No migration was
applied to Demo/Staging or Production; no real data was read or written; no
credential was rotated.

**Reasoning.** Applying schema changes to a shared environment is exactly the
class of action that requires the owner's explicit approval, and outbound access
to the project is blocked here in any case. The migration is prepared, tested and
documented with a rollback so it can be applied deliberately under the existing
approval-gated CI workflow.

---

## Standing rules applied throughout

1. RLS is never disabled or weakened to make data appear.
2. No `USING (true)` / `WITH CHECK (true)` policy is introduced.
3. Authorization derives only from `auth.uid()`; client-supplied identity,
   role or tenant is treated as untrusted input.
4. Privileged keys never enter browser-reachable code.
5. Every fix ships with a test that fails without it.
6. Existing Git work is preserved; changes are additive.
