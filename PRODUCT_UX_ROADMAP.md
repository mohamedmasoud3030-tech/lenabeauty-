# LenaBeauty — Product UX Roadmap

## P0 — Prove the operating loop

### P0.1 Today workspace

**Change:** Make today’s appointments and exception resolution the dominant dashboard experience, reusing existing appointment, inventory, and navigation capabilities.

**Acceptance criteria for this UI-only baseline:**

- The dashboard loads the real ordered appointment list for today and exposes one primary action to open the schedule.
- Each listed appointment exposes a lifecycle label and one next action.
- The existing empty, loading, failed-query, and permission states remain explicit; rendered verification is still pending.
- The mobile Arabic/RTL layout keeps the primary action reachable; rendered verification is still pending.
- Check-in and quick checkout are not claimed as implemented here because the current appointment contract has no corresponding state/use case; they remain P1 work.

### P0.2 Appointment card contract

**Change:** Show customer, service, time/duration, assigned specialist, lifecycle status, a truthful payment handoff, and next action in a consistent card.

**Acceptance criteria for the current contract:**

- Lifecycle and payment handoff are visually separate.
- The UI does not label an appointment `PAID` or `UNPAID` because `Appointment` has no verified payment field or invoice link; it shows `Payment at checkout` or `Deposit configured`.
- `CANCELLED` and `NO_SHOW` are not presented as successful completion.
- Existing reschedule/cancel/no-show actions are preserved; confirmation/reason/history behavior remains a rendered verification item and was not expanded in this batch.

### P0.3 Exception queue

**Change:** Add a “Needs Attention” section for the exceptions that the current source can prove: late scheduled appointments and low-stock warnings.

**Acceptance criteria for the current source:**

- Each surfaced item has a reason, severity styling, and a direct corrective route to Appointments or Inventory.
- The queue is derived only from loaded records and does not fabricate failed-write, unconfirmed-booking, or unpaid-completion states.
- Timestamp/owner fields and resolution disappearance require source data or mutation behavior that are not present in the current contract; they remain deferred rather than invented.

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

## Execution status — 2026-08-21

| Priority | Item | Status | Current evidence |
|---|---|---|---|
| P0.1 | Today Workspace | **IN PROGRESS** | Dashboard CTA, today list, and operational ordering updated; CI/browser verification pending. |
| P0.2 | Appointment Card Contract | **IN PROGRESS** | Desktop/mobile cards now separate lifecycle from payment handoff and show a next action. |
| P0.3 | Needs Attention / Exception Queue | **IN PROGRESS** | Late scheduled appointments and low-stock warnings are derived from loaded records and route to corrective screens. |
| P1.1 | Check-in → Service → Completion | **BLOCKED** | Current AppointmentStatus has no check-in or in-service state and no verified existing use case. |
| P1.2 | Checkout review step | **NOT STARTED** | Requires rendered POS verification; atomic checkout remains unchanged. |
| P1.3 | Receipt → Rebooking/customer continuity | **NOT STARTED** | Requires rendered customer/POS walkthrough. |
| P2 | Role-based depth | **NOT STARTED** | Existing guards and routes preserved. |
| P3 | Readiness and trust | **NOT STARTED** | Hosted migration/data readiness still unverified. |

### Verified facts vs assumptions

- **Verified:** existing code loads today appointments and low-stock products; appointment lifecycle is SCHEDULED/COMPLETED/CANCELLED/NO_SHOW; no payment status is present on Appointment; checkout is a separate repository/use-case path.
- **Assumption:** a future payment-status display can be added without schema work. This is **not accepted** until an existing invoice relationship is proven.
- **Blocked owner decision:** tax, deposit, cancellation/no-show, refund, gateway, legal identity, and retention policies remain unchanged and unconfigured by this batch.

### Verification blocker

P0 remains **IN PROGRESS**, not DONE. GitHub Actions run 52 failed before recording any step; SonarQube Cloud Quality Gate passed, but the Vercel preview is blocked by the free-plan deployment rate limit. P1 remains blocked by the missing check-in/service contract as previously recorded.
