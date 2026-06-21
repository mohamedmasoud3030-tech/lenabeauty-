# Current App Audit (SPA Management App)

## 1. App Purpose and Current Architecture
- **Purpose**: Single-page application designed for basic Salon management (appointments, POS, customers, resources, financials).
- **Architecture**: Segregation of concerns across UI layer (React/Tailwind), Application layer (Context/UseCases), and Infrastructure (Adapters/Supabase). Data access goes strictly through Domain Repository Ports.
- **Scope**: Currently constrained and configured strictly as a **single-center / single-branch** app. `VITE_BRANCH_MODE=single` ensures multi-branch switching is disabled.

## 2. Route/Page Inspection Matrix

| Route | Audited? | Findings / Status |
| :--- | :--- | :--- |
| `LoginPage.tsx` | Yes | Functional. Initialization failures cleanly caught. |
| `DashboardPage.tsx` | Yes | Renders grids. Uses local mocks `[]` for activity. Operational metrics (summary counts) code-complete. Financial reads blocked by missing schema. |
| `AppointmentsPage.tsx` | Yes | Fully functional listing/forms with Create/Update/Delete operations wired. RTL compliance integrated. |
| `CustomersPage.tsx` | Yes | Fully functional listing/forms with Create/Update/Delete operations wired. History is blocked gracefully. RTL compliance integrated. |
| `ServicesPage.tsx` | Yes | Functional. |
| `PosInvoicesPage.tsx` | Yes | Cart logic visible. Checkout strictly blocked by unimplemented `checkout` infrastructure. |
| `InventoryPage.tsx` | Yes | Functional. |
| `ExpensesPage.tsx` | Yes | Functional for read/create/delete. Update missing. |
| `EmployeesPage.tsx` | Yes | Functional. |
| `ReportsPage.tsx` | Yes | Tabs present. Appointments/Inventory reports code-complete. Sales/revenue remain blocked by backend schema. |
| `SettingsPage.tsx` | Yes | Load succeeds. Blocked by unimplemented update/backup properties. |

## 3. Module & Adapter Inspection

### CRUD Coverage Matrix

| Module | Read | Create | Update | Delete | Print / Report |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Customers** | Yes | Yes | Yes | Yes | No (`getHistory` unsupported) |
| **Appointments** | Yes | Yes | Yes | Yes | Yes |
| **Services** | Yes | Yes | Yes | Yes | N/A |
| **Products (Inventory)**| Yes | Yes | Yes | Yes | Yes |
| **Expenses** | Yes | Yes | **v1.1 UI** | Yes | N/A |
| **Employees** | Yes | Yes | Yes | Yes | N/A |
| **POS / Invoices** | Yes | **Block** | N/A | N/A | No (`getForPrint` unsupported)|
| **Dashboard** | Partial | N/A | N/A | N/A | **Block** (Financials unsupported)|
| **Settings** | Yes | N/A | **Block** | N/A | No (`backup` unsupported) |

### Unsupported Supabase Methods Found
The following methods consistently throw `createUnsupportedWriteError` or `createUnsupportedReadError`:
- `Customer.getHistory`
- `Invoice.checkout`
- `Invoice.getForPrint`
- `Settings.update`
- `Settings.uploadLogo`
- `Settings.backup`
- `Settings.exportData`
- `Settings.restore`
- `Dashboard.getPnlMonth`
- `Dashboard.getRevenueLast7Days`
- `Report.getSales`

### Implemented Supabase Methods (Code-Complete, Live QA Pending)
- `Dashboard.getSummary` (Operational metrics)
- `Report.getAppointments`
- `Report.getInventory`

In addition, `Expense.update` exists in the domain port and Supabase adapter contract. The editable expense UI remains deferred to v1.1.

## 4. Runtime Metrics and Risk Vectors

### Removed Preview Behavior
- Preview Mode is not valid in the released product. `VITE_DATA_BACKEND=preview` now produces a hard blocking configuration error, and no Preview source adapter remains under `src/infrastructure/`.
- The application must not rely on empty data sets (`[]`), stubbed responses, deterministic mock center IDs, or demo sessions instead of real database reads.
- **Mitigation**: Unsupported features such as reports generation, POS checkout, dashboard financials, and settings mutations must surface explicit backend-required or unsupported states against the real Supabase configuration.

### Supabase-Backed Behavior
- Strict credential and configuration checks enforce that the single branch environment variable is mapped validly.
- Real remote calls are routed effectively for standard isolated CRUD entities (Customer, Employee, Service, etc.).

### Silent Fallback Risks
- Environment values explicitly throw safely handled `EnvironmentConfigurationError` instances, migrating away from silent backend fallbacks or crashes. The UI securely intercepts them.

### Auth/Session Risks
- **Mitigation (Phase 2)**: The unsafe fallback mapping to `UserRole.STAFF` for users missing `user_metadata` was completely removed. Unmapped or malformed role data now results in a hard failure via `MISSING_OR_INVALID_ROLE`. This prevents unauthorized implicit default read/write access.

### Center ID Validation Status
- **Mitigation (Phase 2)**: In `single` branch mode, `config.centerId` is strictly UUID validated during env initialization. Additionally, during session boot, the client strictly verifies that the authenticated user possesses an explicit membership matching `VITE_CENTER_ID` before mapping the session. Users lacking membership are forcibly rejected via `UNAUTHORIZED_CENTER_MEMBERSHIP`. (Note: True remote backend Row-Level Security isolation relies on the Supabase environment, but the React client application containment is strictly safe now).
- The `PREVIEW_CENTER_ID` mock has been removed from source. v1.0 requires a real `VITE_CENTER_ID`.

### Dashboard/Reporting Risks
- **Implemented Operational Reads**: Methods like `Dashboard.getSummary`, `Report.getAppointments`, and `Report.getInventory` are implemented in code and successfully map base operational data. However, they remain **code-complete with Live Supabase QA pending** to verify relational query stability.
- **Blocked Financial Reads**: Methods like `Dashboard.getPnlMonth`, `Dashboard.getRevenueLast7Days`, and `Report.getSales` remain explicitly mapped to `BACKEND_METHOD_UNSUPPORTED`.
- **UI Integrity**: `DashboardPage` and `ReportsPage` safely catch these unsupported canonical errors and render localized empty or "Backend Required" states rather than falsifying financial data.

### POS/Invoice/Print Risks
- The `Invoice.checkout` function is blocked using safe unsupported methods. `PosInvoicesPage` securely intercepts `BACKEND_METHOD_UNSUPPORTED` and displays a localized alert.
- `Invoice.getForPrint` reliably throws unsupported errors stopping raw crash leaks when attempting prints from the UI.

### Settings/Admin Risks
- `Settings.update`, `uploadLogo`, `backup`, and `restore` mutations are blocked via canonical typed errors reducing risk of silent failures or simulated UI state loops.

### Supabase Adapter Contract Hardening Status (Phase 3)
- **Released Backend Mode**: Supabase is the only valid v1.0 backend. Preview adapters have been removed from the runtime source tree.
- **Implemented & Safe (Supabase)**: `Auth`, `Customer(list, getById, create, update, delete)`, `Employee(list, create, update, delete)`, `Service(list, create, update, delete)`, `Appointment(list, create, update, delete)`, `Product(list(Full), create, update, delete)`, `Expense(list, create, delete)`.
- **Unsupported (Safely Handled in Supabase)**: `Invoice.checkout`, `Invoice.getForPrint`, `Dashboard(getPnlMonth, getRevenueLast7Days)`, `Report(getSales)`, `Settings(update, uploadLogo, backup, restore, exportData)`, `Customer.getHistory`, `Expense.update`. All of these explicitly return a standardized `UnsupportedBackendMethodError` (`BACKEND_METHOD_UNSUPPORTED` code).
- UI gracefully catches this canonical code via `formatError` translating it to localized UI warnings.

### RTL/Mobile Risks
- Migrations from absolute positioning (`ml-`, `pr-`) to localized/logical mappings (`start-`, `pe-`, `ps-`) are confirmed primarily in `CustomersPage`. Continual diligence is required across other modal and input modules.

### UX Config & Runtime Environment Fixes
- Missing or invalid Supabase configuration must render a safe blocking `EnvironmentConfigurationError` screen.
- The **"Enter Preview Mode"** button has been removed and the UI does not allow Preview bypasses around missing database configuration.

### Phase 5B: Checkout Design & Transaction Status
- **Environment Variables**: Confirmed required env var names (`VITE_DATA_BACKEND`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CENTER_ID`, `VITE_BRANCH_MODE`) from `src/config/env.ts`.
- **Domain Audit**: `CheckoutPayload` integrates services/products natively. The `Invoice` domain entity records a `paymentMethod` string. `mapInvoice` and `mapInvoiceItem` mappers exist to support full Supabase serialization.
- **Validation**: Added defensive validation logic in POS UI to verify discount caps, cart sizes, and customer completeness before pushing `CheckoutPayload` to backend adapters.
- **Schema & Implementation Status**: Safely **BLOCKED**. Supabase adapter intercepts the RPC `process_checkout_v1`, explicitly mapping missing RPC instances (`PGRST202` / `42883` / `not found`) to `BACKEND_METHOD_UNSUPPORTED`. No faked checkouts. Checkout will go live immediately once the database administrator executes the required `docs/PHASE_5B_CHECKOUT_SQL_DRAFT.md` schema update inside Supabase.
- **Services Flow**: End-to-end functionality (List, Create, Update, Delete) is code-complete and wired in the UI. Domain properties (`categoryId`, `durationMinutes`) correctly map to UI states, and invalid actions trigger localized toasts.
- **Inventory/Products Status**: End-to-end functionality (List, Create, Update, Delete) is code-complete and wired in the frontend. Form validations ensure no negative numbers for stock, price, and cost. 
  - **Stock Movement Status**: Explicit, historical stock movement/audit tracing is currently NOT present in the domain or database schema. Standard CRUD `update()` simply replaces `stock_quantity`. Transactional decrements during POS remain securely tied to the pending RPC `process_checkout_v1`.
- **Expenses Status**: End-to-end functionality (List, Create, Delete) is code-complete and wired in the frontend. UI validations prevent 0 and negative amounts.
  - **Expense Update Status**: `Expense.update` exists in the domain port and Supabase adapter contract. The expense edit UI is v1.1 work.
- **Supabase Code vs Live QA**: Phase 6 UI interaction mappings and data adapters are code-complete. All code changes were verified to compile correctly with test coverage. However, as with Phase 4 and 5, live Supabase browser verification is still pending.

### Phase 4, Phase 5, Phase 6 General Status
- **POS/Invoice/Payment Domain**: Existing `CheckoutPayload` specifies checkout shape and supports combining products/services. However, there are no Supabase invoices and invoice items mappings present that support the complex transaction, nor is there a true Payment structure beyond a simple string field `paymentMethod` on the read-only Invoice. We intentionally blocked `Invoice.checkout` maintaining an explicit `BACKEND_METHOD_UNSUPPORTED` state, avoiding fake offline states or misleading financial logs.
- **Print correctness**: `getForPrint` is explicitly unsupported preserving safe UI failure via `BACKEND_METHOD_UNSUPPORTED`.
- **UI Validation**: `PosInvoicesPage` successfully guards against empty carts/customers, checking stock validity safely, and prevents false print execution if checkout is unsupported.

### Phase 7: Dashboard and Reports
- **Dashboard Source Matrix**: 
  - *Implemented/Supported*: `customers`, `appointments`, and `products` (low stock) via their respective count/list queries in Supabase.
  - *Blocked/Unsupported*: `sales`, `revenue`, `getPnlMonth`, `getRevenueLast7Days` remain explicitly `BACKEND_METHOD_UNSUPPORTED` because `invoices` and `payments` tables and the checkout RPC are not live. 
  - Fake financial logic has been completely removed across the Dashboard UI when running in Supabase mode, surfacing safe "Backend Required" messages instead.
- **Reports Source Matrix**:
  - *Implemented/Supported*: `appointments` report (via `getAppointments` mapping `customers(name)`, `employees(name)`, `services(name)`) and `inventory` report (via `getInventory`).
  - *Blocked/Unsupported*: `sales` report (via `getSales`) is safely mapped to `BACKEND_METHOD_UNSUPPORTED`.
- **Supabase Code vs Live QA**: Phase 7 UI interaction gates and `DashboardSummary`/`ReportRow` count logic are code-complete. Relational selects on appointments report are locally proven by Typescript schema but strictly require Live Supabase schema QA to guarantee they map.

### Settings and Admin Readiness
- **Settings Audit**: `SettingsRepository.get` behaves correctly via RLS. `update`, `uploadLogo`, `backup`, `restore`, and `exportData` are intentionally and safely mapping to `BACKEND_METHOD_UNSUPPORTED`.
- **Settings UI Honesty**: The SettingsPage successfully identifies unsupported backend functionality and surfaces clean localized alerts. Action buttons no longer fake successful API calls or simulated disk persistence workflows.
- **Admin/User Identity**: Role labels are strictly inferred, ensuring unmapped roles do not silently default to `Staff` (mitigating implicit access confusion). Localization is securely mapped between Arabic/English for identity and core dashboard terminology. 

### Final Frontend Readiness (Phase 9A, 9B, 9C)
- **Unified Mobile Navigation**: A robust mobile shell exists via `Layout.tsx` and `Sidebar.tsx`, integrating a sticky bottom navigation tab bar containing primary modules, and sliding drawer mechanics. Iconography, localization maps, and user roles are dynamically enforced across all breakpoints properly.
- **Responsive Layout Lists (Phase 9B/9C)**: Desktop table views have been successfully wrapped in `hidden lg:block` (or similar display filters), substituting comprehensive stacking card structures for small viewports across all primary list modules (Dashboard, Customers, Appointments, Services, POS, Inventory, Expenses, Employees, Reports, and Settings).
- **RTL & Translation Integrity (Phase 9C)**: Replaced raw string implementations in employee role selects and schema required labels, adding them into `src/i18n.ts`. Direction behavior utilizes logical css classes (`ps`, `pe`, `start`, `end`, `ms`) rigorously to protect Arabic RTL stability alongside structural flex and gap layouts.
- **Truthfulness Validated**: Confirmed frontend completely refuses to emit or visualize fake success records for database functionality lacking schema, protecting invoice checkout, print pipelines, and financial revenue tables accurately against silent failures, marking the end of the SPA frontend phase code.

## 5. Live Supabase QA Checklist (Phase 10A)

Before enabling checkout, verify the following manually against a live Supabase project. **frontend code-complete does not mean backend-complete.** Preview Mode is removed and cannot be used as production-readiness evidence.

### Supabase Environment Variables
Ensure these are exactly configured in your production or local `.env` (without secrets committed):
- `VITE_DATA_BACKEND=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_CENTER_ID`
- `VITE_BRANCH_MODE=single`

Run `npm run preflight:supabase` before browser QA. The command validates local env shape and confirms that `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` remains a base CRUD schema without checkout artifacts.

### Required Supabase Schema Checklist
**Active Tables/Resources** (RLS should be enabled for production. Policies must enforce center_id / membership isolation. Any disabled-RLS setup is local/dev-only and must not be treated as production-ready):
- `centers`
- `profiles`
- `center_memberships`
- `center_settings`
- `customers`
- `appointments`
- `service_categories`
- `services`
- `employees`
- `products`
- `expenses`

*(Apply `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` to initialize these tables without enabling checkout.)*

**Pending Checkout/Finance Schema** (Must remain unapplied during this QA phase):
- `invoices`
- `invoice_items`
- `process_checkout_v1` RPC

### Live QA Steps
**Auth/Config**
- [ ] App starts with `VITE_DATA_BACKEND=supabase`. Missing env values fail visibly.
- [ ] Login works with real admin user mapping to `VITE_CENTER_ID`.
- [ ] Unknown/missing role does not default to Staff. 

**Live Modules (Pending Browser QA)**
- [ ] Customer (list/create/update/delete)
- [ ] Appointment (list/create/update/delete)
- [ ] Service (list/create/update/delete)
- [ ] Product/Inventory (list/create/update/delete)
- [ ] Expense (list/create/delete)
- [ ] Employee (list/create/update/delete)
- [ ] Dashboard operational counts
- [ ] Reports for appointments and inventory

**Blocked/Unsupported Modules (Must visibly block/fail gracefully)**
- [ ] **POS checkout**: Blocked until `process_checkout_v1` is applied.
- [ ] **Invoice print**: Blocked until `getForPrint` backend exists.
- [ ] **Sales/revenue/profit reports**: Blocked until invoice/payment backend exists.
- [ ] **Settings mutations**: Blocked unless backend support exists.
- [ ] **Safely unsupported features**: Settings logo/backup/restore, Customer history, Expense edit UI, Stock movement history.

### General CRUD Status (Customers, Appointments, etc.)
- **Customers**: End-to-end functionality (List, Create, Update, Delete) is code-complete and wired in the UI. Form validations check for empty strings safely. Invalid actions show localized toasts. Customer History (`getHistory`) safely reports as unsupported without crashing.
- **Appointments**: Fully functional booking logic (Create, Update, Delete) is code-complete in the UI. Missing validation states correctly trigger tooltips and error notifications instead of raw stack traces.
- **Verification & QA constraints**: Preview-specific tests have been replaced with hard configuration-error coverage for `VITE_DATA_BACKEND=preview` and missing `.env` paths. Deep Supabase repository workflow mocks remain a testing gap. Additionally, because actual live Supabase backend testing in a browser was unavailable, Phase 4, Phase 5, Phase 6, and Phase 7 remain **code-complete with Live Supabase QA pending**.
