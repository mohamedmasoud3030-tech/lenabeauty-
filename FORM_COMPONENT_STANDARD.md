# FORM_COMPONENT_STANDARD

Canonical form standard for LenaBeauty. Supersedes/absorbs `FORM_IMPROVEMENT_STANDARD.md` (prior round) and records the verified 2026-09-09 state plus standing rules. No form library is introduced; the standard is a pattern over native controls + `Modal`.

## Field rules
1. **Every input has a visible `<label>`** — the label wraps the control (`<label className="block space-y-1.5">`) or uses `htmlFor`. Placeholders are examples, never labels. (Verified fixed: gift cards, packages; locked by dialog-a11y tests elsewhere.)
2. **Control matches data:** text / `inputMode="decimal"|"numeric"|"tel"|"email"` / select / checkbox / date. Money: decimal inputMode, `formatOMRAmount` display (3 dp) — never `toFixed(2)`.
3. **Requiredness** is communicated by copy + validation (no red-star theatre). Server validation is trusted authority; client validation is fast feedback only.
4. **Sizing:** controls `min-h-11` (44px); ≥16px inputs under 640px (global CSS); primary action `min-h-11 px-4` — oversized CTAs (`h-14 px-8`) are normalized to the standard.
5. **RTL:** logical properties (`ps/pe/start/end`); `dir="ltr"` only on phone/email/code fields; chevrons/arrows flip via `rtl:rotate-180`.
6. **Autocomplete:** login email/password set; never fake autocomplete on money fields; contact fields use `type`/`inputMode` for the right virtual keyboard.

## Behavior rules
7. **Inline errors** next to the field; **toast** for server failure; both translated.
8. **Preserve input after recoverable failure** — dialog stays open, values intact (test-locked in dialog suites).
9. **Duplicate-submission prevention:** submit disabled while in-flight (`saving/checkingOut`), verified at all submit sites.
10. **Dirty-close guard:** `confirmCloseMessage` on dirty modal forms (Modal contract).
11. **Safe defaults:** new-record forms preselect sensible defaults (active toggles on, today's date); edit forms seed from the record.
12. **Destructive actions inside forms** (clear cart, cancel appointment, deactivate employee, settle payroll) go through `ConfirmDialog` or server RPC — never a bare button.
13. **Session/timeout/offline:** any auth failure fails closed to login with return path; offline is disclosed by the banner and writes remain online-only (no silent queueing).

## Field order & grouping
14. Identity first (name/code/title), classification second (category/type), money third (value/price), scheduling fourth (date/time/expiry), notes last (optional). Groups are separated by section headings inside the modal, not by blank space alone.
15. One primary action per form (bottom of modal footer or header-adjacent on page forms); secondary actions (preview/print) never compete visually with it.

## Canonical field inventory (per major form, verified)
| Form | Fields (order) | Standard notes |
|---|---|---|
| Login | email, password | autocomplete, show/hide, error surface |
| Customer add/edit | name, phone, notes/context per contract | phone `dir="ltr"` tel keyboard |
| Service add/edit | name, category, price, duration, active | toggle ≥44px |
| Product add/edit | name, cost, price, stock, thresholds | decimal inputMode |
| Employee add/edit | name, role, contact, salary fields, active | admin-only page |
| Expense add/edit | amount, category, date, note | OMR 3dp; modal footer save |
| Gift card sell | code, value (OMR), expiry, recipient, note (optional) | all labeled; submit ≥44px |
| Package create | name, services, price, description | all labeled |
| Booking dialog | service, customer, employee, date/time, notes | overlap errors surfaced inline |
| Attendance / advance / payroll modals | employee, period/date, values | money server-computed |
| Settings sections | per section (profile / launch / export / branding / notifications / payments) | save per section with in-flight state |

## Migration rule
Fix form problems once at the shared pattern level (label pattern, `min-h-11`, disable-while-saving, ConfirmDialog) — never fork per-page fixes. The remaining per-page deltas from this standard are tracked in `INTERFACE_MIGRATION_PLAN.md`.
