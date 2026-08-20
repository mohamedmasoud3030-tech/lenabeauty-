# Help & Support System — LenaBeauty

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Approved for repository-side implementation; no external support platform.

---

## 1. Design Principles

1. **Task-based, not feature-dump** — Articles answer "how do I…" questions from real
   workflows (onboarding, POS, appointments, permissions, recovery). No generic
   help-center that duplicates the interface.
2. **Verified content only** — Every article states behavior that is actually
   implemented. Unverified or aspirational claims are excluded. A freshness test
   pins the article registry to the app version.
3. **Contextual access** — A persistent Help button in the header plus deep links
   from error states. No modal spam, no forced tours.
4. **Safe intake** — Support tickets capture route, app version, environment, role,
   error reference, and expected-vs-actual. Never secrets, passwords, or private
   content. No data leaves the center's database without explicit approval.
5. **No paid platform** — Tickets are stored in the center's own database (RLS
   member-scoped). A future external platform requires owner approval.
6. **Consistent terminology** — Article copy reuses the same i18n keys and terms as
   the UI (POS, Appointments, OMR, etc.). Arabic/RTL and English/LTR both verified.

---

## 2. Content Map

| Slug | Title | Audience | Task | Verified behavior |
|---|---|---|---|---|
| `first-login` | First login and your role | All | Understand account access | Email+password; roles ADMIN/MANAGER/STAFF; no public signup |
| `set-up-services` | Adding your first services | ADMIN | Onboarding step 1 | Services page; active services sell at POS; STARTING_FROM pricing |
| `book-appointment` | Booking an appointment | All staff | Core workflow | Day/week view; customer+service+specialist; overlap protection |
| `take-payment` | Recording a sale at the POS | All staff | Core workflow | Cash/Card/Transfer manual tender; no live card charge; receipt print |
| `manage-customers` | Managing customers | All staff | Core workflow | Create/edit/search; history; notes; loyalty points |
| `permissions` | Who can see what | All | Permissions | ADMIN-only sections; MANAGER=STAFF operational scope; compensation hidden |
| `forgot-password` | Reset your password | All | Account access | Reset email link → reset page; no enumeration |
| `whatsapp-notifications` | WhatsApp reminders | ADMIN | Notifications | Manual wa.me link only; no automated delivery; SMS disabled |
| `backup-export` | Exporting your data | ADMIN | Data | Operational JSON export only; NOT a DB backup; restore disabled |
| `error-codes` | Understanding error messages | All | Errors | Error reference shown on screen; report ID; retry vs reload |
| `offline` | Working offline | All | Offline | PWA shell + recent data; writes require connection |
| `payment-gateway` | Online payments | ADMIN | Billing | Provider metadata only; sandbox flag; deposits recorded at checkout |

---

## 3. Ownership & Update Triggers

| Owner | Content | Update trigger |
|---|---|---|
| Product (this repo) | All articles | Any behavior change → update the matching article in the same commit |
| Freshness test | `help-articles.test.ts` | Pins article count + slugs; fails when registry drifts from known set |

Update rules:
- New feature ships → article added or existing article edited in the same PR/commit.
- Behavior change → article updated in the same commit (test enforces awareness).
- Removed feature → article removed in the same commit.

---

## 4. Search & Navigation

- Help Center route `/help` — accessible to all authenticated roles (not admin-only).
- Search box filters by title and body keywords in the active language.
- Category chips (Getting started, Daily work, Permissions, Account, Data, Errors).
- Article deep link: `/#/help?article=<slug>` — shareable, restores on refresh.
- Header Help button (`?`) opens `/help` from anywhere.
- Error boundary shows a "Get help" link with the report ID prefilled.

---

## 5. Support Intake

### 5.1 Captured fields (safe context only)

| Field | Source | Example |
|---|---|---|
| Route | Auto (location.pathname) | `/pos` |
| App version | Auto (package.json version) | `1.0.0` |
| Environment | Auto (config.environment) | `staging` |
| Role | Auto (auth) | `ADMIN` |
| Error reference | Optional user input | `A1B2C3D4` (from error screen) |
| Expected behavior | User input | "The sale should record" |
| Actual behavior | User input | "It shows an error" |
| Contact email | Optional | — |
| Urgency | Optional low/normal/high | normal |

### 5.2 Explicitly NOT collected
- Passwords, tokens, session data
- Payment card numbers
- Customer/employee personal data (names, phones)
- Full error stack traces (fingerprint only)

### 5.3 Storage
- `support_tickets` table (RLS member-scoped, INSERT+SELECT only)
- Created via `create_support_ticket_v1` RPC (SECURITY DEFINER, `is_center_member`)
- No external transmission. No paid platform.

---

## 6. Urgency, Routing, Acknowledgement, Escalation

| Urgency | Definition | Response target | Escalation |
|---|---|---|---|
| Low | Cosmetic/feature question | Within 48h | — |
| Normal | Blocked workflow | Within 24h | — |
| High | Security/data/payment concern | Immediate triage, ack < 4h | Owner notified same day |

Security/data/payment escalation: any ticket whose free text matches payment,
security, data-loss, or unauthorized-access keywords is flagged `HIGH` and the
owner sees it first in the ticket list (Support Operations → Tickets).

---

## 7. Privacy

- Tickets stored in the center's Supabase database under RLS.
- No analytics provider, no third-party support SaaS.
- Article registry and intake contain no tracking pixels or external calls.

---

## 8. Acceptance Criteria

1. `/help` renders for ADMIN, MANAGER, STAFF (not login-gated beyond auth).
2. Search filters articles in both `ar` and `en`.
3. Deep link `/?help=slug` opens the article and highlights it.
4. Intake form validates: at least one of expected/actual is non-empty; no
   secrets pattern allowed (password/token/card regex reject).
5. Ticket saved via RPC; failure shows friendly error with retry.
6. Freshness test fails if article set changes without updating the test.
7. Mobile: list + article reader fit 320px; touch targets ≥ 44px; RTL correct.
8. No external network call from any help component.
