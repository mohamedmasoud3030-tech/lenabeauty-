# FIRST_IMPRESSION_REVIEW — LenaBeauty

**Review date:** 2026-08-18
**Branch:** `arena/01a0153c-lenabeauty`
**Baseline commit:** `8814738`
**Scope:** what a first-time user understands, feels and does in the first minutes of the rendered product — public entry, authentication entry, first signed-in screen, navigation, empty states, trust signals.
**Method:** rendered-product inspection with no assumed knowledge, cross-checked against repository evidence (routes, components, i18n dictionaries, domain use cases, migrations, tests). Every issue below cites a file and line-level fact, not an opinion.

---

## 1. Evidence base

| Source | What it establishes |
|---|---|
| `src/routes.tsx` | `/` redirects to `/login`. There is no public marketing or booking route. Every other path requires auth. |
| `src/pages/LoginPage.tsx` | The only pre-auth surface a real user can reach. |
| `src/infrastructure/supabase/repositories.ts:182-187` | `SupabaseAuthAdapter.login()` calls `signInWithPassword({ email: username })`. The credential is an **email**. |
| `src/pages/DashboardPage.tsx` | The first signed-in screen. |
| `src/ui/layout/Layout.tsx`, `src/ui/layout/Sidebar.tsx` | Navigation labels, grouping, header actions. |
| `src/config/env.ts:20-22` | The optimized build embeds the **Demo/Staging** Supabase project as its fallback target. |
| `PROJECT_OVERVIEW.md` §4.1 | Confirmed absent: sign-up UI, password-reset UI, invitation UI. |
| `docs/DEMO_OPERATOR_GUIDE.md` §2 | Approved positioning: hosted **single-customer, single-center** staff PWA. Explicitly *not* multi-tenant SaaS, not offline desktop software. |
| `src/index.css:50-95` | Brand tokens: violet `--primary: 258 90% 66%` (#8B5CF6) + rose secondary on plum surfaces; the file explicitly forbids navy. |
| `src/pages/LandingPage.tsx` | 284 lines, **unrouted dead code**, containing fabricated testimonials and claims for deny-by-default features. |
| `src/__tests__/landing-page-alignment.test.ts` | An existing test already forbids routing that landing page. |

---

## 2. Current perception — what the product actually communicates today

### 2.1 First paint (before React boots)

`index.html` renders a hardcoded splash: a `💇‍♀️` emoji, the text "Lena Beauty", and a **navy/slate gradient** (`#1e293b → #0f172a`).

Three different brand colors are declared at first paint:

| Location | Color | Matches brand tokens? |
|---|---|---|
| `index.html` splash gradient | `#1e293b` navy | ❌ — `src/index.css` states "never navy" |
| `index.html` `theme-color` (light) | `#caa348` gold | ❌ — no gold in the palette |
| `manifest` `theme_color` (vite.config.ts) | `#8B5CF6` violet | ✅ |

There is also **no `<meta name="description">` at all**, and the document title is the bare string `Lena Beauty`.

**Perceived:** an unfinished internal build, assembled from a template. The emoji reads as a placeholder.

### 2.2 Authentication entry — the real front door

A first-time user sees a floating card with: the logo, the wordmark `LenaBeauty`, the subtitle "إدارة تشغيل المركز" (*Salon operations*), two fields (**اسم المستخدم / Username**, **كلمة المرور**), a "Sign In" button, and the footnote "دخول الموظفين" (*Staff sign in*).

That is the entire pre-auth information surface. From it, a first-time user **cannot** answer:

- What does this product actually do? "Salon operations" is a category, not a capability.
- Who is it for? "Staff sign in" implies staff, but not *which* staff, or of what kind of business.
- What outcome does it promise? Nothing is stated.
- What happens after I sign in? Unknown.
- What do I do if I have no account? No answer, no route, no contact.
- Is my data real or a demo? No signal, although the build's default target **is** the Demo/Staging project.
- Is this trustworthy? No privacy statement at the exact moment credentials are requested.

### 2.3 First signed-in screen

The Dashboard opens with the badge **"لوحة التحكم الذكية" / "Intelligence Dashboard"**, the heading "مرحباً بعودتك" (*Welcome back*) — addressed to a returning user on a first visit — then four metric tiles, and a panel titled **"النشاط المباشر" / "Live Activity"**.

For a brand-new center (0 services, 0 customers, 0 appointments, 0 sales) the screen becomes a grid of six separate empty cards, each with its own call to action.

**Perceived:** a dense analytics dashboard for a business that is already running, shown to someone who has not yet entered a single record. Nothing indicates what to do first, and nothing reveals that **services must exist before anything can be sold**.

---

## 3. Intended perception — the product the repository actually is

Derived from routes, domain use cases, migrations and the approved positioning in `docs/DEMO_OPERATOR_GUIDE.md`:

| Dimension | Reality |
|---|---|
| **What it is** | A day-to-day operations system for **one** beauty/spa center. |
| **Who it serves** | The center's own team: reception/staff for the daily counter, the owner/admin for money, stock and workforce. |
| **What it is not** | Not a public booking site, not a customer-facing portal, not multi-tenant SaaS, not offline desktop software. Public booking and client-portal RPCs exist in the database but carry **zero client grants** — they are deny-by-default. |
| **Outcome promised** | One place to run the day: book the appointment, take the payment, keep the customer record, watch stock, and see what the center earned. |
| **Market** | Oman / GCC. Arabic-first with RTL, English secondary. Currency OMR at 3 decimals. |
| **Business model** | Single-customer hosted deployment (per the approved positioning). No pricing is communicated anywhere in the product — correctly, because none is decided. |

**The gap:** the product is a competent, opinionated operations tool, but it presents itself as an anonymous login box followed by a generic analytics dashboard. The experienced product is *narrower and vaguer* than the real product.

---

## 4. Issues found

Severity: **P1** blocks understanding or the first action · **P2** damages trust or perceived completeness · **P3** polish.

### P1 — Blocking

**FI-01 — The login field asks for the wrong credential.**
The field is labelled *Username* with `autoComplete="username"`, but `signInWithPassword({ email: username })` sends it as an email address. A first-time user types a username, receives "بيانات الدخول غير صحيحة" (*Invalid credentials*), and has no way to discover the real format. This is the single hardest failure in the first minute — the user cannot get in at all.
*Evidence:* `src/pages/LoginPage.tsx:276,292` vs `src/infrastructure/supabase/repositories.ts:185`.

**FI-02 — The product never says what it is.**
No sentence anywhere before authentication describes the product, its audience, or its outcome. "Salon operations" is the only hint.
*Evidence:* `src/pages/LoginPage.tsx` full render.

**FI-03 — A user without an account hits a silent dead end.**
There is no sign-up, no password reset, no invitation flow, and no explanation that accounts are issued by the center administrator.
*Evidence:* absent from `src/pages/LoginPage.tsx`; confirmed absent in `PROJECT_OVERVIEW.md` §4.1.

**FI-04 — The empty first-run dashboard offers no path and ~12 competing calls to action.**
On an empty center the user faces: header "New Invoice", three empty-state "New Invoice" buttons, "New Appointment", two "View All" links, and five equal-weight Quick Actions including "Settings". No ordering, no indication that Services must be created before a sale is possible.
*Evidence:* `src/pages/DashboardPage.tsx:255-330, 439-446, 517-525, 633-676`.

### P2 — Trust and completeness

**FI-05 — A fabricated trend is displayed on the revenue tile.**
`trend={summary?.canViewRevenue ? "+0%" : "—"}` — the string `+0%` is hardcoded and never computed. The most prominent financial tile shows an invented indicator.
*Evidence:* `src/pages/DashboardPage.tsx:275`.

**FI-06 — "Not permitted" is displayed as "No data".**
A STAFF user who is not authorized to see revenue is shown `—` with the sub-label "No data". The user is told the business has no revenue when in fact they are simply not allowed to see it.
*Evidence:* `src/pages/DashboardPage.tsx:272-277`.

**FI-07 — Unearned marketing language on operational surfaces.**
"Intelligence Dashboard" describes no intelligence feature. "Live Activity" is not live — it is a merged 90-day poll of appointments/customers/expenses recomputed only on manual refresh. Both inflate the product and both are the first words a user reads after signing in.
*Evidence:* `src/pages/DashboardPage.tsx:233,585` and `loadActivity()` at :128-195.

**FI-08 — Unrouted dead code contains fabricated social proof.**
`src/pages/LandingPage.tsx` ships three invented 5-star testimonials from fictional people, plus feature claims for **disabled** capabilities: "Book online", "Client Portal", "Desktop-Ready … offline-ready architecture". It is not routed today, but it sits in the shipped source as a standing risk of publishing fake proof.
*Evidence:* `src/pages/LandingPage.tsx:73-90, 26-62`; the deny-by-default status of those RPCs is recorded in `PROJECT_OVERVIEW.md` §2.

**FI-09 — The environment is invisible.**
The optimized build's default data target is the **Demo/Staging** Supabase project. Nothing in the UI tells the user whether the records they are creating are real. This directly contradicts the project's own "no fake operating mode" doctrine.
*Evidence:* `src/config/env.ts:20-22, 67-69`; `environment` is parsed but never rendered.

**FI-10 — Off-brand, template-grade first paint.**
Navy splash + gold `theme-color` + violet manifest = three brand colors before the app boots, plus an emoji placeholder and no meta description.
*Evidence:* `index.html:12-13,30-38`; `src/index.css:59`; `vite.config.ts:36`.

**FI-11 — "Welcome back" greets a first-time user.**
The first signed-in heading assumes a returning user.
*Evidence:* `src/pages/DashboardPage.tsx:236`.

### P3 — Hierarchy, RTL and polish

**FI-12 — RTL defect in the app header.** `ml-auto` is a physical-direction class used inside an RTL-first layout; it should be the logical `ms-auto`.
*Evidence:* `src/ui/layout/Layout.tsx:217`.

**FI-13 — Vague navigation group label.** The sidebar group "Business / العمل" is a meaningless IA label for what it contains (Customers, Services, Inventory, Employees).
*Evidence:* `src/ui/layout/Sidebar.tsx:87`.

**FI-14 — Flat typographic hierarchy.** Nearly every label is `font-bold uppercase tracking-widest`, so section titles, metric captions and helper text carry equal visual weight; nothing leads the eye.
*Evidence:* pervasive in `DashboardPage.tsx` / `Sidebar.tsx`.

**FI-15 — Raw palette and physical alignment on deep workforce pages.** ~80 occurrences of `text-gray-*` / `bg-gray-*` and hardcoded `text-right` in Attendance / Payroll / Advances / Staff Analytics. Off-brand in both themes and mis-aligned in English.
*Evidence:* `src/pages/AttendancePage.tsx:193-248`, `src/pages/PayrollPageEnhanced.tsx:251-252`.
*Disposition:* **documented, not fixed in this pass** — these are admin-only pages reached well after the first minutes, and a bulk restyle is a larger, separately verifiable change.

---

## 5. Selected direction

**Strategy: "An honest operational tool, not a marketing SaaS."**

The product is a single-center staff system with no public audience, no self-serve sign-up and no pricing. Presenting it with marketing furniture (testimonials, "intelligence", "live", invented trends) makes a genuinely solid tool look like an unfinished template. The direction is therefore to **compete on clarity and truthfulness, not on claims**.

| Decision | Choice |
|---|---|
| **Primary message** | "The daily operations system for one beauty center — appointments, point of sale, customers, stock and staff." |
| **Audience** | The center's own team. Stated explicitly, in both languages. |
| **First action (pre-auth)** | **One** action: sign in with your work email. No secondary CTA. |
| **First action (post-auth, empty center)** | **One** ordered path, in real domain dependency order: Services → Employees → Customers → first Appointment → first Sale. |
| **Hierarchy** | Identity → what it is → who it is for → single action → trust. On the dashboard: what needs doing today → what happened → deeper analysis. |
| **Trust content** | Verifiable facts only: how accounts are issued, where data lives and who can see it, the active environment, language/theme control. |
| **Removed** | Fabricated testimonials; the hardcoded `+0%` trend; the unrouted landing page. |
| **Demoted** | "Intelligence Dashboard" → "Today at your center"; "Live Activity" → "Recent Activity"; "Settings" out of Quick Actions; competing empty-state CTAs behind one ordered guide. |
| **Explicitly not added** | No pricing, no ratings, no customer logos, no uptime/security claims, no feature promises for deny-by-default booking/portal. None of these can be truthfully evidenced today. |

### Copy decisions (English source; Arabic is the primary rendered language)

| Surface | Copy |
|---|---|
| Login — product line | "The daily operations system for one beauty center." |
| Login — capability line | "Appointments, point of sale, customers, stock and staff — in one place." |
| Login — audience | "For the center's team. This is not a customer booking site." |
| Login — what happens next | "After signing in you land on today's work: appointments, sales and stock alerts." |
| Login — account path | "Accounts are created by your center administrator. There is no public sign-up." |
| Login — privacy | "Your data stays in your center's database and is visible only to its team." |
| Login — credential | "Email" (replacing "Username") + "Use the work email your administrator registered." |
| Dashboard — badge | "Today at your center" (replacing "Intelligence Dashboard") |
| Dashboard — greeting | "Welcome" for a first visit / "Welcome back" once data exists |
| Dashboard — activity | "Recent Activity" (replacing "Live Activity") |
| Getting started | "Set up your center" — 5 ordered steps with real completion state |
| Environment badge | "Trial environment — data here is for testing" (non-production only) |

---

## 6. Implemented changes

All changes use existing brand tokens and existing shared components. Every change is reversible via Git.

| # | Change | Files | Fixes |
|---|---|---|---|
| 1 | Login credential corrected to **Email** (`type=email`, `inputMode=email`, `autoComplete=email`) with a helper line naming the exact format expected | `src/pages/LoginPage.tsx` | FI-01 |
| 2 | Login product block: what it is, what it does, who it is for, what happens after sign-in | `src/pages/LoginPage.tsx` | FI-02 |
| 3 | Login trust block: how accounts are issued (no public sign-up), and where data lives | `src/pages/LoginPage.tsx` | FI-03 |
| 4 | `EnvironmentBadge` shared component, rendered on login and in the app header — only when the environment is **not** production | `src/shared/components/EnvironmentBadge.tsx`, `LoginPage.tsx`, `Layout.tsx` | FI-09 |
| 5 | `GettingStartedCard`: one ordered setup path driven by **real counts**, shown only while the center is genuinely incomplete, dismissible, self-retiring | `src/shared/components/GettingStartedCard.tsx`, `DashboardPage.tsx` | FI-04 |
| 6 | Fabricated `+0%` trend removed; tiles now show a real value or nothing | `src/pages/DashboardPage.tsx` | FI-05 |
| 7 | "Restricted" separated from "No data" on the revenue tile | `src/pages/DashboardPage.tsx` | FI-06 |
| 8 | "Intelligence Dashboard" → "Today at your center"; "Live Activity" → "Recent Activity" | `DashboardPage.tsx`, `src/i18n.ts` | FI-07 |
| 9 | Unrouted `LandingPage.tsx` with fabricated testimonials deleted; its guard test rewritten to assert the file no longer exists | `src/pages/LandingPage.tsx` (removed), `src/__tests__/landing-page-alignment.test.ts` | FI-08 |
| 10 | Brand-aligned first paint: plum/violet splash using the real logo mark, unified `theme-color`, real `<meta name="description">`, descriptive `<title>` | `index.html` | FI-10 |
| 11 | Greeting adapts: "Welcome" on a first visit, "Welcome back" once the center has data | `src/pages/DashboardPage.tsx` | FI-11 |
| 12 | `ml-auto` → logical `ms-auto` | `src/ui/layout/Layout.tsx` | FI-12 |
| 13 | Sidebar group "Business" → "Catalog & People" | `src/ui/layout/Sidebar.tsx`, `src/i18n.ts` | FI-13 |
| 14 | Quick Actions reduced from 5 to 4; "Settings" removed (already reachable from the sidebar and the user menu) | `src/pages/DashboardPage.tsx` | FI-14 |

All new copy is added to **both** the Arabic and English dictionaries and is covered by the existing `i18n.qa-coverage` guard, which was extended to include the two new components.

---

## 7. Measurable acceptance criteria

Each criterion is enforced by an executable test in `src/__tests__/first-impression.test.tsx` unless marked otherwise.

### A — Can a first-time user explain the product?
- **A1** The pre-auth screen renders a sentence naming the product category *and* the unit of business ("one beauty center"). ✅ enforced
- **A2** The pre-auth screen names at least four concrete capabilities (appointments, point of sale, customers, stock). ✅ enforced
- **A3** No pre-auth text claims a capability that is deny-by-default (public booking, client portal, offline desktop). ✅ enforced

### B — Can they identify who it is for?
- **B1** The pre-auth screen states the audience is the center's team. ✅ enforced
- **B2** The pre-auth screen states it is not a customer booking site. ✅ enforced

### C — Can they find the primary action?
- **C1** Exactly one submit control exists pre-auth. ✅ enforced
- **C2** The credential field is an email input (`type="email"`, `autoComplete="email"`) matching what the auth adapter actually sends. ✅ enforced
- **C3** No competing pre-auth CTA (no "Book Now", no "Client Portal", no "Open App"). ✅ enforced

### D — Do they understand what happens next?
- **D1** The pre-auth screen states where sign-in lands the user. ✅ enforced
- **D2** A user without an account is told how accounts are issued. ✅ enforced
- **D3** On an empty center, the dashboard renders one ordered setup guide whose first step is creating services. ✅ enforced
- **D4** The guide disappears automatically once the center has services, employees and customers. ✅ enforced

### E — Trustworthy and complete
- **E1** No fabricated trend/percentage is rendered on any metric tile. ✅ enforced
- **E2** Restricted financial data is labelled as restricted, never as absent. ✅ enforced
- **E3** No fabricated testimonial, rating or customer name exists anywhere in `src/`. ✅ enforced
- **E4** A non-production environment is disclosed in the UI; production shows no badge. ✅ enforced
- **E5** `index.html` declares a meta description and carries no color outside the brand tokens. ✅ enforced

### F — Accessibility, mobile and RTL
- **F1** Every new interactive control is ≥44px (enforced by the existing `scripts/lint-source.mjs` policy lint). ✅ enforced
- **F2** New surfaces use logical direction properties only — no `ml-`/`mr-`/`text-left`/`text-right`. ✅ enforced
- **F3** Every new `t()` key resolves in both Arabic and English (existing `i18n.qa-coverage` guard, extended). ✅ enforced
- **F4** The pre-auth product block is readable at 360px width without horizontal scroll. ⚠️ verified by responsive-class review + production preview; **not** verified in a real browser — no browser executable is installable in this environment.

### G — Regression safety
- **G1** Full suite green. **G2** `typecheck` green. **G3** `lint` green. **G4** `build` green. **G5** `audit:gate` green.

---

## 8. Verification results

All commands were executed in this environment after the changes. Nothing below is claimed without being run.

| Check | Result |
|---|---|
| `npm test` | **PASS — 108 files / 615 tests** (baseline was 107/599; +16 net new, 0 failures) |
| `npm run typecheck` | PASS — `tsc --noEmit`, 0 errors |
| `npm run lint` | PASS — TypeScript + source-policy lint, 231 files |
| `npm run build` | PASS — production build, PWA 55 precache entries |
| `npm run audit:gate` | PASS — after regenerating `frontend-usage.json` (source-file count 216 → 218) |
| `npm run db:types:check` | PASS |
| `npm run ci:migrations` | PASS — 36 canonical migrations |
| `npm run ci:rpc-check` | PASS — all frontend RPC references defined |
| `npm run desktop:test` | PASS — 6 files / 14 tests |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — no whitespace errors |
| Production preview smoke | PASS — `/`, manifest, service worker, brand mark all HTTP 200 |

### First-paint verification (served build, `vite preview`)

| Property | Observed |
|---|---|
| `<title>` | `LenaBeauty — نظام تشغيل مركز التجميل` |
| `<meta name="description">` | present, describes the product and its audience |
| `theme-color` | `#8B5CF6` / `#17131F` — brand tokens only |
| Navy `#1e293b` / `#0f172a` | absent |
| Emoji placeholder | absent |
| Brand mark `/lena-mark.svg` | present, HTTP 200 |

### Rendered comprehension readout

The real component tree was rendered at **360px** and **1280px**, in **Arabic** and **English**, and the visible text captured. Arabic output:

> LenaBeauty · نظام التشغيل اليومي لمركز تجميل واحد. · المواعيد ونقطة البيع والعملاء والمخزون والموظفون — في مكان واحد. · مخصص لفريق المركز. هذا ليس موقع حجز للعميلات. · بيئة تجريبية — البيانات هنا للاختبار · بريد العمل الإلكتروني · استخدم بريد العمل الإلكتروني الذي سجّله لك المسؤول. · كلمة المرور · تسجيل الدخول · بعد تسجيل الدخول تصل مباشرة إلى عمل اليوم… · الحسابات يُنشئها مسؤول المركز. لا يوجد تسجيل ذاتي. · بياناتك تبقى في قاعدة بيانات مركزك ولا يراها إلا فريقه.

First-run guide (Arabic, empty center): `جهّز مركزك · 0/5 · 1 أضف خدماتك — لا يمكن حجز أي موعد أو بيع أي خدمة قبل إنشاء قائمة خدماتك · 2 أضف فريقك · 3 أضف أول عميلة · 4 احجز أول موعد · 5 سجّل أول عملية بيع`.

A first-time user can now answer all four questions from the rendered screen alone.

### Criteria status

| Group | Status |
|---|---|
| A — can explain the product (A1–A3) | ✅ all pass |
| B — can identify the audience (B1–B2) | ✅ all pass |
| C — can find the primary action (C1–C3) | ✅ all pass |
| D — understands what happens next (D1–D4) | ✅ all pass |
| E — trustworthy and complete (E1–E5) | ✅ all pass |
| F — accessibility / mobile / RTL (F1–F3) | ✅ pass · **F4** verified in jsdom at 360px + responsive-class review, **not** in a real browser |
| G — regression safety (G1–G5) | ✅ all pass |

### Two defects caught by the new tests during implementation

Both were found by the acceptance suite before completion, and both were fixed rather than suppressed:

1. A step button in `GettingStartedCard` did not carry a 44px touch minimum → `touch-target` added.
2. The `F1` matcher stopped early on an arrow function inside a JSX prop, so it under-reported button declarations → matcher corrected to inspect the declaration window.

## 9. Not done, and why

| Item | Reason |
|---|---|
| Real-browser and real-device visual/keyboard/RTL acceptance | No browser executable can be installed in this environment (`playwright install chromium` fails: sandbox network + missing font packages). Verified instead via jsdom render tests, responsive-class review and the production preview server. |
| Restyling the workforce pages (FI-15) | Out of first-minutes scope; a ~80-occurrence restyle deserves its own verifiable change. |
| Any pricing, plan, guarantee or security claim | Requires an owner commercial decision. None invented. |
| Reviving public booking / client portal presentation | Those RPCs are deny-by-default with zero client grants. Presenting them would be a false promise. |
| Password-reset / invitation UI | A real feature, not a copy fix. The product now tells the truth about how accounts are issued instead of implying a flow that does not exist. |
