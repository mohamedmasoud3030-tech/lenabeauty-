# ONBOARDING_ACTIVATION_PLAN — LenaBeauty

**Date:** 2026-08-18  
**Model:** Guided empty-center path (no tour, no modal spam).  
**First meaningful value:** The center can take a real sale (service catalog + acting employee + customer + POS). Booking the first appointment is the step immediately before that.

## Journey

| Stage | Who | What they see | Next action |
|---|---|---|---|
| Entry | Anyone | Login: what the product is, staff-only, work email, forgot password | Sign in or request reset |
| No account | Anyone | Honest copy: administrator issues accounts. No sign-up form. | Contact their admin |
| Expired session | Anyone | Returned to login with intended path preserved (`RequireAuth`) | Sign in again |
| Empty center — ADMIN | Owner | One setup card: services → team → customer → appointment → sale. Header CTA is **Add your services**, not New Invoice. Today/stock empty panels stay hidden until there is history. | Create a service |
| Empty center — STAFF | Reception | Same order, but **team** is explained, not linked (`/employees` is admin-only). | Create service/customer they can reach; wait on team |
| Catalog exists | All | Guide retires. Greeting becomes “Welcome back”. Header CTA is New Invoice. Today’s appointments return. | Book / sell |
| Return visit | All | Dismissed guide stays dismissed on this device. Password reset remains on `/#/reset-password`. | Daily work |

## Decisions

- **No sample/demo records.** Fabricated clients would violate the no-fake-data rule.
- **No product tour.** The dependency order is the onboarding.
- **No extra profile fields** after login. Membership already supplies role and center.
- **STAFF is not sent to admin routes.** That was a dead-end redirect.
- **First-run header does not advertise a sale** the catalog cannot fulfill.
- **“Healthy inventory” is not shown** when there are zero products.
- **Activation events** are device-local (`guide_shown`, `guide_dismissed`, `first_value_reached`). No personal data.

## Events (local only)

| Event | When |
|---|---|
| `guide_shown` | Setup card first becomes visible |
| `guide_dismissed` | User hides the card |
| `first_value_reached` | Center has services + team + customers (ready to sell) |

Success signal: share of new sessions that reach `first_value_reached` without a dismiss. Measured later from device logs if the owner wants analytics; not sent anywhere today.

## Acceptance

- Empty ADMIN center: 5-step guide, first step = services.
- Empty STAFF center: team step is not a button to `/employees`.
- Failed catalog reads hide the guide (never “empty”).
- First-run dashboard primary action is Add your services.
- Login still has one submit; forgot-password is secondary.
- New copy exists in Arabic and English.

## Owner policy (not implemented)

Inviting Auth users from Employees, and hosted Auth email for reset, need live credentials. Not asked here unless you want Demo email configured.
