# Supabase Phase 2.11.1 - Implementation Readiness Review

> Historical note: This review predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`.

## 1. Executive Readiness Verdict
**READY FOR CONTROLLED INITIALIZATION** 

All critical blocking decisions have been resolved or mitigated safely through explicit architectural choices. The data models align precisely with the codebase entities, and the strict RLS and RPC boundaries securely address threat vectors around multi-tenancy and transactional safety.

## 2. Source-Trace Findings
A detailed review of `src/domain/entities/index.ts` and `src/domain/ports/repositories.ts` was conducted.
*   **Domain Entities**: Existing models like `Customer`, `Employee`, `Service`, `Appointment`, `Product`, `Invoice`, and `Expense` map well to the proposed schema.
*   **Preview Adapters**: All current write operations gracefully bounce through `SharedNullAdapter`, protecting any premature destructive writes.
*   **Role Constants**: The application relies on frontend roles (`ADMIN`, `MANAGER`, `STAFF`); these successfully map directly to the `member_role` database ENUM types in PostgreSQL.
*   **Missing from UI**: There is no "Appointments Items" distinct from an overall `Appointment`. Currently, appointments are strictly 1:1 with `Service` and `Employee`. This assumption has been explicitly carried over into the final schema design.

## 3. Documentation Corrections Applied
*   **Helper Functions Isolation**: Moved RLS wrapper functions (`user_center_ids` and `has_center_role`) from the reserved `auth` schema into a dedicated `app_private` schema.
*   **SECURITY DEFINER Hardening**: Added explicit `SET search_path = public, auth, app_private` to avoid runtime search-path spoofing attacks.
*   **Implicit Policy Strengthening**: Enforced `WITH CHECK` clauses on all `UPDATE` and `INSERT` (`ALL`) RLS policies to guarantee records cannot be re-parented across `center_id` boundaries.
*   **Employee Relationship**: Introduced a nullable `profile_id` linking column inside the `employees` table.

## 4. Employee Identity Recommendation
The fundamental distinction between an identity (Profile) and a business construct (Employee) has been structurally resolved via a **nullable foreign key**. 
*   **Schema Rule**: `profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL`.
*   **Why It Works**: Employees can exist solely as offline records managed manually by the admin to receive services and tracking. If an employee is granted login capabilities, their `profile_id` links their session.
*   **Safe Archival**: Removing an employee's system access (`auth.users` deletion) simply nullifies the `profile_id` link without affecting the underlying `employees` record. Invoice and appointment histories strictly reference the `employees.id` primary key, keeping the business trail intact forever.

## 5. Final Table Inventory Classification
| Table | Status | Justification |
| :--- | :--- | :--- |
| `centers` | **Required** | Base tenant isolation layer. |
| `profiles` | **Required** | Bridges GoTrue raw states with the tenant mapping. |
| `center_memberships` | **Required** | Safely controls role derivation. |
| `center_settings` | **Required** | Tenant configuration limits. |
| `employees` | **Required** | Service providers mapped by the CRM. |
| `service_categories` | **Required** | Mapped explicitly by the UI state. |
| `services` | **Required** | The primary business offering. |
| `products` | **Required** | Explicitly tracked in Point of Sales workflows. |
| `customers` | **Required** | Core CRM unit. |
| `appointments` | **Required** | Core scheduling entity. |
| `invoices` | **Required** | Ledger header. |
| `invoice_items` | **Required** | Ledger details resolving historical pricing. |
| `expenses` | **Required** | Tracked explicitly on the UI layout. |

*Note on Appointment Items*: Excluded. The frontend establishes an appointment as a single service/employee pair. Building an intermediate relation table is uncalled for per the current codebase.

## 6. SQL Integrity & Data Safety Review
1.  **UUID PKs**: All tables utilize predictable `DEFAULT gen_random_uuid()`.
2.  **Date Storage**: `TIMESTAMPTZ` enforces timezone-aware ledger data preventing time-shift collisions on reports.
3.  **Financial Storage**: Absolute decimal safety is provided via `NUMERIC(15, 3)` preventing Javascript floating-point rounding errors on backend aggregations.
4.  **Archival Strategy**: All primary entities possess a `deleted_at` nullable timestamp column instead of explicit destruction rules to guarantee reporting aggregates remain stable for historical views.
5.  **Tenant Safety**: Foreign keys strictly cascade or prevent deletion at the absolute top tenant boundary (`ON DELETE CASCADE` from `centers`).

## 7. RLS Threat Model & Mitigations
*   **Threat**: *Cross-tenant record insertion bypass.*
    *   **Mitigation**: `WITH CHECK (center_id = ANY(app_private.user_center_ids()))` guarantees new rows explicitly belong to a user's active membership workspaces.
*   **Threat**: *Malicious role elevation.*
    *   **Mitigation**: `center_memberships` updates are completely isolated and can only be altered by elevated owners. Clients cannot send a JSON payload bumping their own role assignment.
*   **Threat**: *Orphaned Active Sessions (Disabled accounts still altering data).*
    *   **Mitigation**: The `app_private.user_center_ids()` relies directly on `center_memberships.is_active = true`. A toggled boolean halts all READ and WRITE layers instantly.
*   **Threat**: *Bypassing POS logic to alter Invoices directly.*
    *   **Mitigation**: Direct inserts bounding `invoices` or `invoice_items` via `WITH CHECK(false)` forbid raw REST API interactions. Operations enforce passing entirely through the atomic `checkout_invoice` RPC endpoint.

## 8. RPC Classification Matrix
| Workflow | Architecture Target | Reason |
| :--- | :--- | :--- |
| **Create appointment** | Direct RLS | Single table insert. Basic RLS guards are sufficient. |
| **Update appointment** | Direct RLS | Safe under `WITH CHECK` tenant isolations. |
| **Cancel appointment** | Direct RLS | Standard table UPDATE toggling `status`. |
| **Finalize checkout (POS)** | **Atomic RPC** | Decrementing `products.stock_quantity`, wrapping `invoices` and nested `invoice_items` insertion within a strict transaction lock to deny duplicate deductions. |
| **Record payment** | Deferred | Future Phase if accounts-receivable logic expands. |
| **Create expense** | Direct RLS | Simple CRUD. |

## 9. Repository Migration Feasibility
The domain ports strictly utilize `Result<T, Error>` tuples which are completely shielded from frontend data structures.
*   **Result**: The adapters can be cleanly recreated inside `Supabase{Entity}Adapter` without any changes to the `useCases` or the components.
*   **Pagination/Filtering**: Relies heavily on Supabase Javascript client `.eq()` and `.order()` chained directly off the base interface filters.
*   **Relationships**: `Customer` inside `Appointments` or `Invoices` easily resolves via PostgREST embedded joins `select="*, customer:customer_id(*)"`.

## 10. Blocking Decisions (RESOLVED)
* All core blocking concerns were resolved during Part 3 and Part 6. The `auth` schema safety violation was patched via `app_private`.
* Strict invoice manipulation was secured utilizing `WITH CHECK (false)`.

## 11. Non-Blocking Deferred Decisions
*   **iOS/WebKit Viewport Scaling**: Will remain isolated from the architectural shift and must be scheduled post-migration for physical device testing.
*   **Post-Checkout Inventory Edits**: Currently checked out items subtract inventory forever. Processing voids/refunds requires complex ledger math and is not requested by the current application scope. It will act as a final one-way write.

## 12. Recommended Next Phase
**PHASE 2.11.2 — SUPABASE INITIALIZATION & PREVIEW FACTORY PROVISIONING.**

*Objective*: Initialize the Supabase Javascript Client in extreme isolation without immediately binding the UI to it. Construct the `EnvironmentRepositoryFactory` evaluating feature flags to selectively serve local preview adapters or real backend services based purely on `.env` existence logic.

## 13. Stop Condition
Proceeding to halt operations entirely per user directions. No runtime files have been altered, no dependencies installed, and no database configuration files executed or established.
