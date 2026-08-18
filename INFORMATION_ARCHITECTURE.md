# INFORMATION_ARCHITECTURE — LenaBeauty

**Review date:** 2026-08-18
**Branch:** `arena/01a0153c-lenabeauty`
**Scope:** every route, screen, role, navigation entry, menu, tab, deep link, back/refresh behavior, and contextual action in the shipped application.
**Method:** exhaustive code inspection of `src/routes.tsx`, `src/route-guards.tsx`, `src/ui/layout/{Layout,Sidebar,CenterSwitcher}.tsx`, `src/shared/components/GlobalSearch.tsx`, `src/domain/entities/Session.ts`, every file in `src/pages/`, and the i18n dictionaries — cross-checked with executed probes. No claim below is inferred from documentation.

---

## 1. Complete route and role map

Roles: **ADMIN**, **MANAGER**, **STAFF** (`src/domain/entities/Session.ts`). Routing is `HashRouter`, so every URL is `/#/<path>`.

### 1.1 Public routes

| Route | Screen | Guard | Notes |
|---|---|---|---|
| `/` | — | none | `<Navigate to="/login" replace />` |
| `/login` | `LoginPage` | none | The only public surface |
| `*` (unauthenticated) | — | none | Redirects to `/login` |

### 1.2 Authenticated routes (`RequireAuth`) — all roles

| Route | Screen | In sidebar | In mobile bottom bar | In mobile More | In search |
|---|---|---|---|---|---|
| `/dashboard` | `DashboardPage` | ✅ | ✅ Home | — | ✅ |
| `/appointments` | `AppointmentsPage` | ✅ | ✅ | — | ✅ |
| `/pos` | `PosInvoicesPage` | ✅ | ✅ | — | ✅ |
| `/customers` | `CustomersPage` | ✅ | ✅ | — | ✅ |
| `/services` | `ServicesPage` | ✅ | — | ✅ | ✅ |
| `/inventory` | `InventoryPage` | ✅ | — | ✅ | ✅ |
| `/gift-cards` | `GiftCardsPage` | ⚠️ conditional | — | ✅ **unconditional** | ✅ |
| `/packages` | `PackagesPage` | ⚠️ conditional | — | — | ✅ |

### 1.3 Admin-only routes (`RequireAdmin`)

| Route | Screen | Sidebar | Mobile More | Search | Status |
|---|---|---|---|---|---|
| `/employees` | `EmployeesPage` | ✅ | ✅ | ✅ | Reachable |
| `/reports` | `ReportsPage` | ✅ | ✅ | ✅ | Reachable |
| `/settings` | `SettingsPage` | ✅ | ✅ | ✅ | Reachable |
| `/expenses` | `ExpensesPage` | ✅ | — | ✅ | Reachable |
| `/attendance` | `AttendancePage` | ✅ | — | ✅ | Reachable |
| `/advances` | `AdvancesPage` | ✅ | — | ✅ | Reachable |
| `/payroll` | `PayrollPageEnhanced` | ✅ | — | ✅ | Reachable |
| `/staff-analytics` | `StaffAnalyticsPage` | ✅ | — | ✅ | Reachable |
| `/customer-experience` | `CustomerExperiencePage` | ❌ | — | ✅ | **Search-only** |
| `/forecasting` | `ForecastingPage` | ❌ | — | ✅ | **Search-only** |
| `/accounting` | `AccountingPage` | ❌ | — | ✅ | **Search-only** |
| `/advanced-automation` | `AdvancedAutomationPage` | ❌ | — | ✅ | **Search-only** |

### 1.4 Legacy redirects (admin-guarded)

| Route | Redirects to |
|---|---|
| `/branding` | `/settings?tab=branding` |
| `/notifications` | `/settings?tab=notifications` |
| `/payment-gateway` | `/settings?tab=payments` |

### 1.5 Settings sub-navigation

`SettingsPage` owns five tabs driven by `?tab=`: `center` (default), `backup`, `branding`, `notifications`, `payments`. Tab state is written with `setSearchParams(..., { replace: true })`, so tabs are deep-linkable and refresh-safe but **do not create history entries**.

### 1.6 Orphan source files (not routed, not imported)

| File | Lines | Status |
|---|---|---|
| `src/pages/BookingPage.tsx` | 365 | Orphan — public booking RPCs are deny-by-default |
| `src/pages/ClientPortalPage.tsx` | 109 | Orphan — portal RPCs are deny-by-default |

`BrandingSettingsPage`, `NotificationsSettingsPage` and `PaymentGatewaySettingsPage` are **not** orphans: they are lazy-loaded as sections inside `SettingsPage`.

### 1.7 Role reality check

`MANAGER` is a defined role with `MANAGER_PERMISSIONS = new Set([])` — it resolves to exactly the STAFF operational scope. `RequireAdmin` admits ADMIN only. So the application has **two effective navigation audiences**, not three: *operations* (STAFF/MANAGER) and *administration* (ADMIN). The IA below is built on that verified fact rather than on the three nominal roles.

---

## 2. Problems found

Severity: **P1** breaks a task or a security-adjacent expectation · **P2** causes disorientation or inconsistency · **P3** polish.

### P1

**IA-01 — English users see Arabic navigation labels.**
`i18n.ts` sets `fallbackLng: 'ar'`. Five destinations exist in the Arabic dictionary but are **missing from English**, so with the UI in English the sidebar renders Arabic. Executed probe:

| Key | `t()` in English |
|---|---|
| `Attendance` | `الحضور` |
| `Advances` | `السلف` |
| `Payroll` | `الرواتب` |
| `Staff Analytics` | `تحليلات الفريق` |
| `Branding` | `الهوية البصرية` |
| `Notifications` | `الإشعارات` |

An English-speaking administrator cannot read six of their own menu entries. This is a navigation failure, not a cosmetic one.

**IA-02 — Deep links are silently discarded after sign-in.**
`RequireAuth` correctly preserves the attempted location (`state={{ from: location }}`), but `LoginPage` ignores it and always calls `nav("/dashboard", { replace: true })`. A user opening a shared link to `/#/reports` while logged out lands on the Dashboard with no explanation. The redirect infrastructure exists and is simply unused.
*Evidence:* `src/route-guards.tsx:26` vs `src/pages/LoginPage.tsx:50`.

**IA-03 — Four deferred modules are inconsistently concealed: hidden from every menu but exposed in search.**
`/customer-experience`, `/forecasting`, `/accounting`, `/advanced-automation` are live admin-guarded routes with **no navigation entry anywhere**, yet all four appear in Global Search.

`src/routes.tsx:70` documents the intent explicitly — *"Deferred modules keep their routes/data but stay out of trial navigation"* — so the concealment is deliberate and must be respected. The defect is that the deferral is **half-applied**: search still advertises them to anyone who happens to type the right word.

Inspection confirms these four are genuinely unfinished relative to the shipped pages: 53–144 lines each, **no `PageHeader`, no `ScreenState`** loading/empty/error handling, and raw `text-gray-*`/`text-left` styling that is off-brand in dark mode and mis-aligned in English. Promoting them to primary navigation would expand the product's shipped surface — outside this task's mandate. The correct fix is to make the deferral **consistent** in both directions.

**IA-04 — Mobile "More" exposes a destination the sidebar deliberately hides.**
Sidebar shows `/gift-cards` only when gift cards actually exist (`optionalModules.giftCards`). The mobile More menu lists it **unconditionally**. Same role, same product state, two different menus — and the mobile one leads to an empty feature.
*Evidence:* `Sidebar.tsx:72` vs `Layout.tsx:153`.

### P2

**IA-05 — Mobile can reach only 9 of 16 admin destinations.**
The mobile More menu carries 6 entries; `/expenses`, `/attendance`, `/advances`, `/payroll`, `/staff-analytics`, `/packages` are absent. They are recoverable through "All Menu Items" → full sidebar drawer, but that path is undiscoverable: the button sits below a 3-column grid and reads as a footer, not as the route to the other half of the product.

**IA-06 — The same destination has three different names.**
`/pos` is "POS" in the sidebar, "POS" in the bottom bar, and **"Sales & Invoices"** in Global Search. The dictionary carries a third orphan key, `Posinvoices`. A user searching "sales" finds it; a user looking for "Sales & Invoices" in the menu never does.

**IA-07 — The header shows only a title, never a location path.**
The header renders `pageTitle` from a hardcoded map with **no breadcrumb and no back affordance anywhere in the app** (`grep` for breadcrumb/`navigate(-1)`: zero hits). On `/settings?tab=branding` the header says only "Settings"; nothing indicates the active sub-section. On mobile, where the sidebar is closed, the user has no persistent indication of where they are in the hierarchy.

**IA-08 — Page titles are duplicated and drift from navigation.**
Only 3 of 26 pages use the shared `PageHeader`; 22 hand-roll their own `<h1>`. The `Layout` header map is a **fourth** independent copy of every page name. Nothing keeps the four lists in sync — `/forecasting` is already missing from the English dictionary while present in the header map.

**IA-09 — Grouping does not match the user's mental model.**
The sidebar "Management" group mixes three unrelated concerns: business reporting (`/reports`), money out (`/expenses`), workforce administration (`/attendance`, `/advances`, `/payroll`, `/staff-analytics`), and system configuration (`/settings`). A user looking for payroll must scan a group whose label predicts none of it.

**IA-10 — The unknown-route fallback is a silent redirect.**
An authenticated user hitting an unknown path is sent to `/dashboard` with no message. A STAFF user hitting an admin path is likewise bounced to `/dashboard` silently — correct as authorization, but indistinguishable from a broken link.

### P3

**IA-11 — Two orphan page files (474 lines)** for deny-by-default capabilities remain in the shipped source.
**IA-12 — `Search` and `Navigation` keys are absent from both dictionaries**, so they render as raw English strings even in Arabic.
**IA-13 — Settings tabs use `replace: true`**, so Back from a sub-tab exits Settings entirely rather than returning to the previous tab. Defensible, but it means Back is not reversible within the section.

### Verified as already correct (no change made)

- `RequireAdmin` enforces the role boundary at the **route** level; hidden navigation is never the authorization mechanism. Global Search filters `adminOnly` entries **and** the route guard blocks direct URL entry — defence in depth, already correct.
- RTL: the sidebar drawer mirrors its slide direction, and directional chevrons are rotated for Arabic in Sidebar, Dashboard, GettingStartedCard and GlobalSearch.
- Keyboard: Global Search implements a focus trap, `Cmd/Ctrl+K`, arrow navigation, Escape, and focus restoration; the mobile More menu closes on Escape and restores focus; there is a skip-link to `#main-content`.
- Refresh/deep-link: `HashRouter` + `?tab=` means every destination survives a refresh.

---

## 3. Selected model

**Task-based primary navigation with a role-scoped admin section, one global search, and no third navigation level.**

Rejected alternatives and why:
- *Flat list of all 20 destinations* — already effectively the sidebar; it overcrowds and hides nothing usefully.
- *Nested multi-level menus* — the product has ~20 destinations; a second expandable level adds clicks without reducing choice.
- *Role-specific separate shells* — only two effective audiences exist, and STAFF already sees a naturally shorter menu because admin items are filtered.

### Primary navigation (sidebar + mobile), grouped by the user's actual job

| Group | Destinations | Rationale |
|---|---|---|
| **Today** (`Daily Operations`) | Dashboard · Appointments · Point of Sale | The three surfaces touched every hour |
| **Catalog & People** | Customers · Services · Inventory · Gift Cards* · Packages* · Employees◆ | The records the center maintains |
| **Money** | Reports · Expenses ◆ | Everything financial in one predictable place |
| **Team** | Attendance · Advances · Payroll · Staff Analytics ◆ | Workforce administration, previously scattered in "Management" |
| **Growth** | *(deferred — see below)* | Reserved group; empty groups do not render |
| **System** ◆ | Settings (Center Profile · Data Export · Branding · Notifications · Payments) | Configuration, not a daily task |

`*` shown only when the module has real data · `◆` ADMIN only, enforced by `RequireAdmin`

### Deferred modules

`/accounting`, `/customer-experience`, `/forecasting` and `/advanced-automation` carry a `deferred: true` flag in the registry. They are hidden from **navigation and search alike**, honouring the existing decision in `src/routes.tsx:70` while removing the inconsistency that made them searchable.

Their routes remain live and admin-guarded, so saved links and direct URLs keep working and no data or capability is lost. The flag is the single switch to flip when a module gains the loading/empty/error states and brand styling the shipped pages already have — recorded in the registry next to the destination, not buried in a menu array.

### Navigation rules (binding)

1. **One destination, one name, everywhere.** A single exported route registry is the only source of page names; sidebar, mobile menus, header title and search all read from it.
2. **Navigation visibility is never authorization.** Every admin destination stays behind `RequireAdmin`; hiding is a courtesy, the guard is the boundary.
3. **Mobile parity.** Anything reachable on desktop is reachable on mobile — via the bottom bar, the More sheet, or the full drawer — and mobile never shows a destination the sidebar hides.
4. **Bottom bar is fixed at 5 slots**: Home, Appointments, POS, Customers, More. It reflects frequency, not importance.
5. **Search covers every destination the current role may enter**, and nothing else.
6. **Deep links are honored.** After sign-in the user returns to the location they requested.
7. **Refusals are explained.** A blocked or unknown route says what happened instead of silently redirecting.

### Naming glossary

| Route | Canonical name (EN) | Canonical name (AR) | Retired aliases |
|---|---|---|---|
| `/dashboard` | Dashboard | لوحة التحكم | "Home" (mobile bar only, intentional) |
| `/pos` | Point of Sale | نقطة البيع | "POS", "Sales & Invoices", "Posinvoices" |
| `/appointments` | Appointments | المواعيد | — |
| `/customers` | Customers | العملاء | — |
| `/services` | Services | الخدمات | — |
| `/inventory` | Inventory | المخزون | — |
| `/gift-cards` | Gift Cards | بطاقات الهدايا | — |
| `/packages` | Packages | الباقات | — |
| `/employees` | Employees | الموظفون | — |
| `/reports` | Reports | التقارير | — |
| `/expenses` | Expenses | المصروفات | — |
| `/accounting` | Accounting | المحاسبة | — |
| `/attendance` | Attendance | الحضور | — |
| `/advances` | Advances | السلف | — |
| `/payroll` | Payroll | الرواتب | — |
| `/staff-analytics` | Staff Analytics | تحليلات الفريق | — |
| `/customer-experience` | Customer Experience | تجربة العميل | — |
| `/forecasting` | Forecasting | التوقعات | — |
| `/advanced-automation` | Automation | الأتمتة | "Advanced Automation" |
| `/settings` | Settings | الإعدادات | — |

---

## 4. Migration and redirect considerations

**No route is renamed, moved or removed. Every existing URL keeps working.** The three legacy redirects (`/branding`, `/notifications`, `/payment-gateway`) are preserved exactly, and their guard test is untouched.

| Change | Compatibility |
|---|---|
| Route registry introduced | Pure refactor; paths unchanged |
| Four deferred routes removed from search | Routes stay live and admin-guarded; direct URLs and saved links still work |
| Sidebar regrouped | Labels/grouping only; no path changes |
| Post-login deep-link return | New behavior on an existing, unused mechanism; default remains `/dashboard` |
| Missing English labels added | Additive dictionary entries |
| Orphan page files removed | Unreferenced and unrouted; no URL is affected |

---

## 5. Acceptance tests

Enforced by `src/__tests__/information-architecture.test.tsx` unless noted.

**Route/registry integrity**
- IA-T1 Every route in `routes.tsx` appears in the registry, and every registry entry has a route. ✅
- IA-T2 Every non-deferred registry destination is reachable from navigation for the roles allowed to enter it. ✅
- IA-T3 No destination is search-only: a deferred module is hidden from search too, and every searchable destination has a menu entry. ✅

**Naming**
- IA-T4 Sidebar, mobile menus, header title and search use the registry name for a given route. ✅
- IA-T5 Every registry name resolves in Arabic **and** English, with no Arabic leaking into English. ✅
- IA-T6 Retired aliases (`Posinvoices`, `Sales & Invoices` as a nav label) are absent from navigation surfaces. ✅

**Roles and permission boundaries**
- IA-T7 STAFF sees no admin destination in sidebar, mobile menu or search. ✅
- IA-T8 `RequireAdmin` blocks STAFF on direct URL entry even when navigation is hidden. ✅
- IA-T9 MANAGER is treated as operational, matching `can()`. ✅
- IA-T10 Hiding is never the only control: every hidden admin route is also guarded. ✅

**Deep links, refresh, back/forward**
- IA-T11 A deep link requested while signed out is restored after sign-in. ✅
- IA-T12 An unauthenticated deep link to an admin route lands on login, not a broken shell. ✅
- IA-T13 `/settings?tab=branding` restores the branding tab on load. ✅
- IA-T14 Legacy `/branding`, `/notifications`, `/payment-gateway` still redirect. ✅

**Mobile/desktop parity**
- IA-T15 Mobile shows no destination the sidebar hides for the same state. ✅
- IA-T16 Every desktop destination is mobile-reachable. ✅
- IA-T17 The bottom bar holds exactly 5 slots. ✅

**Orientation and accessibility**
- IA-T18 The active destination is marked `aria-current="page"`. ✅
- IA-T19 A blocked or unknown route explains itself instead of silently redirecting. ✅
- IA-T20 Directional icons mirror in RTL; navigation uses logical properties only. ✅
- IA-T21 Every navigation landmark has an accessible name. ✅

**Regression** — full suite, typecheck, lint, build, audit gate. ✅

---

## 6. Verification results

All commands executed in this environment after the changes.

| Check | Result |
|---|---|
| `npm test` | **PASS — 109 files / 649 tests** (baseline 108/615; +34, 0 failures) |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 232 files |
| `npm run build` | PASS |
| `npm run audit:gate` | PASS |
| `npm run db:types:check` · `ci:migrations` · `ci:rpc-check` | PASS |
| `npm run desktop:test` | PASS — 14 tests |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| Production preview | PASS — `/`, manifest, service worker all 200 |

### Rendered navigation readout

The real `Sidebar` was rendered per role and language; visible text captured:

**ADMIN / English** — `Daily Operations:` Dashboard · Appointments · Point of Sale · `Catalog & People:` Customers · Services · Inventory · Employees · `Money:` Reports · Expenses · `Team:` Attendance · Advances · Payroll · Staff Analytics · `System:` Settings

**ADMIN / العربية** — `التشغيل اليومي:` لوحة التحكم · المواعيد · نقطة البيع · `الكتالوج والأشخاص:` العملاء · الخدمات · المخزون · الموظفون · `المالية:` التقارير · المصروفات · `الفريق:` الحضور · السلف · الرواتب · تحليلات الفريق · `النظام:` الإعدادات

**STAFF / English** — `Daily Operations:` Dashboard · Appointments · Point of Sale · `Catalog & People:` Customers · Services · Inventory

Confirms: no Arabic leaking into English, STAFF correctly scoped to 6 operational destinations, deferred modules absent, and the empty "Growth" group not rendered.

### Criteria status

| Group | Status |
|---|---|
| Route/registry integrity (IA-T1–T3) | ✅ |
| Naming (IA-T4–T6) | ✅ |
| Roles and boundaries (IA-T7–T10) | ✅ |
| Deep links / refresh / back (IA-T11–T14) | ✅ |
| Mobile/desktop parity (IA-T15–T17) | ✅ |
| Orientation and accessibility (IA-T18–T21) | ✅ |
| Regression | ✅ |

### Changes implemented

| # | Change | Fixes |
|---|---|---|
| 1 | `src/app/navigation.ts` — one registry for every destination, name, icon, group and visibility rule | IA-06, IA-08 |
| 2 | Sidebar, Layout header title, mobile bottom bar, mobile More and Global Search all render from the registry | IA-04, IA-06, IA-08 |
| 3 | 15 missing English labels added; Arabic no longer leaks into the English UI | IA-01, IA-12 |
| 4 | `resolvePostLoginPath()` returns the user to the requested deep link, with open-redirect protection | IA-02 |
| 5 | Deferral made consistent — deferred modules hidden from search as well as menus, routes still live | IA-03 |
| 6 | `NavigationNotice` explains admin-only refusals and unknown routes instead of redirecting silently | IA-10 |
| 7 | Sidebar regrouped into Daily Operations / Catalog & People / Money / Team / System | IA-09 |
| 8 | Mobile More now covers every shipped destination and honours the same optional-module rule | IA-04, IA-05 |
| 9 | Two orphan page files (474 lines) for deny-by-default features removed | IA-11 |

### A decision I reversed mid-implementation

I initially promoted the four hidden modules (`/accounting`, `/customer-experience`, `/forecasting`, `/advanced-automation`) into primary navigation. An existing test then failed, which led me to `src/routes.tsx:70` — *"Deferred modules keep their routes/data but stay out of trial navigation"* — documenting the concealment as deliberate.

Inspection confirmed the pages are genuinely unfinished (53–144 lines, no `PageHeader`, no loading/empty/error states, off-brand raw styling). Promoting them would have expanded the product's shipped surface, which this task explicitly excludes. I reversed the change and instead fixed the real defect: the deferral was only half-applied, since search still exposed them. The `deferred` flag now hides them from both surfaces and is the single switch to flip when each module is finished.

## 7. Not done, and why

| Item | Reason |
|---|---|
| Real-browser back/forward and touch testing | No browser executable is installable here (`playwright install` fails on sandbox network + missing font packages). Verified via jsdom router tests exercising real navigation, plus the production preview. |
| Breadcrumbs beyond one level | The hierarchy is one level deep (Settings is the only section with tabs). A breadcrumb trail would add chrome without adding orientation; the section + tab indicator covers it. |
| Merging `MANAGER` into `STAFF` | A role-model change is a product decision, not an IA fix. Documented; behavior unchanged. |
| Reviving `/book` and `/portal` | Their RPCs are deny-by-default with zero client grants. Routing them would expose non-functional pages. |
| Promoting the four deferred modules into navigation | `src/routes.tsx:70` defers them deliberately and the pages are unfinished. Finishing them is a scope change, not an IA fix. |
| Migrating 22 pages onto the shared `PageHeader` | Real duplication (IA-08), but a 22-file refactor with its own regression surface. The header title now derives from the registry, so the navigation-facing half of the drift is closed. |
