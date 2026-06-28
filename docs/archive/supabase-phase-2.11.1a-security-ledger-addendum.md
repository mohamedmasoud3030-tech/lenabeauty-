# Supabase Phase 2.11.1A - Security & Ledger Hardening Addendum

> Historical note: This addendum predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`.

## 1. Executive Verdict
**READY FOR CONTROLLED INITIALIZATION.**

All security and ledger integrity blockers raised in Phase 2.11.1 have been comprehensively addressed. The database design properly encapsulates logic within hardened RPCs, maintains distinct append-only ledgers for payments and inventory, and defines secure tenancy constraints suitable for safe application development.

## 2. Security-Definer Hardening Changes
*   **Empty Search Path:** Replaced the vulnerable search_path defaults with `SET search_path = ''`.
*   **Explicit Referencing:** All tables and types within the `checkout_invoice` RPC are fully qualified (`public.products`, `public.invoices`, `public.member_role`, etc.) to mitigate search_path spoofing or collision attacks.
*   **Built-in qualification:** Built-in PostgreSQL functions are qualified with `pg_catalog.` (e.g., `pg_catalog.jsonb_array_elements`).
*   **Strict Access Control:** An explicit `auth.uid()` evaluation restricts execution immediately if standard authentication context is missing before evaluating logic.

## 3. Final Search Path Strategy
`SECURITY DEFINER` functions execute with `SET search_path = ''`. This intentionally forces all internal object accesses to be structurally explicit, locking out schemas attackers might inject via the client or dynamically generated queries.

## 4. Inventory-Ledger Design
An append-only `inventory_movements` table is the authoritative source for inventory logic. It logs stock mutations contextually:
*   **Types:** Restricted via `CHECK` to `checkout`, `manual_adjustment`, `restock`, `correction`.
*   **Product Sync:** The `products.stock_quantity` column serves as an atomic cached value. The RPC decreases this while stamping the ledger. The cache represents current stock without executing costly `SUM()` operations on the fly.
*   **Safety:** Direct client inserts/updates/deletes for movements are completely blocked via RLS.

## 5. Payment-Model Decision
A distinct `payments` table has been implemented instead of burying payment data inside the `invoices` table.
*   **Architecture:** `payments` links strictly `1:N` back to `invoices`.
*   **Immediate Scope:** The `checkout_invoice` RPC creates exactly *one* payment covering the full amount simultaneously alongside the invoice snapshot.
*   **Forward Compatibility:** Structured gracefully to support future partial/split payments and voids without redefining the fundamental transactional core.

## 6. Invoice Immutability Rules
*   Invoices explicitly track a `status` (`DRAFT`, `FINALIZED`, `VOIDED`).
*   The `checkout_invoice` RPC automatically establishes invoices under `FINALIZED`.
*   Line items (`invoice_items`) capture static `price` and `quantity` snapshots deterministically unaffected by future modifications to the core `products` or `services` catalogs.
*   Direct client mutation mappings (`UPDATE` / `DELETE` / `INSERT`) against `invoices` and `invoice_items` are expressly denied by `WITH CHECK (false)`.

## 7. Checkout Transaction Steps
The `checkout_invoice` RPC securely governs atomic checkout operations:
1.  Verifies the active requester context via `auth.uid()`.
2.  Validates center authorization boundaries (`app_private.has_center_role()`).
3.  Evaluates requested quantities inside a `SELECT ... FOR UPDATE` row lock, completely mitigating negative-stock scenarios.
4.  Derives authentic prices directly from database catalogs, dropping any client-supplied totals.
5.  Calculates totals dynamically.
6.  Injects the `invoices` header.
7.  Populates immutable `invoice_items`.
8.  Alters cached `products.stock_quantity` and commits `inventory_movements` ledgers.
9.  Establishes the receipt in `payments`.
10. Automatically triggers PostgreSQL transaction wrap logic—if any validation fails or hardware locks, the exact state reverts.

## 8. Identity-Lifecycle Clarification
*   **Profiles:** Directly bridges `auth.users` via a `CASCADE` delete mapping. Provides system-level identification (`full_name`).
*   **Center Memberships:** Scoped tenant authorization. Standard logical revocation flips `is_active = false` immediately severing application control.
*   **Employees:** A strictly isolated scheduling, payload, and payload record (`nullable profile_id`). Removing an `auth.users` identity unlinks the profile safely (`ON DELETE SET NULL`), but retains historical scheduling, financial, and employment analytics permanently.
*   **Multi-tenancy:** Standardized gracefully. A user maintains discrete `center_memberships` links representing ownership in Center A whilst only staffing Center B.

## 9. Tenant and Membership-Bootstrap Strategy
*   **Provisioning:** Creating external initial accounts (the very first `owner`) must be conducted utilizing either administrative tools, manual onboarding, or a discrete server-centric signup function (Supabase Edge Function or secure API) that constructs the `center`, `profile`, and `center_membership` as an atomic suite.
*   **In-app Management:** Creating follow-on members is governed via `center_memberships`, tightly locked down by RLS guaranteeing `manager` or `owner` privileges cannot be provisioned by a lower-scoped user.

## 10. RLS and Grant Matrix
| Object | Anonymous | Auth Read | Direct Insert | Direct Update | Direct Delete | RPC-Mutation | Role Req |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `centers` | Denied | Yes (if member) | Denied | Denied | Denied | N/A | Member |
| `profiles` | Denied | Yes (if member) | Denied | Self only | Self only | N/A | Member |
| `center_memberships` | Denied | Yes (if member) | Denied | Admins/Owners | Admins/Owners | N/A | Admin/Owner |
| `center_settings` | Denied | Yes (if member) | Denied | Admins/Owners | Denied | N/A | Admin/Owner |
| `employees` | Denied | Yes (if member) | Yes | Yes | Yes | N/A | Member |
| `services` | Denied | Yes (if member) | Yes | Yes | Yes | N/A | Member |
| `products` | Denied | Yes (if member) | Yes | Yes | Yes | N/A | Member |
| `inventory_movements`| Denied | Yes (if member) | Denied | Denied | Denied | Yes | N/A |
| `customers` | Denied | Yes (if member) | Yes | Yes | Yes | N/A | Member |
| `appointments` | Denied | Yes (if member) | Yes | Yes | Yes | N/A | Member |
| `invoices` | Denied | Yes (if member) | Denied | Denied | Denied | Yes | N/A |
| `invoice_items` | Denied | Yes (if member) | Denied | Denied | Denied | Yes | N/A |
| `payments` | Denied | Yes (if member) | Denied | Denied | Denied | Yes | N/A |
| `expenses` | Denied | Admins/Owners   | Admins/Owners | Admins/Owners | Admins/Owners | N/A | Admin/Owner |

## 11. Corrected Table Classification
*   `centers`: Required for controlled initialization.
*   `profiles`: Required for controlled initialization.
*   `center_memberships`: Required for controlled initialization.
*   `center_settings`: Required for controlled initialization.
*   `employees`: Required for controlled initialization.
*   `service_categories`: Required for controlled initialization.
*   `services`: Required for controlled initialization.
*   `products`: Required for controlled initialization.
*   `inventory_movements`: Required for controlled initialization.
*   `customers`: Required for controlled initialization.
*   `appointments`: Required for controlled initialization.
*   `invoices`: Required for controlled initialization.
*   `invoice_items`: Required for controlled initialization.
*   `payments`: Required for controlled initialization.
*   `expenses`: Required for controlled initialization.
*   `appointment_items`: Not justified by current behavior (1:1 employee/service structure preserved).

## 12. Remaining Blockers
*   None.

## 13. Deferred Enhancements
*   Invoice reversals/Voidal workflows.
*   Partial payment handling scenarios.
*   Cross-tenant analytics schemas.

## 14. Exact Recommended Next Phase
**PHASE 2.11.2 — SUPABASE INITIALIZATION & PREVIEW FACTORY PROVISIONING.**

## 15. Stop Condition
Documentation generation corresponds to explicitly restricted boundary conditions. Execution pauses immediately awaiting user approval to commence real infrastructure wiring.
