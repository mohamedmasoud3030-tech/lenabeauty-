# FEATURE_GAP_STRATEGY — LenaBeauty

**Date:** 2026-08-18  
**Product:** Staff-only salon/spa operations PWA for one Omani/GCC beauty center.  
**Primary outcome:** The team books the day, takes payment, and keeps customer/stock/staff records without leaving the app.  
**Roles:** ADMIN (settings, money, team), STAFF/MANAGER (front desk + POS). MANAGER has no extra product surface.  
**Business model (inferred):** Single-tenant operations tool, not a consumer marketplace. Revenue for *this* product is the center’s own sales, not SaaS billing inside the app.  
**Maturity:** Local contracts are strong; hosted Demo acceptance and live Auth email are still blocked on owner-held secrets.

Industry sources used for expectation (not a feature wishlist): salon software in 2026 treats **scheduling + POS + CRM + reminders** as the non-negotiable stack; online booking, automated WhatsApp, and card-present payments are competitive, not table-stakes for a *staff-only* first release. [1](https://dingg.app/blogs/top-7-salon-management-softwares-in-the-us-2025-edition) [2](https://www.zenoti.com/thecheckin/spa-and-salon-management-software-guide) [3](https://biz.booksy.com/blog/how-to-find-the-best-salon-software-for-small-businesses-features-to-consider)

---

## Sequence (one path)

**Now → Next → Later → Do not build** is the only roadmap. Do not un-defer accounting/forecasting/AI until this path is done.

### Now (this session)

**Staff password recovery** — trust/safety + expected usability.

| | |
|---|---|
| Evidence | Login has no forgot-password path (`LoginPage.tsx`). `PROJECT_OVERVIEW` lists password reset as missing. A locked-out receptionist cannot sell. |
| Users | Every staff member; ADMIN who would otherwise share passwords. |
| Rationale | Industry-standard Auth recovery. Blocks the core outcome when the only login is email/password. |
| Value | Restores access without a developer or password sharing. |
| Dependencies | Existing Supabase Auth. Hosted project must allow the reset redirect URL and send Auth email. |
| Risk | Email enumeration if we reveal “unknown email” — mitigated with a generic success copy. Redirect must stay on-app (`#/reset-password`). |
| Cost | No new vendor. Supabase Auth email is already in the stack. |
| Smallest slice | Request link + set new password + tests. Implemented this session. |
| Acceptance | See spec below. |
| Success | Staff can regain access without owner intervention; no email enumeration in UI. |

### Next (after hosted Demo works)

1. **Invite / create real Auth users from Employees** — today Employees are records, not logins (S-01). This *is* a core blocker but needs a server-side invite policy and owner-held service role. Not implemented here.  
2. **Honest WhatsApp reminder from the appointment card** — already a manual `wa.me` handoff; tighten copy only. Paid WhatsApp Business API is a commercial decision.  
3. **Hosted Demo migration acceptance** — owner secrets + Actions. Without it, no new data feature is proven live.

### Later (growth, after the center runs a month on Demo)

- Public online booking (re-enable RPCs with rate limits, spam, deposit policy).  
- Automated reminders with a real provider and customer consent.  
- Card-present / Thawani-class checkout (merchant account + webhooks).  
- Commission *policy* (owner legal/commercial).  
- Waitlist, memberships, marketing campaigns.

### Do not build

| Item | Why |
|---|---|
| AR try-on, video consults, AI chatbot, fabricated testimonials | Maintenance without proven demand; violates no-fabricated-data rule. |
| Un-defer Accounting / Forecasting / Automation as-is | Incomplete empty/error/brand surfaces; hide until honest. |
| Dual public booking + staff calendar as two products | Dead pages already contradict the staff-only release. |
| Fake offline / fake backup restore | False trust. |
| In-app SaaS billing for LenaBeauty itself | Wrong product; this app runs one center. |
| Dark-mode “premium glass” expansion | Cosmetic; does not change outcomes. |

---

## Other gaps (classified, not sequenced as a menu)

**Blocks core outcome**

- Cannot issue login accounts from the product (employees ≠ Auth users).  
- Hosted schema may lag migrations — Demo apply still blocked.

**Trust / safety / recovery**

- Partial JSON export is not disaster recovery.  
- Hard-delete of customers/employees can erase history.  
- Password recovery — *addressed Now*.

**Expected usability**

- Forgot password — *addressed Now*.  
- Manual appointment reminder is already honest; do not fake “sent”.  
- PageHeader inconsistency (22 pages) is polish, not a capability.

**Competitive / growth**

- Online booking, WhatsApp automation, live card payments, memberships.

**Optional / wait**

- Multi-location as a first-class product, AR, AI leads table, Tauri/SQLite.

**Simplify / hide / merge**

- Keep accounting, forecasting, customer-experience, automation **deferred**.  
- Do not resurrect Landing/Booking/Portal routes.  
- MANAGER role: either give it a real job or stop advertising it.

---

## Implementation spec — staff password recovery

**Purpose:** A staff member who forgot their password can request a reset email and set a new password without an administrator sharing secrets.

**User-visible**

1. Sign-in shows “Forgot password?” (button, not a competing primary CTA).  
2. They enter the same work email.  
3. Success copy is always: *If an account exists for that email, a reset link has been sent.*  
4. Email link opens `#/reset-password`.  
5. Valid recovery session: set password (≥ 8 chars) + confirm.  
6. After update, they must sign in again.  
7. Missing/expired session: explain and send them back to sign-in.

**Technical**

- `AuthRepository.requestPasswordReset` → `resetPasswordForEmail` with `passwordResetRedirectUrl()`.  
- `AuthRepository.updatePassword` → `updateUser({ password })`.  
- Public route `/reset-password` (not behind `RequireAuth`).  
- No migration. No new secrets in the repo.

**Hosted prerequisite (owner, not this checkout):** add `https://<demo-host>/#/reset-password` to Supabase Auth redirect allow-list; confirm Auth email is enabled.

**Tests**

- Redirect helper keeps the hash route.  
- Login reset request calls the port and shows the generic success.  
- Reset page without a session shows the expired-link message.

**Rollback:** revert the feature commit; Auth emails already sent remain valid until they expire.

**Not in this slice:** inviting users, changing password while already signed in, SMS reset.
