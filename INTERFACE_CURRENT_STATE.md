# INTERFACE_CURRENT_STATE

**Product:** LenaBeauty salon/spa operations PWA  
**Inspected:** 2026-09-07 from `main` (`c22ecba`) plus source, routes, navigation registry, tests, and layout contracts.  
**Runtime note:** Hosted Demo requires a real Auth session. Login, shell, and source contracts were inspected; live Demo data screens remain gated by credentials.

Roles: `ADMIN` (full), `MANAGER`/`STAFF` (operational; admin routes blocked by `RequireAdmin`). Deferred routes stay live but hidden from nav/search.

| Route | Page | Roles | Purpose / primary task | Current content & actions | Data | Display | Mobile | Desktop | Shared | Confirmed problems | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/login` | LoginPage | Public | Sign in / reset | Brand, email/password, language/theme, LENA house link | Auth | Auth form | Icon controls, stacked card | Split brand + form | Theme, i18n | Good. Keep. | KEEP |
| `/reset-password` | ResetPasswordPage | Public | Complete reset | Token form | Auth | Form | Full width | Centered | — | Keep. | KEEP |
| `/dashboard` | DashboardCompatPage → DashboardPage | Auth | Start the day | Welcome, setup, tiles, today list, alerts, chart, activity, shortcuts | dashboard/appointments/products | Dashboard | 2×2 tiles, stacked | Sidebar + 3-col | ScreenState, GettingStarted, NavigationNotice | Duplicate low-stock panels; financial chart not gated by `canViewRevenue`; Zap used as refresh; 8px labels | P1 |
| `/action-center` | ActionCenterPage | Auth | Work exceptions | Rebooking, arrivals, checkout, stuck visits, demand, expiry | lists + recipes | Cards/lists | Single col | 2-col | PageHeader, ScreenState | Overlaps dashboard alerts; item click goes to list not record | P2 |
| `/appointments` | AppointmentsPage | Auth | Run the book | Stats, day/week, filters, booking/visit dialog | appointments/customers/services/employees | Schedule + modal | Day default, sheet dialog | Week grid | PageHeader, Modal | Stats compete with the book; keep schedule | P3 |
| `/pos` | PosInvoicesPage | Auth | Record a sale | Catalog, cart, customer, wallet, tender, receipt | catalog + checkout RPC | Split catalog/cart | Catalog/Cart toggle, thumb pay | 2-pane | ScreenState, Receipt, VisitContext | `window.prompt` for starting-from price; gift-card sale unlabeled | P0 |
| `/customers` | CustomersPage | Auth | Find/edit client | Stats, search, table/cards, passport, add/edit | customers + history | Table / list | Duplicate search; list+menu | Sparse `py-8` table | PageHeader, ListState, Modal | Duplicate search; low density | P1 |
| `/services` | ServicesPage | Auth | Maintain menu | Search, categories, table/cards, recipe modal | services/recipes/products | Table / 2-col cards | Icon-only actions | Table | PageHeader, ListState, Modal | Toggle `h-9` vs 44px | P2 |
| `/inventory` | InventoryPage | Auth | Stock + cost | Banner, stats, table/cards, product form | products | Table / 2-col cards | Compact cards | Table | ListState, Modal | Same 44px miss; custom header not PageHeader | P2 |
| `/gift-cards` | GiftCardsPage | Auth if data | Sell/track cards | Always-on sell form + list/ledger | giftCards/entitlements | Form + cards | Stacked | 380px + list | ListState | Unlabeled fields; no PageHeader; 36px submit | P1 |
| `/packages` | PackagesPage | Auth if data | Define packages | Create form, list, entitlements | packages/services/entitlements | Form + cards | Stacked | Same | ListState | Placeholders as labels | P2 |
| `/employees` | EmployeesPage | ADMIN | Team records | Table/cards, create/edit, activate | employees | Table / list | 1-col cards | Table | ListState, Modal | Toggle `h-9` | P2 |
| `/reports` | ReportsPage | ADMIN | Period evidence | Date range, sales/appointments/inventory | reports RPCs | Tabs + charts/tables | Horizontal tabs | Wide | PageHeader, LazyChart | Keep. | KEEP |
| `/expenses` | ExpensesPage | ADMIN | Record costs | Huge header, stats, chips, table/cards | expenses | Table / cards | Oversized cards | Sparse `py-8` table; `toFixed(2)`; `ar-OM` always; `rose-500` | ListState, Modal | Density, OMR, locale, token | P1 |
| `/attendance` `/advances` `/payroll` `/staff-analytics` | workforce pages | ADMIN | Team money/time | Dialogs + lists | attendance/advances/payroll | List/table | Compact | Table | Modal, ListState | Keep pattern; 44px polish | P3 |
| `/settings` | SettingsPage + tabs | ADMIN | Center config | Side nav: profile, go-live, export, branding, notifications, payments | settings | Settings | Chip nav | Sticky side nav | Modal, ScreenState | Chevron not RTL-flipped | P2 |
| `/accounting` `/customer-experience` `/forecasting` `/advanced-automation` | deferred | ADMIN via URL | Unfinished | Thin/placeholder | mixed | Mixed | Unstyled vs shipped | Same | — | Stay deferred | DEFER |
| `/branding` `/notifications` `/payment-gateway` | redirects | ADMIN | Legacy | → settings tabs | — | — | — | — | — | Keep redirects | KEEP |

**Shell:** Desktop 320px Sidebar from `NAV_DESTINATIONS`. Phone: header + Malek dock (menu/search/plus) + bottom sheet. Title in chrome + PageHeader. Skip link, focus trap, keyboard inset, RTL logical properties.

**States that exist:** loading/empty/error via ScreenState/ListState; admin-only/not-found notices; network banner; PWA prompt; login error. Missing: no-results vs empty (search often reuses empty); offline CRUD (online-only, disclosed); permission page (redirect+notice); session expiry → login.

**What is already good:** Auth fail-closed, IA registry, visit→POS handoff, POS thumb-zone pay, Modal a11y, Arabic default, no fabricated metrics, no swipe-delete.

**Duplications:** Dashboard Operational Alerts vs Needs Attention vs Action Center; Customers search twice below `lg`; PageHeader title vs layout title (acceptable: h1 vs chrome h2).

**Inconsistencies:** PageHeader vs hand-rolled headers; OMR `toFixed(2)` vs 3dp; `h-9` vs `min-h-11`; raw `rose-500` on expenses.
