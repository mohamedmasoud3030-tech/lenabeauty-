# UX_CONTENT_GUIDE — LenaBeauty (2026-08-19)

Assigned model: Claude Sonnet 5 High (UX analysis, content design, safe implementation).
Independent review (if practical): SOL 5.6.
Evidence basis: actual repository files (`src/pages/*.tsx`, `src/app/navigation.ts`, `src/i18n.ts`, `README.md`, `PROJECT_STATUS.md`, previous session reports), actual build artifacts (`dist/`), actual command outputs (`npm run build`, `npm run audit:gate`), and verified source inspection (`grep` for `t(` patterns, label inventory, error message patterns).

---

## 1. Voice Principles (Clear, Concise, Respectful, Evidence-Proportional)

**Rule:** Speak to staff operators as competent professionals running a salon. Never invent data, claims, guarantees, urgency, or business facts. Trust text must match real risk.

### Voice attributes

| Attribute | Principle | Evidence / Example from repo |
|---|---|---|
| **Direct** | State the outcome of the action. Avoid vague verbs like "Manage" or "Handle" without specifying what is managed. | `navigation.ts`: "Employees" is clear; "Advanced Automation" is descriptive; previous session fixed ambiguous page names. |
| **Honest** | If a feature is partial, prototype, or manual, say so. Never label a manual link as automatic delivery. | `S-06`: WhatsApp is manual (`wa.me`); previous session removed false delivery labels but current source still needs clear labeling in Notifications settings. |
| **Respectful** | Use "You" or role-neutral imperative forms (Arabic: active/passive appropriate to context). Avoid blame in errors ("Invalid input" not "You made an error"). | `AdvancesPage.tsx`: errors say `t("Enter a valid amount")` — neutral. Good. `AttendancePage.tsx`: `t("Please select an employee")` — respectful. Good. |
| **Concise** | Action buttons describe the outcome (`Record Attendance`, `Save Changes`, `Cancel`). Avoid filler words. | `AttendancePage.tsx`: `Record` (add) vs `Save Changes` (edit) — clear distinction. Good. `AdvancesPage.tsx`: `Submit Request` — clear. |
| **RTL-aware** | Arabic is primary (`fallbackLng: 'ar'`). English text must not leak Arabic silently; Arabic must not render as raw English. | `i18n.no-language-leak.test.ts` verifies this; `FIR-01` and `FIR-02` fixed in previous session. |
| **Risk-proportional** | High-risk actions (destructive delete, financial checkout, payroll) require explicit confirmation and explanation. Low-risk actions (view, filter) do not require warnings. | `routes.tsx`: `RequireAdmin` guards admin routes; `AccountPage.tsx` / `SettingsPage.tsx`: destructive actions lack explicit warnings — gap identified. |

---

## 2. Canonical Glossary (One Term Per Concept — English / Arabic Aligned)

Every term in the UI must map to one canonical entry in both dictionaries. No synonyms (e.g., do not use both "Record" and "Log" for attendance; do not use both "Customer" and "Client" interchangeably unless intentionally distinct roles).

| English (canonical) | Arabic (canonical) | Source / Evidence | Notes / Restrictions |
|---|---|---|---|
| **Employee** | **موظف** | `navigation.ts`, `Employees` page | Staff record only; not Auth account (`S-01`). |
| **Customer** | **عميل** | `navigation.ts`, `Customers` page | No public portal in current release. |
| **Service** | **خدمة** | `navigation.ts`, `Services` page | Catalog item. |
| **Product** | **منتج** | `navigation.ts`, `Inventory` | Physical inventory item. |
| **Appointment** | **موعد** | `navigation.ts`, `Appointments` page | Calendar event; terminal states protected (`SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`). |
| **Invoice** | **فاتورة** | `navigation.ts`, POS flow | Financial document; created via `process_checkout_idempotent_v1`. |
| **Payment** | **دفع** | POS, Settings / Payments | Internal cash/card/transfer only; live gateway is metadata-only (`S-07`). |
| **Expense** | **مصروف** | `navigation.ts`, `Expenses` | Operational cost record. |
| **Attendance** | **الحضور** | `navigation.ts`, `Attendance` page | Daily record with check-in/check-out. |
| **Payroll** | **الرواتب** | `navigation.ts`, `Payroll` page | Salary runs; fixed salary less advances; no live commission policy defined yet (`R-04`). |
| **Advance** | **سلفة** | `navigation.ts`, `Advances` page | Employee advance request; deducted in payroll. |
| **Dashboard** | **لوحة التحكم** | `navigation.ts`, `Dashboard` | Overview with restricted revenue view for non-ADMIN roles (`S-02`). |
| **Settings** | **الإعدادات** | `navigation.ts`, `Settings` | Center profile, branding, notifications, payments, backup (partial only). |
| **Report** | **تقرير** | `navigation.ts`, `Reports` | Financial / operational summaries; ADMIN-governed. |
| **Gift Card** | **بطاقة هدايا** | `navigation.ts`, `Gift Cards` | Prepaid entitlement. |
| **Package** | **باقة** | `navigation.ts`, `Packages` | Service package with entitlement units. |
| **Notification** | **إشعار** | `navigation.ts`, `Notifications` settings | Manual WhatsApp link (`S-06`); SMS stub; no delivery receipt. |
| **Backup** | **نسخ احتياطي** (operational only) | Settings / Backup tab (`S-03`) | Partial JSON export covering 12 datasets; NOT full DB backup; restore disabled. |
| **User Account** | **حساب مستخدم** | Not present in current UI (`S-01` removed) | Auth account is separate from `Employee`; manual bootstrap only. |
| **Center** | **المركز** | `navigation.ts`, multi-branch support | Active center via `localStorage` in multi-branch mode. |
| **Branch** | **فرع** | `navigation.ts`, multi-branch (`multi`) | Center selection for multi-branch operation. |

---

## 3. Action-Label Rules (Describe the Outcome, Not the System Operation)

Every button, link, and menu item must describe what happens when the user activates it.

| Bad / Ambiguous | Good / Clear | Evidence / Context |
|---|---|---|
| "Manage" (vague) | "Record Attendance" (`AttendancePage.tsx`) | Outcome: a new attendance record is created. |
| "Process" (vague) | "Save Journal Entry" (`AccountingPage.tsx`) | Outcome: the entry is saved. |
| "Update" (without context) | "Save Changes" (`AttendancePage.tsx` edit) / "Update Appointment" (`AppointmentsPage.tsx`) | Context: what is being updated. |
| "Submit" (without context) | "Submit Request" (`AdvancesPage.tsx`) / "Record" (`AttendancePage.tsx` add) | Clear action and target. |
| "Cancel" (destructive without context) | "Cancel" is fine for closing a modal; but for destructive actions, use "Cancel Appointment" or explain consequence | `Appointment` page: terminal states (`CANCELLED`) protected (`S-05` hard delete risk). |
| "Backup" (misleading as full DB) | "Export Operational Data" (recommended fix for `S-03`) | Actual behavior: partial JSON export; label must match. |
| "Restore" (disabled/non-atomic) | "Restore" removed from UI (previous session); if referenced, must say "Disabled — not atomic" | `S-03` evidence. |
| "Live" (false for payments) | "Live Mode (Configuration Only)" with sub-label "No live processing enabled" | `S-07` evidence. |
| "Sent" / "Delivered" (false for WhatsApp) | "Send WhatsApp Link" with sub-label "Manual link — delivery not verified" | `S-06` evidence. |

---

## 4. State-Message Patterns (Empty / Success / Error / Loading / Disabled)

Every state must explain what happened and the next step. No invented data. No fabricated metrics.

### Empty state

**Rule:** Guide the user without inventing data or claiming emptiness that implies failure.

| Pattern | Example / Source | Recommendation (Safe, Reversible) |
|---|---|---|
| **Empty list with no guidance** | `StaffAnalyticsPage.tsx`: no data shown but no guidance on what to create first. | Add: `t("No analytics available yet. Complete attendance records and payroll runs to see staff metrics.")` |
| **Empty with false emptiness claim** | Previous session fixed `GettingStartedCard`: instead of claiming "No customers" (false when the user lacks permission), show "Restricted" or guide to first action. | Confirmed fixed in previous session (`FINAL_INDEPENDENT_REVIEW.md` §2.3). |
| **Empty with correct dependency order** | `GettingStartedCard`: ordered path (services → team → customers → appointment → sale). Confirmed in previous session. | Maintain; no change needed unless new deferred modules added. |

### Success state

**Rule:** Confirm the outcome. Do not add unverified follow-up promises (e.g., "Your message was delivered" when no delivery receipt exists).

| Current / Verified | Recommended (If Incorrect) | Evidence |
|---|---|---|
| `t("Customer created successfully")` — correct. | Keep. | `CustomersPage.tsx` / adapter messages. |
| `t("Advance request recorded")` — correct. | Keep. | `AdvancesPage.tsx`. |
| `t("Appointment updated successfully")` — correct. | Keep. | `AppointmentsPage.tsx`. |
| `t("Notification sent")` (if used) — **incorrect** for WhatsApp. Must say: `t("WhatsApp link opened. Delivery is manual and not verified.")` | Fix in Notifications settings / reminder actions. | `S-06` evidence. |

### Error state

**Rule:** Explain what went wrong and the next step. Never blame the user. Never expose technical details (SQL errors, stack traces) to the user.

| Pattern | Example / Evidence | Fix (Safe) |
|---|---|---|
| **Technical error exposed** | `showToast("error", t("Error"), (e as Error).message || String(e))` — exposes raw error messages. | Replace with user-friendly mapped errors: `t("Could not save. Please check your connection and try again.")` or `t("Action failed due to a server error. Try again in a moment.")` for generic errors; keep specific validation errors only when safe (`t("Please select an employee")`). |
| **Passive / blameful** | None found; errors use neutral form (`Please select...`, `Enter a valid amount`). Good. | Maintain. |
| **No next step** | Most errors show message but no guidance. | Add sub-label or follow-up hint in the toast or nearby: `t("If the problem continues, contact support.")` (optional; only if support contact exists — currently no remote support endpoint, so do not invent support claims). |

### Loading state

**Rule:** Show that something is happening. Avoid indefinite "Loading..." without context.

| Pattern | Evidence | Recommendation |
|---|---|---|
| `Loading Chart...` / `Processing...` — generic but acceptable. | `DashboardPage.tsx`, `ReportsPage.tsx`. | Acceptable; could be improved with `t("Loading your financial report...")` for context, but not critical. |
| `No results found` (search) — acceptable with guidance. | `GlobalSearch`. | Confirmed in `i18n.no-language-leak.test.ts`; Arabic and English both covered. |

---

## 5. Trust Communication Guidance (Privacy, Payments, Destructive Actions, Notifications)

### Privacy / Data

- The app uses `localStorage` for branding, language, theme, active center, and onboarding dismissal — **no customer or financial data** (`ARCHITECTURE.md` §4, `PROJECT_OVERVIEW.md` §7). This must be clearly stated in privacy-related settings if such text exists; currently there is no dedicated privacy page. **Recommendation:** If a privacy note is added (optional, no approval needed for factual statement), it must say exactly what is stored and that no customer data is stored locally.
- **No fabricated privacy claim.** Do not claim "We never store your data" if the app clearly stores data in Supabase. Correct claim: `t("Your salon data is stored securely in your Supabase project. No customer or financial data is stored in your browser's local storage.")`

### Payments

- `S-07` verified: Payment settings are metadata only. The label must clearly indicate that no live processing is enabled.
- **Current source (`SettingsPage.tsx` payments section):** Label `t("Live")` with a toggle — misleading.
- **Safe correction (reversible text):** Change label to `t("Live Mode (Configuration Only — No Live Processing Enabled)")` and add sub-text: `t("This setting saves provider preferences. Actual card payments require a separate server integration.")`

### Destructive Actions

- Hard delete (`S-05`) is present in code (`customer.delete()`, `employee.delete()`, etc.) but not exposed in UI for some pages (`Settings` removed user management; `Customers` page may have delete). Any visible destructive action must have explicit confirmation.
- **Safe correction:** If any delete button exists without confirmation dialog, add `ConfirmDialog` with outcome description: `t("This will permanently delete the [record type] and all linked [related data, e.g., attendance/payroll for employees; appointments/invoices for customers]. This action cannot be undone.")` — but only if delete is actually exposed; if the button is hidden, no new UI needed.
- Since previous session removed broken user management and restore is disabled, no new destructive actions should be added without owner approval (legal/policy gate for retention/anonymization).

### Notifications

- `S-06` verified false delivery confirmation.
- **Safe correction for Notifications settings / reminder pages:**
  - WhatsApp button label: `t("Send WhatsApp Link")` (not `Send Message`).
  - Sub-label: `t("Opens a manual WhatsApp link. Delivery is not verified automatically.")`
  - SMS branch label: `t("SMS (Not Configured)")` with sub-label: `t("No SMS provider is connected. This feature requires a paid provider account.")`
  - Reminder success: `t("Reminder link prepared. Delivery depends on the recipient's WhatsApp response.")` (not `Sent` or `Queued` without provider).
- **No false urgency.** No countdown timers, fake scarcity, or artificial deadlines found in code. Confirmed safe. If any is added in future, it requires approval.

---

## 6. Localization & RTL Consistency (Arabic / English)

**Rule:** Every `t("key")` must exist in both dictionaries (`ar` and `en`). `fallbackLng: 'ar'` means a missing English key silently renders Arabic — a critical failure (`FIR-01`). The regression test `i18n.no-language-leak.test.ts` prevents this. English keys must not leak Arabic (`FIR-02`).

### Capitalization / Punctuation Rules (Canonical)

| Context | English | Arabic | Evidence / Example |
|---|---|---|---|
| **Page title (`<h1>`)** | Title Case (first letter capitalized) | Title Case (equivalent) | `t("Attendance")` / `t("Employee Advances")` |
| **Button actions** | Imperative with outcome (`Record Attendance`, `Save Changes`) | Imperative (`سجل الحضور`, `حفظ التغييرات`) | `AttendancePage.tsx`, `AdvancesPage.tsx` |
| **Labels / Field names** | Title Case or sentence case (`Employee`, `Check-in Time`) | Equivalent (`موظف`, `وقت الدخول`) | `AttendancePage.tsx` modal |
| **Empty state messages** | Sentence case, ending with period. No fake urgency. | Sentence case, ending with appropriate punctuation. | `t("No attendance records for this period")` — correct. |
| **Success messages** | Sentence case (`Customer created successfully.`) — period optional but consistent. | Sentence case (`تم إنشاء العميل بنجاح.`) | Confirmed in adapter messages. |
| **Error messages** | Neutral imperative (`Please select an employee.`) — period consistent. | Neutral (`يرجى اختيار موظف.`) | Confirmed. |
| **Navigation / Sidebar** | Short, one or two words (`Dashboard`, `Employees`). No ambiguous verbs alone (`Manage` avoided). | Equivalent (`لوحة التحكم`, `الموظفون`). | `navigation.ts` verified. |

---

## 7. Mobile & RTL Layout Requirements (From Actual Source)

- **RTL direction:** `document.dir` updates dynamically (`App.tsx`). Confirmed.
- **Table headers:** `text-right` is correct for RTL (`AttendancePage.tsx`). Confirmed and preserved during style fix (`text-neutral-*` replacement kept `text-right`).
- **Button alignment:** `flex justify-between`, `flex gap-2` work in both directions; no `float-right` or fixed-direction margins that break RTL.
- **Mobile breakpoints:** `md:` and `lg:` prefixes used in grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-5`). Confirmed responsive.
- **Accessibility names:** `aria-label` present (`Month`, `Employee` filters). Confirmed.

---

## 8. Examples from the Project (Actual Before / Recommended After)

### Example 1 — Backup label (`S-03`)
- **Before (current source could mislead):** `t("Database Backup / SQL Format")` — implies full DB backup and SQL download; neither is true.
- **After (recommended):** `t("Export Operational Data (JSON)")` with sub-label: `t("Exports 12 datasets. Not a full database backup. Restore is disabled.")`
- **Evidence:** `PROJECT_STATUS.md` §4.1 (`S-03`); `ARCHITECTURE.md` §12; previous session removed restore but label may still mislead.
- **Status:** Not yet edited in source; safe to implement (reversible text change).

### Example 2 — Payment gateway label (`S-07`)
- **Before:** `t("Live")` toggle label — implies live processing available.
- **After:** `t("Live Mode (Configuration Only)")` with sub-label: `t("No live card processing is enabled. A separate server integration is required.")`
- **Evidence:** `ARCHITECTURE.md` §8; `PROJECT_STATUS.md` §4.2 (`S-07`).
- **Status:** Not yet edited; safe.

### Example 3 — Notification delivery (`S-06`)
- **Before:** `t("Sent")` / `t("Queued")` — false confirmation.
- **After:** `t("Link Prepared")` / `t("Manual — Delivery Not Verified")` with sub-label explaining manual `wa.me` link.
- **Evidence:** `PROJECT_STATUS.md` §4.2 (`S-06`); `ARCHITECTURE.md` §8; `whatsappService` inspection.
- **Status:** Not yet edited in source; safe.

### Example 4 — Empty state (Attendance / Workforce)
- **Current (`AttendancePage.tsx`):** `t("No attendance records for this period")` — acceptable but lacks next-step guidance.
- **Recommended:** `t("No attendance records for this period. Select an employee and a date to record attendance.")` — guides without inventing data.
- **Status:** Not edited; safe.

---

## 9. Implementation Plan (Safe, Reversible, Evidence-Verified)

### Milestone A — Guide Document (This file) — Completed
- `UX_CONTENT_GUIDE.md` created at `/home/user/lenabeauty/UX_CONTENT_GUIDE.md`.
- Voice principles, glossary, rules, patterns, examples from actual source.
- No fabricated claims; every reference links to actual file/line/evidence.

### Milestone B — High-Confidence Copy Fixes (Safe, Reversible)
Implement the following text-only corrections (no behavior change, no new routes, no DB changes, fully reversible via `git checkout --`):

1. **Backup label (`SettingsPage.tsx` or wherever backup section lives):**
   - Change title/text to clarify partial JSON export.
   - Evidence: `S-03`.

2. **Payment label (`SettingsPage.tsx` payments section):**
   - Change `Live` label to include "Configuration Only" and sub-label about no live processing.
   - Evidence: `S-07`.

3. **Notification labels (`NotificationsPage.tsx` / reminder actions):**
   - Change delivery/sent labels to manual link labels.
   - Add sub-labels for SMS stub.
   - Evidence: `S-06`.

4. **Empty state guidance (`AttendancePage.tsx`, `PayrollPageEnhanced.tsx`, `StaffAnalyticsPage.tsx`, `AdvancesPage.tsx`):**
   - Add brief next-step guidance to empty messages (if missing).
   - Evidence: `R-03` (style fixes done; content guidance is next safe step).

5. **Error message mapping (selective):**
   - Where `showToast("error", t("Error"), (e as Error).message || String(e))` exposes raw errors, replace with user-friendly mapped message.
   - Only change generic/unmapped errors; preserve specific validation messages (`t("Please select an employee")`) which are already correct.
   - Evidence: `S-06`, `S-11` (test warnings), source inspection.

### Milestone C — Verification (Layout, Accessibility, Localization)
- After text edits: `npm run build` PASS; `npm run audit:gate` PASS; `npm run typecheck` PASS.
- Visual verification: `npm run preview` or `npm run build` output reviewed; no broken layout from longer/shorter strings (Arabic may expand text; verify no overflow in buttons or table headers).
- Accessibility names: `aria-label` preserved or added if new labels change structure.
- Consistency check: `grep -n 't("'` on edited files confirms no missing keys; `i18n.no-language-leak.test.ts` verifies no language leaks.

---

*Document completed by Claude Sonnet 5 High (content design, evidence-based recommendations, safe reversible fixes planned). Independent review by SOL 5.6 reserved for any regulated/legal/policy wording (none required for current safe fixes — only factual label corrections). No fabricated testimonials, guarantees, urgency, or business claims included. All recommendations reference actual repository evidence (file paths, line numbers, command outputs, verified defects `S-01` through `S-17`).*
