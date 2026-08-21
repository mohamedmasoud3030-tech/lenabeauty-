# LenaBeauty — Product UX Roadmap

## P0 — Prove the operating loop

### P0.1 Today workspace

**Change:** Make today’s appointments, quick booking, check-in, exceptions, and quick checkout the dominant dashboard experience.

**Acceptance criteria:**

- Staff can identify the next appointment without opening multiple modules.
- Each appointment exposes one clear next action.
- Empty day, loading, failed query, and permission states are explicit.
- Mobile Arabic layout has no horizontal clipping or hidden primary action.

### P0.2 Appointment card contract

**Change:** Show customer, service, time/duration, assigned specialist, lifecycle status, payment status, and next action in a consistent card.

**Acceptance criteria:**

- Lifecycle and payment badges are visually separate.
- `CANCELLED` and `NO_SHOW` are never presented as successful completion.
- A reschedule/cancel/no-show action requires confirmation and preserves reason/history where applicable.

### P0.3 Exception queue

**Change:** Add a “Needs attention” section for late/overdue appointments, failed writes, unconfirmed bookings, unpaid completed visits, and stock warnings.

**Acceptance criteria:**

- Each item has a reason, severity, timestamp, owner/role, and direct corrective action.
- Resolved items disappear only after the underlying state changes.
- No fabricated data appears when a query fails.

## P1 — Make the visit trustworthy

### P1.1 Check-in → service → completion

Create a visible operational progression without changing the database until the current contract is confirmed. If schema changes become necessary, request approval first.

### P1.2 Checkout review step

Before an irreversible checkout, show items, quantities, discount, tax configuration, payment method, total, and customer. Follow WCAG error-prevention guidance for financial actions.

### P1.3 Customer continuity

After completion, show receipt, service record, optional review/request, and rebooking action. Keep automated messaging disabled until provider and consent policy are approved.

## P2 — Role-based depth

- Owner: revenue, profitability, unresolved exceptions, staff/stock risks.
- Manager: today’s execution, reassignment, attendance, operational exceptions.
- Staff: assigned work, customer context, check-in/out, service completion.
- Accountant/reviewer: traceable financial records and exports.

## P3 — Readiness and trust

- Demo/Staging/Production banner and data readiness indicator.
- Migration acceptance evidence and live preflight.
- Accessibility walkthrough across login, appointments, customers, POS, dialogs, and reports.
- Arabic/RTL copy review by workflow, not only translation-key parity.

## Safe implementation batch

Once a local checkout is available, implement P0.1, P0.2, and P0.3 first. These are reversible UI/information-architecture changes and do not require new pricing, tax, payment, or destructive data policies.
