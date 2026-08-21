# LenaBeauty — Product Decisions

## Decision 1 — Product definition

LenaBeauty is the operating system for a single salon/spa center, not a collection of CRUD screens and not only an online booking page.

**Why:** The repository already owns the whole visit lifecycle and the owner’s control loop. The strongest value comes from connecting those capabilities around a real visit.

## Decision 2 — Primary experience

The primary home is **Today’s Operations**. It should answer:

- Who is expected today?
- What needs attention now?
- What can staff do in one tap?
- What money is collected, pending, or needs review?

Advanced areas remain available by role and readiness but do not compete with today’s work.

## Decision 3 — Appointment and payment states are separate

Do not represent `paid`, `unpaid`, `deposit`, `refunded`, or `partially paid` as appointment lifecycle statuses. Appointment lifecycle and financial state are two related but distinct dimensions.

**Why:** Mixing them makes operational scheduling and financial reconciliation ambiguous.

## Decision 4 — Conservative policy defaults

Until the owner approves actual policy, use:

- no automatic cancellation fee,
- no automatic deposit requirement,
- no automatic refund promise,
- no automatic external messaging,
- no tax rate hard-coded as a business commitment.

The interface may expose configuration readiness and explain that the center policy is not configured.

## Decision 5 — Scope control

Do not add another major module until the existing booking-to-payment journey is coherent, tested, and usable on mobile Arabic/RTL.

## Reversible assumptions

- Single-center launch remains the default.
- OMR remains the display currency.
- Arabic is the primary RTL language with English available.
- Notifications stay manual/provider-neutral until approved.
- Demo/Staging must be treated as non-production until hosted acceptance is verified.

## Owner approval required later

The following cannot be safely inferred from code or generic research:

1. VAT registration status and invoice/tax policy.
2. Deposit amount/type and cancellation/no-show policy.
3. Refund authority and payment-gateway production activation.
4. Legal business identity, privacy retention, and customer consent wording.

## Implementation record — 2026-08-21

- Decision 2 is now reflected in DashboardPage: the primary non-first-run action opens today’s schedule, and the dashboard includes a derived Needs Attention queue.
- Decision 3 is enforced conservatively in AppointmentsPage: lifecycle status is rendered separately from payment handoff. The UI does not claim PAID or UNPAID because the current Appointment contract does not expose that fact.
- The current P0 changes are UI-only and reuse existing queries, routes, ScreenState, translations, and design tokens.
- No VAT, deposit, cancellation, no-show, refund, gateway, RLS, tenant, or checkout contract was changed.
- P1.1 is blocked pending evidence of an existing check-in/service state or explicit owner approval for a contract change.
