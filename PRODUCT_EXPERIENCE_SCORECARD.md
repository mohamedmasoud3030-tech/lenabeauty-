# LenaBeauty — Product Experience Scorecard

**Scale:** 1 = absent/unproven, 3 = usable but inconsistent, 5 = launch-ready and evidenced.

| Area | Score | Evidence | Launch meaning |
|---|---:|---|---|
| Core salon domain coverage | 4/5 | App has booking, POS, customers, staff, inventory, reports, packages, portal, notifications, attendance/payroll. | Coverage is strong; sequencing is the risk. |
| Daily workflow coherence | 2/5 | Many capable pages are documented; no local rendered walkthrough was possible in this session. | Launch blocker until the visit loop is proven visually. |
| Booking lifecycle clarity | 3/5 | Server RPCs support create/reschedule/cancel and status enum exists. | Separate lifecycle and payment presentation must be verified. |
| Checkout and financial integrity | 4/5 | Idempotent atomic checkout RPC and audit-oriented contracts are present. | Do not weaken; verify real hosted acceptance. |
| Customer continuity / retention | 3/5 | Portal, history, service files, reviews, packages, gift cards exist. | Connect follow-up/rebooking in the main journey. |
| Role clarity | 3/5 | ADMIN/MANAGER/STAFF concepts and admin-only RPCs exist. | Verify least-privilege UX route by route. |
| Arabic/RTL/mobile foundation | 4/5 | RTL font/layout rules, 44px target utility, safe areas, mobile input sizing, reduced motion. | Needs rendered route testing, not more speculative CSS. |
| Accessibility evidence | 2/5 | Focus/skip-link CSS exists; full semantic/keyboard/AT audit unverified. | Blocker for accessibility sign-off, not necessarily code release. |
| Offline/network recovery | 3/5 | Network status and explicit no-fake-mode contract exist. | User-facing recovery and retry must be verified. |
| Tax/compliance readiness | 2/5 | Oman market is explicit; tax policy is not established as a configured product contract. | Blocker for claiming tax-ready production. |
| Deployment/data readiness | 2/5 | README says hosted state depends on applying migration chain; no local live run. | Blocker for production launch claim. |

## Launch blockers

1. Prove the core journey on a real Demo/Staging environment: booking → check-in → completion → checkout → receipt.
2. Verify the hosted migration chain and generated types against the actual Demo database.
3. Decide, with owner approval, whether the center is VAT-registered and what cancellation/deposit/refund policies apply.
4. Complete a route-level mobile/RTL/keyboard/accessibility walkthrough.
5. Make environment readiness and failed-write recovery explicit to operators.

## Ready-to-improve now

- Navigation labels and grouping.
- Dashboard prioritisation and exception language.
- Appointment card information hierarchy.
- Consistent status/payment badges.
- Empty, error, permission, offline, and success copy.
- Focus and form semantics where verified locally.

## Execution status — 2026-08-21

| Item | Status | Evidence |
|---|---|---|
| P0.1 Today Workspace | IN PROGRESS | Dashboard now prioritises today’s schedule and exposes an operational CTA; build/browser verification pending. |
| P0.2 Appointment Card Contract | IN PROGRESS | Lifecycle and payment handoff labels are separate in desktop/mobile appointment cards; true payment state is not in Appointment. |
| P0.3 Needs Attention | IN PROGRESS | Derived from late scheduled appointments and low-stock records only; no fabricated failures. |
| P1.1 Check-in → Service → Completion | BLOCKED | No corresponding state or safe existing use case found in the current appointment contract. |
| P1.2 Checkout review step | NOT STARTED | Existing POS/atomic checkout preserved; not changed without rendered verification. |
| P1.3 Receipt → Rebooking | NOT STARTED | Existing customer/POS capabilities remain; continuity handoff not yet implemented. |
| P2 Role-based depth | NOT STARTED | Existing route guards preserved. |
| P3 Readiness and trust | NOT STARTED | Existing environment disclosure preserved; hosted verification still required. |

**Verification boundary:** No claim of PASS is made until CI/build and a rendered browser walkthrough run against this branch.

### Current verification blocker

The branch has not received a trustworthy build or rendered preview: GitHub Actions run 52 failed before recording steps, and Vercel is rate-limited. SonarQube Cloud Quality Gate passed, but it is not a build or browser acceptance. Scores and P0 statuses remain provisional until a real build and browser walkthrough complete.
