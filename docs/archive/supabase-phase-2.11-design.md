# Supabase Architecture & Migration Blueprint - Phase 2.11

> Historical note: This design predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; `UserRole.PREVIEW`, Preview adapters, and `PREVIEW_READ_ONLY` are legacy concepts awaiting source removal.

## Part 1 — Current Architecture Inventory

### Domain Entities & Sessions
- **Customer**: `id`, `name`, `category`, `phone`, `email`, `notes`, `totalSpent`, `loyaltyPoints`, `lastVisit`, timestamps.
- **Employee**: `id`, `name`, `role`, `phone`, `salary`, `baseSalary`, `commissionPercentage`, `isActive`, `username`, `password`, timestamps.
- **Service**: `id`, `name`, `categoryId` (maps to ServiceCategory), `price`, `durationMinutes`, `isActive`, timestamps.
- **ServiceCategory**: `id`, `name`.
- **Product**: `id`, `name`, `barcode`, `stockQuantity`, `price`, `cost`, timestamps.
- **Appointment**: `id`, `customerId`, `employeeId`, `serviceId`, `dateTime`, `status`, `notes`.
- **Invoice**: `id`, `serialNumber`, `date`, `totalAmount`, `discount`, `loyaltyPointsUsed`, `paymentMethod`, `customerId`.
- **InvoiceItem**: `id`, `invoiceId`, `serviceId`, `productId`, `price`, `quantity`.
- **Expense**: `id`, `amount`, `category`, `description`, `date`.
- **CenterSettings**: `id`, `name`, `currency`, `taxRate`, `logoPath`, `address`, `phone`, `cr`, `postalCode`.
- **Session/User**: `id`, `username`, `role` (ADMIN, MANAGER, STAFF, PREVIEW), `name`.

### Preview Adapters & Boundaries
- All reads currently bypass backend and return empty arrays or mocked objects inside the `PreviewAdapters.ts` implementations (`PreviewCustomerAdapter`, `PreviewInvoiceAdapter`, etc.).
- All writes are immediately rejected by `SharedNullAdapter` with a `PREVIEW_READ_ONLY` error.
- Authentication returns a hardcoded mock session when `VITE_ENABLE_PREVIEW_MODE` is active.

### Role & Permission Checks
- Currently evaluated in the frontend `Session.ts` via `can()` function.
- `ADMIN` role is universally permissive.
- `MANAGER` role is needed for `reports.*` and `settings.*`.
- Feature access is gatekept purely by React Route guards inspecting the session state.

## Part 2 — Proposed Database Model Map

| Domain Concept | Proposed Supabase Table | Purpose |
|---|---|---|
| Tenant / Salon | `centers` | Explicit multi-tenant boundary handling branch isolations. Primary Key: UUID. |
| User Profile | `profiles` | Extends `auth.users` via 1:1 fk. Contains `full_name`. |
| Workspace Membership | `center_memberships` | Associates a `profile_id` with a `center_id` and a role mapping (`owner`, `manager`, `staff`). |
| Configuration | `center_settings` | Directly mapped to `CenterSettings` entity. PK: `center_id` mapping 1:1. |
| Customer | `customers` | Persists `Customer` entity. Belongs to a single `center_id`. Tracks total spend & points. |
| Employee | `employees` | Replaces `username`/`password` entity fields as employees will not necessarily need direct app auth to exist. They belong to `center_id`. |
| Service Catalog | `services` | Belongs to `center_id`. Enforces soft delete behavior. |
| Product | `products` | Belongs to `center_id`. Tracks `stock_quantity`. |
| Appointment | `appointments` | Maps explicitly to `customers`, `employees`, and `services` via Foreign Keys. |
| POS Header | `invoices` | Transaction header. Bound to `center_id` and optionally `customer_id`. |
| POS Lines | `invoice_items` | Links exactly to `invoice_id`, with optional linkage to `product_id` and `service_id`. |
| Cash flow log | `expenses` | Simple records tracked per `center_id`. |

**Assumptions needing Product Confirmation:**
* Will employees login and check schedules, or are they only records managed by admins? If they login, we need to map `employees` to `auth.users` profiles.
* Do we allow the same Customer to exist across multiple Centers, or are they entirely isolated per tenant? (Proposed: Isolated per tenant).

## Part 3 — Repository Migration Mapping

| Existing Port | Preview Adapter | Proposed Supabase Adapter | RPC / Table Targets | Migration Risk |
|---|---|---|---|---|
| `AuthRepository` | `PreviewAuthAdapter` | `SupabaseAuthAdapter` | `auth.users`, `center_memberships` | Sets global `center_id` context. |
| `CustomerRepository` | `PreviewCustomerAdapter` | `SupabaseCustomerAdapter` | `customers` table | Low. Direct mapped operations. |
| `EmployeeRepository` | `PreviewEmployeeAdapter` | `SupabaseEmployeeAdapter` | `employees` table | Low. Read/Write directly constrained. |
| `ServiceRepository` | `PreviewServiceAdapter` | `SupabaseServiceAdapter` | `services` table | Low. |
| `AppointmentRepository` | `PreviewAppointmentAdapter` | `SupabaseAppointmentAdapter` | `appointments` | Joins require PostgREST embedding capabilities. |
| `ProductRepository` | `PreviewProductAdapter` | `SupabaseProductAdapter` | `products` | Inventory managed via POS RPC. |
| `InvoiceRepository` | `PreviewInvoiceAdapter` | `SupabaseInvoiceAdapter` | `checkout_invoice` RPC | **High Risiko**. Transaction locks required. |
| `ExpenseRepository` | `PreviewExpenseAdapter` | `SupabaseExpenseAdapter` | `expenses` | RLS prevents staff viewing totals. |
| `SettingsRepository` | `PreviewSettingsAdapter` | `SupabaseSettingsAdapter` | `center_settings` | Single row per center handling. |

## Part 4 — Authentication and Authorization Design

1. **Identity & State**: Identity will flow through Supabase `GoTrue` (`supabase.auth.getSession()`).
2. **Profiles**: A public `profiles` table maps user-provided display names outside of `auth.users` raw metadata.
3. **Memberships**: The `center_memberships` table handles Tenant Association. A user can be part of `Center A` as `owner` and `Center B` as `staff`.
4. **Context Switching**: The frontend drops its simple `Session.ts` role string in favor of selecting an active `center_id` environment at login. This ID is passed on all subsequent RPC/HTTP calls.
5. **Enforcement (RLS)**: The frontend Route guards remain for UX, but RLS policies perform the final validation to ensure `auth.uid()` possesses an active membership for the requested `center_id`.
6. **Feature Gates**: Settings and reporting will be blocked at the RLS level by explicit helper functions `has_role(centerId, ['owner', 'manager'])`.

## Part 5 — Migration Sequence Blueprint

This forms the future atomic progression track allowing zero-downtime execution:

1. **Phase 2.11.1 - Schema Application**: Apply `schema`, `rls`, and `rpc` definitions to the live remote Supabase environment (Non-destructive).
2. **Phase 2.11.2 - Authentication Layer Swap**: Implement `SupabaseAuthAdapter`. Introduce an `EnvironmentRepositoryFactory` evaluating `.env` limits to either serve Preview or Supabase.
3. **Phase 2.11.3 - Catalog Migration (Services, Employees, Products)**: Implement simple table-driven repository mappings. Test fetching seeded Supabase datasets.
4. **Phase 2.11.4 - Customers & Appointments**: Implement relation-heavy adapters matching nested DTO shapes using PostgREST embedding (`select="*, customer:customerId(*)"`).
5. **Phase 2.11.5 - Secure POS Checkout (Invoices)**: Implement the complex RPC adapter wrapping Supabase PostgreSQL transactions to decrement inventory seamlessly.
6. **Phase 2.11.6 - Rollups & Reporting Analysis**: Rewrite Dashboard views to utilize cached database aggregate patterns instead of expensive client-side accumulation.

## Part 6 — Deferred QA Risk Register

The following visual QA states remain mathematically, environmentally, or technically unverified passing from 2.10.3:
1. No Chromium, WebKit, or equivalent browser engine render verification was performed to confirm actual DOM painting geometries.
2. No screenshots were captured or produced.
3. WCAG AA contrast ratios remain mathematically unverified due to lack of a simulated paint tree.
4. iOS Safari 15+ viewport safe-area behavior (notches, floating address bars) remains unverified.
5. Soft-keyboard input collision behavior (preventing modals from scrolling) remains unverified.
6. Horizontal scroll momentum on the Appointments Timeline and POS mobile catalog modules requires manual physical device testing to confirm gesture smoothness.
7. Unintended body-level horizontal overflow remains formally unverified until a browser layout engine asserts `document.documentElement.scrollWidth`.
