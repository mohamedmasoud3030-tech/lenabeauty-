# Phase Roadmap (SPA Management App)

## Current Top Blockers

1. `SupabaseInvoiceAdapter.checkout` block all checkout processing.
2. Dashboard financial reads (`getPnlMonth`, `getRevenueLast7Days`) unsupported (operational reads like `getSummary` are implemented).
3. Reports sales queries (`getSales`) unmapped (operational reads like `getAppointments`, `getInventory` are implemented).
4. Invoice print `getForPrint` unsupported.
5. Settings update/logo/backup/restore unsupported.
6. Customer history unsupported.
7. Expense `update` missing.
8. Preview uses empty mock data and does not prove production behavior.

## Phase 0: Baseline documentation completion
- **Goal**: Lock in factual engineering states, architectures, and boundaries to act as a source of truth for further iteration.
- **Files Involved**: `docs/APP_BACKGROUND.md`, `docs/DECISIONS.md`, `docs/CURRENT_APP_AUDIT.md`, `docs/ROADMAP.md`
- **Exact Tasks**: Author strict architectural boundary definitions, catalog all unsupported adapter methods, map existing CRUD behaviors cleanly matrixed by module, and assert top blocking factors.
- **Acceptance Criteria**: All 4 markdown document structures exist completely parsed with valid representations. 
- **Verification Commands / Steps**: Manual review. Ensure documents exist.
- **Explicitly out of scope**: Writing code or feature functionality.

## Phase 1: Desktop layout, navigation, and page structure baseline. [COMPLETED]
- **Goal**: Establish the fundamental desktop UI shell, ensuring correct routing, main navigation bars, and stable empty state layouts prioritize business desktop usage. 
- **Files Involved**: `src/ui/layout/*.tsx`, `src/App.tsx`, `src/pages/*.tsx`
- **Exact Tasks**: Solidify the desktop navigation hierarchy and generic page boundaries. Establish layout shells. Add "Backend Required" or "WIP" badges where functionality relies on unimplemented Supabase methods to prevent a false sense of module completion.
- **Acceptance Criteria**: Desktop layout is robust, responsive primarily for desktop usage, routes switch cleanly, and unsupported features correctly flag themselves natively.
- **Verification Commands / Steps**: Manual preview in desktop resolution.
- **Explicitly out of scope**: Mobile-specific responsive adjustments (these are deferred).

## Phase 2: Runtime/config/auth safety. [COMPLETED]
- **Goal**: Harden underlying context validation logic preventing illegitimate configurations from proceeding silently while restricting arbitrary identity elevation.
- **Files Involved**: `src/config/env.ts`, `src/context/AppContext.tsx`, `src/auth.tsx`
- **Exact Tasks**: Ensure auth meta mapping requires explicit authorization checks instead of implicitly falling back to `STAFF`. Enforce membership bounds.
- **Acceptance Criteria**: Unauthorized access fails seamlessly. Environment configs crash visually without silent fallback. 
- **Verification Commands / Steps**: `npx vitest run src/__tests__`
- **Explicitly out of scope**: Full User Management Administration panel features.

## Phase 3: Supabase adapter contract hardening. [COMPLETED]
- **Goal**: Harden the Supabase adapter layer so every domain repository method has an explicit, safe, predictable contract: implemented and tested, or unsupported with a safe typed/canonical error, or documented as a blocker for a later phase.
- **Files Involved**: `src/infrastructure/supabase/repositories.ts`, `src/infrastructure/supabase/errors.ts`, `src/__tests__/supabase.adapter.contracts.test.ts`, UI catch blocks.
- **Exact Tasks**: Verify all unsupported methods (checkout, getForPrint, Dashboard methods, Settings mutations) securely return canonical `BACKEND_METHOD_UNSUPPORTED` errors inside the Supabase adapters gracefully intercepted by the UI. Complete adapter map.
- **Acceptance Criteria**: Unimplemented backend flows fail softly without leaking code strings to user-facing areas.
- **Verification Commands / Steps**: `npx tsc --noEmit && npx vitest run src/__tests__/supabase.adapter.contracts.test.ts && npm run build`
- **Explicitly out of scope**: Implementing the underlying complex business flows.

## Phase 4: Customers and appointments operational flow. [CODE COMPLETE - LIVE QA PENDING]
- **Goal**: Validate UI constraints, scheduling collisions, and history tracking interactions.
- **Files Involved**: `src/pages/CustomersPage.tsx`, `src/pages/AppointmentsPage.tsx`, `src/infrastructure/supabase/repositories.ts`
- **Exact Tasks**: Introduce `Customer.getHistory` querying (safely blocked). Map UI states correctly against real appointments tracking.
- **Acceptance Criteria**: A user can handle standard CRUD functionality cleanly for both modules with safe error boundaries and table actions.
- **Verification Commands / Steps**: `workflows.test.ts` integration passing, but live Supabase browser verification remains pending. Test coverage for adapter mapping is pending.
- **Explicitly out of scope**: POS billing logic integration within appointment slots.

## Phase 5: Services, POS, invoices, payments, and print correctness. [PHASE 5A COMPLETED / CHECKOUT BLOCKED]
- **Goal**: Resolve crucial transaction-bound operations seamlessly joining billing to entity utilization.
- **Files Involved**: `src/pages/PosInvoicesPage.tsx`, `src/pages/ServicesPage.tsx`, `src/infrastructure/supabase/repositories.ts`
- **Exact Tasks**: 
  - **Pre-Phase 5A**: Fixed initial UX environment crashes, allowing Preview Mode access without blocking on missing Supabase configuration inside AI Studio.
  - **Phase 5A**: Verified Services CRUD flow mapping correctly (`categoryId`, `durationMinutes`). Validated `PosInvoicesPage` checkout safety so unsupported checkouts fail safely without generating pseudo data.
  - **Phase 5B-1**: Established checkout design and transaction boundaries. Confirmed implementation is BLOCKED pending remote schema validation and RPC execution for atomicity (`process_checkout_v1`). Safely maintained `BACKEND_METHOD_UNSUPPORTED` constraint.
  - **Phase 5B-2**: Completed code-readiness. Stabilized `CheckoutPayload` mapping and POS frontend validations. `SupabaseInvoiceAdapter` wired securely to proxy the unimplemented `process_checkout_v1` RPC—falling back cleanly to `BACKEND_METHOD_UNSUPPORTED` without crashing. Created `docs/SUPABASE_SETUP_CHECKOUT.md` and `docs/PHASE_5B_CHECKOUT_SQL_DRAFT.md` manuals. (Code is complete; remote DB unapplied).
  - **Phase 5B-3**: (Pending) Database Administrator applies the schema migrations and RPC. No more application code required.
- **Acceptance Criteria**: Receipts generate smoothly handling complex line-item math. (Currently safely blocked awaiting Supabase schema operations/migrations).
- **Verification Commands / Steps**: `workflows.test.ts` integration validates preview guards. Live verification pending checkout implementation logic.
- **Explicitly out of scope**: External POS hardware integration (e.g. physical receipt printers/EFTPOS). Implementing fake checkouts.

## Phase 6: Inventory and expenses correctness. [CODE COMPLETE - LIVE QA PENDING]
- **Goal**: Streamline operational accounting, establishing boundaries for product restocking logic vs usage deduction.
- **Files Involved**: `src/pages/InventoryPage.tsx`, `src/pages/ExpensesPage.tsx`
- **Exact Tasks**: Connected UI validation to missing backend parameters. Clarified stock movement rules: simple update() overrides. Validated Expense logic (create, list, delete) with safe constraints for negative amounts. Formally marked `Expense.update` mathematically as `BACKEND_METHOD_UNSUPPORTED` because append-only tracking satisfies constraints and there's no UI for it.
- **Acceptance Criteria**: Expense and product creation behaves safely.
- **Verification Commands / Steps**: `vitest run`, validation tests against PreviewMode interceptors.
- **Explicitly out of scope**: Dynamic stock purchasing notifications. Fake success mechanisms.

## Phase 7: Dashboard and reports backed by real Supabase data. [CODE COMPLETE - LIVE QA PENDING]
- **Goal**: Eliminate visual fabrication (mock arrays) in overview modules, pulling genuine statistical aggregations from Supabase metrics natively where supported, and gracefully restricting unavailable metrics without faking data.
- **Files Involved**: `src/pages/DashboardPage.tsx`, `src/pages/ReportsPage.tsx`, `src/infrastructure/supabase/repositories.ts`
- **Exact Tasks**: Implemented operational metrics (`customers`, `appointments`, `products` count) inside `Dashboard.getSummary`, `Report.getAppointments`, and `Report.getInventory`. Blocked all financial features (`sales`, `revenue`, `getPnlMonth`) dynamically returning `BACKEND_METHOD_UNSUPPORTED` due to the lack of live invoice/checkout schemas. Handled frontend states cleanly with proper restriction messaging.
- **Acceptance Criteria**: Dashboard displays legitimate operational numbers, restricting financial access correctly. Empty state UI correctly informs the user about missing backend schemas.
- **Verification Commands / Steps**: Contract validation tests `workflows.test.ts`. Functional browser layout checks visually validated.
- **Explicitly out of scope**: Full financial schema execution via SQL. Creating fake datasets to bypass missing backends. Custom bespoke reporting dashboards.

## Phase 8: Settings and admin readiness. [CODE COMPLETE - LIVE QA PENDING]
- **Goal**: Reconcile administrative property states safely, guaranteeing settings apply completely to UI surfaces universally, while preventing dangerous silent failure cases on unsupported infrastructure constraints.
- **Files Involved**: `src/pages/SettingsPage.tsx`, `src/ui/layout/Sidebar.tsx`, `src/ui/layout/Layout.tsx`, `src/i18n.ts`
- **Exact Tasks**: Mapped read-only `Settings.get` successfully via RLS isolation. Replaced fake offline persistence logic with robust `BACKEND_METHOD_UNSUPPORTED` boundaries for `Settings.update`, `uploadLogo`, `backup`, `restore`, and `exportData`. Validated true Admin functionality roles and translated Arabic terminology cohesively blocking silent staff defaulting access patterns.
- **Acceptance Criteria**: Admin Identity accurately translates logic across sidebars correctly. Settings page refuses simulated saves, safely identifying backend dependencies without leaking code traces.
- **Verification Commands / Steps**: `npx tsc --noEmit && npx vitest run`. Test success. Visual verification of role states.
- **Explicitly out of scope**: Simulated disk persistence. Faking backend success for backup/restore workflows. Generic white-label SaaS configurations.

## Phase 9A: Mobile shell, navigation, drawer, and unified mobile design foundation. [CODE COMPLETE]
- **Goal**: Establish a unified, dashboard-inspired mobile shell baseline, maintaining cohesive layout spacing, bottom navigation patterns, and sidebar logic universally across views.
- **Files Involved**: `src/ui/layout/Layout.tsx`, `src/ui/layout/Sidebar.tsx`, `src/i18n.ts`.
- **Exact Tasks**: Transformed `Layout.tsx` to handle an interactive sticky bottom navigation tab bar containing primary modules. Enhanced `Sidebar.tsx` and Mobile Drawer constraints preventing UI tearing on limited breakpoints. Dynamically secured unknown user role shielding and optimized RTL translations.
- **Acceptance Criteria**: Mobile bottom drawer maintains stable dimensions. Sidebar drawer mechanics respond predictably. Unknown identities abstain from defaulting implicitly.
- **Verification Commands / Steps**: `npx tsc --noEmit && npx vitest run`. Manual Layout verifications.
- **Explicitly out of scope**: Individual Page Polish constraints (Deferred to Phase 9B).

## Phase 9B: Page-by-page mobile polish and unified layout mapping. [CODE COMPLETE]
- **Goal**: Finalize comprehensive Tailwind class alignments, substituting cramped data tables for dashboard-style mobile stacking cards naturally fitting into the unified mobile shell.
- **Files Involved**: `src/pages/*.tsx`, `src/shared/components/*.tsx`, `src/ui/**/*.tsx`, Globally applied.
- **Exact Tasks**: Transformed comprehensive structural tables into dynamic grid-based flex structures (`hidden lg:block` logic targeting viewports), integrating responsive card loops on all major administrative lists (Customers, Appointments, Services, POS grids, Inventory, Expenses, Employees, Reports, and Settings tables).
- **Acceptance Criteria**: Desktop layouts never regress. Cards dynamically size within margins and respond smoothly on portrait dimensions mimicking high-fidelity mobile management dashboards. Clean compilation execution logs.
- **Verification Commands / Steps**: UI Inspector checks, `npm run build`, `npx vitest run`, `npx tsc --noEmit`.
- **Explicitly out of scope**: Functional backend or database behavior alterations. Follow-up iterative scope inclusion tasks.

## Phase 9C: Final Release QA, i18n deep dive, and frontend readiness polish [CODE COMPLETE]
- **Goal**: Ensure comprehensive Arabic/English string mapping, robust RTL mobile display behavior, and honest backend gatekeeping prior to production database application.
- **Files Involved**: `src/i18n.ts`, `docs/CURRENT_APP_AUDIT.md`, `src/pages/*.tsx`.
- **Exact Tasks**: Completed exhaustive string audits removing hardcoded fragments from forms/dialogs, updated demo/preview financial analytics alerts mitigating fake backend success states, confirmed mobile layout spacing constraints, compiled testing.
- **Acceptance Criteria**: `tsc`, `vitest`, and `npm run build` execute flawlessly. UI states accurately warn the user if a backend method is missing schema rather than crashing. 
- **Verification Commands / Steps**: `npx tsc --noEmit && npx vitest run --passWithNoTests && npm run build`.
- **Explicitly out of scope**: Real checkout processing, invoice print layouts, applying any remote SQL scripts.

## Upcoming Backend Activation (Post-Frontend)

## Phase 10A: Supabase Live Activation Readiness and Non-checkout Live QA
- **Goal**: Formally prepare the application to run against a real Supabase backend and define a clear QA path, enforcing environment variable validation, documenting active and pending schema, and solidifying frontend separation of concerns from database operations.
- **Tasks**: Added detailed environment checking documentation to `CURRENT_APP_AUDIT.md`, updated `.env.example`, documented required active schemas (customers, appointments, services, products, expenses, employees), and fully restricted invoice checkout/RPC states.
- **Acceptance Criteria**: Live QA checklists are established and confirmed. App is documented/prepared to run in Supabase mode (reporting safe failures for unimplemented backend tables/RPCs without triggering fake transactions), but live browser QA remains pending.
- **Verification Commands / Steps**: `npx tsc --noEmit && npx vitest run --passWithNoTests && npm run build`.
- **Explicitly out of scope**: Real checkout processing, applying any remote SQL scripts.

## Phase 10A.5: Supabase Base Schema Bootstrap
- **Goal**: Create the safe foundation of SQL tables and Row Level Security for live CRUD testing, explicitly excluding complex checkout logic. Enable the developer to seed the first `VITE_CENTER_ID`.
- **Tasks**: Authored `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` mapping `centers`, `profiles`, `center_memberships`, and all standard business entities. Established safe user isolation RLS. Drafted admin seed instructions.
- **Acceptance Criteria**: The SQL file is safely documented. The frontend requires no code changes.
- **Verification Commands / Steps**: Application of SQL script against live Supabase project by the administrator. Retrieve the generated `VITE_CENTER_ID` into `.env`.
- **Explicitly out of scope**: Processing checkout RPC logic or finalizing `invoices`/`payments` tables. Does not alter frontend code.

## Phase 10B: Checkout RPC & Invoice-payment Backend Activation
- **Goal**: Apply the backend Supabase schema and Remote Procedure Calls (RPC) to unlock full financial functionality.
- **Tasks**: Execute `process_checkout_v1` SQL from `docs/PHASE_5B_CHECKOUT_SQL_DRAFT.md`. Deploy pending `invoices` and `invoice_items` schemas globally.
- **Acceptance Criteria**: Actual invoice serialization flow activates on `supabase` mode. Real checkouts deduct inventory and display sales in Reports and Dashboard correctly.
- **Verification Commands / Steps**: Supabase database tests, Live Supabase browser checkout verification.
- **Explicitly out of scope**: Frontend layout changes, SaaS expansions, Multi-center expansions.
