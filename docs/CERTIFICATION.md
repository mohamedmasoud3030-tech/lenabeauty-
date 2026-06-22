# PHASE 2.11.2C — LOCAL SUPABASE READ-PATH CERTIFICATION & MOCKED CONTRACT HARDENING

> Historical note: This certification predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; Preview Mode must not be treated as released behavior.

## 1. Certification Verdict
**VERDICT: PASS WITH BOUNDED GAPS**
The Supabase read-only adapters are correctly isolated, fail closed with bounded typed errors on unsupported methods (Writes, Auth, Aggregates), and lazily initialize the `SupabaseClient`. Static scans confirm zero credentials, no UI leakage of backend config details, and no RPC/DML (`insert`, `delete`, `update`) execution logic.

There are **bounded gaps** by design:
1. All `Aggregate` methods on `DashboardAdapter` and `ReportAdapter` are explicitly `UNSUPPORTED_READ`.
2. All `Auth` methods are explicitly `UNSUPPORTED_AUTH` and return bounded errors, gracefully degrading the UI to the Login page without crashing.
3. All `Write` methods return an expected bounded error (`SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`). The UI currently attempts to use these write methods on explicit user interaction (e.g., creating a customer), displaying the error safely.

## 2. Exact Files Inspected
- `src/domain/ports/repositories.ts`
- `src/domain/entities/*`
- `src/config/env.ts`
- `src/infrastructure/createRepositoryBundle.ts`
- `src/infrastructure/supabase/client.ts`
- `src/infrastructure/supabase/errors.ts`
- `src/infrastructure/supabase/mappers.ts`
- `src/infrastructure/supabase/repositories.ts`
- `src/infrastructure/supabase/index.ts`
- `src/app/composition/useCases.ts`
- `src/context/AppContext.tsx`
- `src/auth.tsx`
- `src/pages/LoginPage.tsx`
- `docs/supabase-schema-draft.sql`
- `docs/supabase-rls-draft.sql`
- `docs/supabase-rpc-draft.sql`

## 3. Exact Files Created
- `docs/CERTIFICATION.md`

## 4. Exact Files Modified
- `src/infrastructure/supabase/mappers.ts` (Removed `any`, hardened parsing, explicit unknown coercions).
- `src/infrastructure/supabase/repositories.ts` (Replaced `catch (e: any)` with `catch (e: unknown)`, improved type safety).
- `src/__tests__/supabase.test.ts` (Aligned mock assertions with updated error shapes).

## 5. Complete Read-Path Matrix

| Repository | Method | Type | State | UI Consumer / Route | Initial Load | Table / View | Query Shape | Mapper | Requires | Nullable Fields | Bounded Error | Outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `Auth` | `login` | AUTH | `UNSUPPORTED` | `auth.tsx` | No | - | - | - | - | - | `AUTH_NOT_CONFIGURED` | BY_DESIGN |
| `Auth` | `logout` | AUTH | `UNSUPPORTED` | `auth.tsx` | No | - | - | - | - | - | `AUTH_NOT_CONFIGURED` | BY_DESIGN |
| `Auth` | `getSession` | AUTH | `UNSUPPORTED` | `AppContext.tsx` | Yes | - | - | - | - | - | `AUTH_NOT_CONFIGURED` | BY_DESIGN |
| `Customer` | `list` | READ | `SUPPORTED` | `CustomersPage` | Yes | `customers` | `.from('customers').select('*').order('created_at')` | `mapCustomer` | `id, name` | `category, phone, email...` | `SUPABASE_QUERY_ERROR` | PASS |
| `Customer` | `getById` | READ | `SUPPORTED` | `CustomerPage` | Yes | `customers` | `.from('customers').select('*').eq().maybeSingle()` | `mapCustomer` | `id, name` | `category, phone...` | `NOT_FOUND` / `SUPABASE_QUERY_ERROR` | PASS |
| `Customer` | `getHistory`| READ | `UNSUPPORTED` | `CustomerPage` | Yes | - | - | - | - | - | `SUPABASE_READ_PATH_NOT_IMPLEMENTED` | BY_DESIGN |
| `Customer` | `create/update/delete`| WRITE | `BLOCKED` | `CustomersPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Employee` | `list` | READ | `SUPPORTED` | `EmployeesPage` | Yes | `employees` | `.from('employees').select('*').order('name')` | `mapEmployee` | `id, name` | `phone, role(defaults)` | `SUPABASE_QUERY_ERROR` | PASS |
| `Employee` | `create/update/delete`| WRITE | `BLOCKED` | `EmployeesPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Service` | `list` | READ | `SUPPORTED` | `ServicesPage` | Yes | `services` | `.from('services').select('*').order('name')` | `mapService` | `id, name, price, duration` | `category_id` | `SUPABASE_QUERY_ERROR` | PASS |
| `Service` | `create/update/delete`| WRITE | `BLOCKED` | `ServicesPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Appointment` | `list` | READ | `SUPPORTED` | `AppointmentsPage`| Yes | `appointments` | `.from('appointments').select('*').gte().lte()`| `mapAppointment` | `id, customer, date` | `employee, service, notes` | `SUPABASE_QUERY_ERROR` | PASS |
| `Appointment` | `create/update/delete`| WRITE | `BLOCKED` | `AppointmentsPage`| No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Product` | `list` | READ | `SUPPORTED` | `InventoryPage` | Yes | `products` | `.from('products').select('*').order('name')` | `mapProduct` | `id, name, cost, price` | `barcode` | `SUPABASE_QUERY_ERROR` | PASS |
| `Product` | `create/update/delete`| WRITE | `BLOCKED` | `InventoryPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Expense` | `list` | READ | `SUPPORTED` | `ExpensesPage` | Yes | `expenses` | `.from('expenses').select('*').order('date')` | `mapExpense` | `id, amount, category` | `description` | `SUPABASE_QUERY_ERROR` | PASS |
| `Expense` | `create/delete`| WRITE | `BLOCKED` | `ExpensesPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Settings` | `get` | READ | `SUPPORTED` | `SettingsPage` | Yes | `center_settings` | `.from('center_settings').select('*').maybeSingle()` | `mapCenterSettings` | `center_id, name` | `currency, tax, logo...` | `SUPABASE_QUERY_ERROR` | PASS |
| `Settings` | `* (others)`| WRITE | `BLOCKED` | `SettingsPage` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Dashboard`| `getSummary/getPnlMonth/getRevenueLast7Days` | READ | `UNSUPPORTED` | `DashboardPage` | Yes | - | - | - | - | - | `SUPABASE_READ_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Report` | `getSales/getAppointments/getInventory` | READ | `UNSUPPORTED` | `ReportsPage` | Yes | - | - | - | - | - | `SUPABASE_READ_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Invoice` | `checkout` | WRITE | `BLOCKED` | `Checkout` | No | - | - | - | - | - | `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`| BY_DESIGN |
| `Invoice` | `getForPrint`| READ | `UNSUPPORTED` | `Invoice` | No | - | - | - | - | - | `SUPABASE_READ_PATH_NOT_IMPLEMENTED`| BY_DESIGN |

## 6. Schema-Alignment Findings
- All mapped `.from().select()` operations perfectly match `docs/supabase-schema-draft.sql`. 
- No table schema modifications or query discrepancies discovered. 
- Mapping explicitly handles numeric types (e.g. Postgres representation as string) via explicit `Number()` coersions.

## 7. Mapper-Hardening Findings
- `any` usages inside `src/infrastructure/supabase/mappers.ts` replaced with `unknown`.
- `parseDate` was upgraded to throw `createMappingError` if a date string is malformed or missing (fails closed instead of falling back to default dates).
- Object shape explicitly checked via `assertRowObject`.
- The mapper correctly isolates the UI/Domain from unvalidated payload mutations.

## 8. Supabase-mode Startup Trace
When `VITE_DATA_BACKEND=supabase`:
1. Environment variables trace initializes mode to `"supabase"`.
2. `AppContext.tsx` invokes `useCases.auth.getSession()` on mount.
3. Call translates to `new SupabaseAuthAdapter().getSession()`.
4. Adapter synchronously returns `AUTH_NOT_CONFIGURED` without emitting a single HTTP request (since `getSupabaseClient` is skipped).
5. `AppContext` catches error, transitions into `ERROR` state.
6. The `LoginPage` cleanly captures the code (`AUTH_NOT_CONFIGURED`) and correctly displays "لم يتم إعداد المصادقة بعد. يرجى إعداد قاعدة البيانات أولاً." (Graceful UI presentation without runtime crash). No further reads are aggressively invoked since protected routes block them.

## 9. Preview-code Regression Result
`VITE_DATA_BACKEND=preview` strictly skips Supabase client generation and accesses the legacy mock adapters. This is a local safety regression check only. It is not a valid setup, fallback, demo, sales, or release-verification path for v1.0.

## 10. Static-Scan Results
- Zero runtime occurrences of `.insert(`, `.update(`, `.delete(`, `.rpc(`.
- Zero runtime occurrences of `as unknown as`, `any` in mapper outputs, or `fetch(`.
- Zero leaked `sb_secret_` or `service_role` credentials outside test defensive assertions.

## 11. `npx tsc --noEmit` Result
Result: `PASS` (0 Errors).

## 12. `npx vitest run` Result
Result: `PASS`
Test Count: 32 tests passed across 3 files.

## 13. `npm run build` Result
Result: `PASS`
Successfully built the SPA bundle, outputs chunks to `/dist`.

## 14. Remaining Unsupported Methods
Grouped by Repository:
- **Auth**: `login`, `logout`, `getSession`.
- **Customer**: `getHistory`, `create`, `update`, `delete`.
- **Employee**: `create`, `update`, `delete`.
- **Service**: `create`, `update`, `delete`.
- **Appointment**: `create`, `update`, `delete`.
- **Product**: `create`, `update`, `delete`.
- **Expense**: `create`, `delete`.
- **Invoice**: `checkout`, `getForPrint`.
- **Settings**: `update`, `uploadLogo`, `backup`, `exportData`, `restore`.
- **Dashboard**: `getSummary`, `getPnlMonth`, `getRevenueLast7Days` (ALL).
- **Report**: `getSales`, `getAppointments`, `getInventory` (ALL).

## 15. UI Screens Still Unavailable
1. All Dashboard charts and analytics.
2. All Reports aggregate screens.
3. Checkout Screen / Invoice Generation.
4. Customer Detail Sub-tabs (Appointment histories, payment records).
5. Application features behind Auth require real Supabase auth for v1.0 release verification.

## 16. Blockers and Mismatches
None at this time. The schema alignment matches successfully. The architecture correctly blocks all mutations by design.

## 17. Recommended Next Phase
`PHASE 2.11.2D — SUPABASE AUTHENTICATION INFRASTRUCTURE & UI WIRING`
Establish real Supabase project authentication mechanisms (AuthAdapter implementation without `UNSUPPORTED` blocks) or migrate `RPC` procedures to unblock Analytics and complex `getHistory` reads.
