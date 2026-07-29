# Supabase Integration Sequence & Adapter Migration Map

> Historical note: This document predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; `VITE_DATA_BACKEND=preview`, Preview adapters, and `checkPreviewWrite` must be removed in the next implementation PR.

This document tracks the phased progression from local-memory Preview Providers to remote, highly-available Supabase Service adapters. The `CompositionRoot` will swap dependency instances safely.

## Migration Principles
1. **No Interface Bleed**: Existing interfaces in `src/domain/ports/repositories.ts` MUST remain stable. The Supabase implementation will map Postgres `snake_case` models to standard Typescript `camelCase` entities inherently.
2. **Atomic Upgrades**: Adapters are swapped incrementally in discrete PR segments, verified by vitest against the integration bounds.
3. **Session Rehydration**: The AuthAdapter goes first to establish the `center_id` ambient execution context.

## Repository Mapping Strategy

| Domain | Current Adapter | Supabase Target Adapter | Backend Strategy | Impact Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `PreviewAuthAdapter` | `SupabaseAuthAdapter` | Overlays `@supabase/supabase-js` `auth` namespace. Maps identity profiles into local `Session` objects. Resolves `Active Center ID`. | Global requirement. Unlocks targeted queries. |
| **Settings** | `PreviewSettingsAdapter` | `SupabaseSettingsAdapter` | Selects from `center_settings`. Restricts `update()` via RLS bounds. | Light scope. Read-heavy. |
| **Employees** | `PreviewEmployeeAdapter` | `SupabaseEmployeeAdapter` | CRUD on `employees`. Respects soft-delete flag. | Admin config dependency. |
| **Services** | `PreviewServiceAdapter` | `SupabaseServiceAdapter` | CRUD on `services`. Validates category maps. | POS and Appt dependency. |
| **Products** | `PreviewProductAdapter` | `SupabaseProductAdapter` | Simple CRUD. Inventory manipulation happens via POS RPC. | Admin config dependency. |
| **Customers** | `PreviewCustomerAdapter` | `SupabaseCustomerAdapter` | CRUD on `customers`. Implements `getHistory()` with parallel nested joins. | High impact data anchoring. |
| **Appointments**| `PreviewAppointmentAdapter` | `SupabaseAppointmentAdapter` | Performs nested joins `appointments(*, customers(*), services(*), employees(*))` with Date range scopes. | Core Operational Dependency. |
| **Expenses** | `PreviewExpenseAdapter` | `SupabaseExpenseAdapter` | Simple CRUD via insert logic. RLS blocks non-admins viewing aggregate queries. | Financial tracking. |
| **Invoices** | `PreviewInvoiceAdapter` | `SupabaseInvoiceAdapter` | Swaps pure logic out for execution of custom RPC: `rpc('checkout_invoice', { ... })`. Maps output back to DTO. | High execution risk. Ensures transaction lock reliability. |

## Sequence of Execution

### Phase 1: Authentication & Substrate
- Provide `createClient` wrappers isolating the singleton connections.
- Implement `SupabaseAuthAdapter`, `SupabaseSettingsAdapter`.
- Replace `checkPreviewWrite` barriers with database-enforced RLS rejections or structured Supabase Error object mappers.

### Phase 2: Static Catalog Provisioning
- Implement `SupabaseEmployeeAdapter`, `SupabaseServiceAdapter`, `SupabaseProductAdapter`.
- Allows test-data seeding from Admin dashboards.

### Phase 3: Core Transaction Workflows
- Implement `SupabaseCustomerAdapter` and `SupabaseAppointmentAdapter`.
- Build the Calendar views relying heavily on complex PostgREST filtered queries `gte('date_time', x)`.

### Phase 4: Atomic POS Rollout
- Deploy Postgres `checkout_invoice` RPC logic to remote instance.
- Implement `SupabaseInvoiceAdapter` and tie to standard use cases.
- Run rigorous parallel dry-runs.

### Phase 5: Reporting & Rollups
- Formulate complex `SupabaseReportAdapter`. Note: PostgREST struggles with complex pivot charts, so the adapter might execute specific RPC rollup summaries or rely on application-level accumulations from paginated list pulls over defined temporal windows.

--- 
*End of Sequence Plan*
