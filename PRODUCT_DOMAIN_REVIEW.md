# LenaBeauty — Product & Domain Review

**Review date:** 2026-08-21  
**Evidence:** `main` repository metadata, `README.md`, `package.json`, generated database contract, route/page inventory, `src/index.css`, and PR #39 review material.  
**Important limitation:** The repository was not available as a local checkout in this session, so rendered-browser and live Supabase observations are marked as unverified. No production data or hosted migration was changed.

## 1. Product diagnosis

LenaBeauty is a single-center salon/spa operations PWA for Oman. Its real product promise should be:

> Help the team turn a customer request into a correctly scheduled, delivered, paid, and repeatable salon visit — with a trustworthy record for the owner.

The repository already contains most of the operational building blocks: appointments, public booking, customer portal, POS/checkout, services, staff, inventory, expenses, reports, attendance, advances, payroll, packages, gift cards, service files, reviews, notifications, and settings.

The main product risk is not lack of features. It is prioritisation and continuity. The information architecture can make the product feel like a collection of modules instead of one operating system for the daily salon workflow.

## 2. Users and jobs-to-be-done

| User | Primary job | Must be able to decide quickly |
|---|---|---|
| Owner / ADMIN | Know whether the center is busy, profitable, controlled, and safe | What needs attention today? Is revenue real and reconciled? |
| Manager | Run the shift and resolve exceptions | Who is coming, what is late, what needs reassignment, what is unpaid? |
| Reception / STAFF | Book, check in, deliver, collect payment | Is this slot available? What exactly is booked? What do I do next? |
| Specialist / employee | Deliver the service and record the outcome | Which client/service is next and what relevant notes or files exist? |
| Customer | Discover, book, attend, pay, return | Is the booking confirmed, changeable, and understandable? |
| Accountant / reviewer | Trust financial outputs | Can every amount be traced to a completed transaction? |

## 3. Canonical journey

```text
Enquiry → Booking request → Confirmed appointment → Reminder → Check-in
→ Service delivery → Completion → Checkout/payment → Receipt → Follow-up/rebooking
```

Exceptions must remain visible in the same journey: reschedule, cancellation, no-show, late arrival, unavailable staff, partial payment, refund, failed notification, and offline/network failure.

## 4. Domain expectations

### Confirmed by repository evidence

- Appointment status enum includes `SCHEDULED`, `COMPLETED`, `CANCELLED`, and `NO_SHOW`.
- Public booking, rescheduling, cancellation, taken-slot lookup, and a customer portal exist as server RPCs.
- Checkout is intended to be atomic and idempotent through `process_checkout_idempotent_v1`.
- OMR-style numeric precision and inventory decrement safeguards are part of the established project context.
- Notifications are intentionally provider-neutral/manual until an owner approves a live provider.
- The app is Arabic/RTL-capable, installable as a PWA, and includes keyboard-focus, skip-link, touch-target, safe-area, and reduced-motion CSS foundations.

### Expected but not yet proven end-to-end

- One coherent staff flow from today’s calendar to payment and rebooking.
- A clear visual distinction between `scheduled`, `confirmed`, `checked in`, `in service`, `completed`, `cancelled`, `no-show`, `paid`, and `unpaid`.
- A customer-facing explanation of whether a booking is pending, confirmed, deposit-paid, or awaiting staff action.
- A safe operational treatment for deposits, refunds, cancellation windows, and no-show charges. These are policy decisions and must remain configurable.
- A production-safe tax/invoice mode. Oman’s Tax Authority states that standard-rated supplies are generally 5% and that prices should be presented inclusive of tax under the VAT Law; the app should not hard-code a legal commitment without confirming the center’s registration and tax policy.

## 5. Main findings

| ID | Type | Affected user | Finding and impact | Severity | Product decision | Acceptance direction |
|---|---|---|---|---|---|---|
| D-01 | Defect risk / prioritisation | All staff | The repository exposes many advanced areas alongside the daily operating loop. New users may not know whether to start at Dashboard, Appointments, POS, or Customers. | High | Make “Today’s operations” the primary entry and keep advanced capabilities discoverable but secondary. | A new staff user can reach today’s appointments and create/complete a checkout in one obvious path. |
| D-02 | Missing expected capability | Reception / customer | Appointment lifecycle is richer in the data model than the visible customer/staff language implied by a simple four-value status enum. | High | Use separate appointment lifecycle and payment state in the UI; do not overload one badge. | Every appointment card shows service time, staff, lifecycle state, payment state, and next action. |
| D-03 | Missing expected capability | Manager | Exceptions are core salon work, but late arrival, reassignment, failed reminder, and unpaid completion need a unified “needs attention” surface. | High | Add an exception queue to Dashboard/Today, without changing the database contract initially. | Exceptions link directly to the corrective action and disappear only when resolved. |
| D-04 | Research-backed recommendation | Owner / customer | Modern salon workflows commonly connect booking, staff assignment, reminders, deposits, service records, payment, reviews, and rebooking. | Medium | Sequence these around the visit journey; avoid adding more isolated modules before connecting existing ones. | Each stage has a visible next step and traceable record. |
| D-05 | Legal/policy boundary | Owner / accountant | VAT treatment, cancellation fees, deposits, and refunds cannot be inferred safely from generic industry practice. | Blocker for regulated rollout | Keep configurable and approval-gated; do not invent a policy. | No tax or fee is silently added; invoice clearly shows configured basis and tax status. |
| D-06 | Accessibility quality | Keyboard, RTL, AT users | CSS foundations are strong, but source evidence alone cannot prove labels, semantic headings, dialog focus return, live-region announcements, or screen-reader names on every route. | Medium | Perform route-level accessibility verification before launch sign-off. | Keyboard-only journey succeeds on login → appointment → checkout; errors are announced and associated with fields. |
| D-07 | Operational trust | Owner / staff | README explicitly says there is no offline/fake operating mode and hosted Supabase state depends on migration application. This is honest but must be surfaced in onboarding and environment messaging. | High | Make environment/data readiness visible and block misleading “ready” states. | A user can tell whether they are on Demo/Staging/Production and whether data writes are available. |
| D-08 | Product coherence | Owner | AI booking leads, forecasting, accounting, payroll, and customer experience exist in the same product surface but are not necessarily part of the first-center launch. | Medium | Keep them behind role/feature readiness, not in the primary navigation for a new center. | First-run navigation presents only capabilities relevant to the center’s current setup and role. |

## 6. Recommended experience model

Primary navigation should be organised around work, not implementation modules:

1. **Today** — appointments, check-in, exceptions, quick booking, quick checkout.
2. **Customers** — customer record, history, notes, service files, rebooking.
3. **Sales** — POS, receipts, packages, gift cards, payment review.
4. **Team & stock** — staff schedule/attendance, services, inventory.
5. **Insights** — reports, expenses, payroll/accounting for authorised roles.
6. **Settings & support** — center setup, notifications, privacy, help.

This is an information-architecture recommendation only; it does not delete routes or stored capabilities.

## 7. Research basis

- The [Oman Tax Authority VAT portal](https://tms.taxoman.gov.om/portal/vat-tax) and [VAT Law](https://tms.taxoman.gov.om/portal/documents/20126/1414820/VAT%2BLaw%2B.pdf/9cbe8926-066b-d48d-2b7f-14f41b4c19a8?t=1733169733344) are the authority for tax decisions.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires identifiable text errors, labels/instructions, and error prevention for financial or data-changing actions.
- [W3C mobile guidance](https://www.w3.org/TR/wcag2mobile-22/) confirms WCAG 2.2 should be applied to mobile web/PWA experiences.
- Industry workflow references consistently position scheduling, staff assignment, reminders, deposits/no-show handling, service records, payment, and rebooking as a connected salon journey. These are product expectations, not legal requirements; examples include [OctopusPro](https://octopuspro.com/salon-management-software/) and [Bookr](https://bookr.co/blog/7-must-have-features-in-salon-management-software).

## Execution baseline — 2026-08-21

### Verified against current source

- DashboardPage already loaded today appointments and low-stock products.
- AppointmentsPage already had real loading, error, empty, status-filter, and role-protected route behavior.
- Appointment has lifecycle statuses and deposit/no-show policy fields, but no paymentStatus, invoice link, or check-in/service state.
- Checkout remains a separate atomic POS flow; no new database or payment policy was introduced.

### Contradiction resolved

The original acceptance language implied that a paid/unpaid state could be rendered on appointment cards. The current contract cannot prove that state. The implementation therefore renders a truthful payment handoff label (Payment at checkout or Deposit configured) and keeps lifecycle status separate. A real paid/unpaid badge remains blocked until an existing invoice relationship or approved contract is verified.

### Execution status

- P0.1 Today Workspace: **IN PROGRESS** — implemented in source; browser and hosted-flow verification pending.
- P0.2 Appointment Card Contract: **IN PROGRESS** — lifecycle/payment separation implemented; true payment state remains unverified by contract.
- P0.3 Needs Attention: **IN PROGRESS** — late appointments and low stock implemented from real loaded data; failed-write/unconfirmed-payment signals remain unavailable without a source.
- P1: **BLOCKED** for check-in/service state until the existing contract is verified or owner-approved schema work is required.

### Verification attempt

- GitHub Actions run 50 was triggered for PR #40 but both jobs failed before any step was recorded (steps: []); the failure is runner/infrastructure-level and does not identify a source assertion.
- The Vercel preview status is blocked by the external free-plan deployment limit (api-deployments-free-per-day).
- Therefore rendered-browser, build, and hosted-flow acceptance remain **BLOCKED**, and no P0 item is marked DONE.
