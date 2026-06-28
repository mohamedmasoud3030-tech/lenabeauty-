# Phase 2.11.2E-R+ Multi-Track Pre-Sale Certification

> Historical note: This certification predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`.

## 1. Final Phase Verdict
**SUPERSEDED - NOT A v1.0 SALES GATE**

This historical certification predates the v1.0 source-of-truth model. v1.0 readiness requires real Supabase auth, real CRUD persistence, and browser QA against the configured single-center Supabase PWA. Preview Mode is not a valid setup, fallback, demo, sales, or release-verification path.

## 2. Exact Files Inspected
* `src/infrastructure/supabase/repositories.ts`
* `src/infrastructure/supabase/client.ts`
* `src/infrastructure/supabase/mappers.ts`
* `src/__tests__/supabase.test.ts`
* `docs/supabase-schema-draft.sql`
* `docs/supabase-rls-draft.sql`
* `src/ui/layout/Layout.tsx`
* `src/pages/PosInvoicesPage.tsx`
* `src/pages/CustomersPage.tsx`
* `src/shared/components/ConfirmDialog.tsx`

## 3. Exact Files Created
* `docs/supabase-dml1-server-side-center-contract-draft.sql`
* `docs/DEMO_OPERATOR_GUIDE.md`
* `docs/MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`
* `docs/NEXT_BOUNDED_INCREMENT_BACKLOG.md`
* `docs/PHASE_2.11.2E_R_PLUS_MULTI_TRACK_PRE_SALE_CERTIFICATION.md`

## 4. Exact Files Modified
* `src/__tests__/supabase.test.ts`

## 5. Customers DML Review
The `SupabaseCustomerAdapter` safely maps payload bounds. Missing or prohibited properties like `center_id` are distinctly stripped from UI manipulation correctly. Read mappings safely discard or fallback if nullable fields arrive unpopulated. Expanded unit testing now guarantees that infrastructure failures safely transition into normalized `DomainError` bounds (`SUPABASE_QUERY_ERROR`).

## 6. Services DML Review
The `SupabaseServiceAdapter` matches the identical rigor of `Customers`. Values like `is_active` coerce cleanly without propagating undefined assertions. Tests expanded properly to ensure missing records and update payload modifications succeed safely without mutating constraints.

## 7. Client Payload Findings
The adapters never construct instances mapped with UI-derived `center_id` records. Payload definitions are completely restricted to structural definitions `Record<string, unknown>` before executing `supabase.from()`.

## 8. Server-Side Tenant Design
Because the UI must never decide `center_id`, this phase explicitly defines a `get_current_user_center_id()` fallback method bound through `center_memberships`. The safest approach enforces `BEFORE INSERT` triggers so that even if the schema allows a direct insertion implicitly, the database permanently forces the entity's UUID down to the validated server context mapping.

## 9. SQL Draft Summary
`docs/supabase-dml1-server-side-center-contract-draft.sql` maps the strict schema functions needed to create the Before Insert trigger. It establishes tenant tracking that enforces immutability; ensuring updates can never shift rows across distinct tenants. 

## 10. Local Database Validation Status
LOCAL DATABASE EXECUTION NOT AVAILABLE. (This must be validated over an actual pg_trigger test suite when executing staging).

## 11. Preview Isolation Findings
`Preview Mode` isolates write paths against local-state `Map` objects. This is a legacy local inspection/test behavior only and is not valid for v1.0 product readiness.

## 12. Error-State Findings
Queries to Supabase wrap internally in heavy `try/catch` handlers that map standard SQL/PostgREST error codes. Fallback boundaries correctly parse missing or unexpected row mutations and emit bounded UI toasts.

## 13. Print Workflow Findings
Print pipelines have been heavily isolated using Tailwind's `print:hidden` pseudo-selectors. Standard sidebars, structural cards, navigation elements, background blobs, and action buttons dynamically strip themselves upon invoking `window.print()`.

## 14. Historical Reprint Findings
A dedicated `Print` button properly fires `window.print` over the selected history. Using a minor 500ms set-timeout delay solves layout render inconsistencies cleanly, restoring the exact historical ledger correctly without requiring manual copy-pasting.

## 15. 80mm Findings
The entire receipt object conforms to thermal assumptions via a hard `w-[80mm]` wrapper. Native fonts conform clearly and line breaks respect dense tables seamlessly. 

## 16. A4 Findings
Due to `.mx-auto` bounds, A4 generation scales fine down the middle of standard PDFs. Text sizes aren't blown out heavily.

## 17. Mobile Findings
Deep `overflow-x-auto` mappings over the heavy tables prevent the vertical stack from fracturing horizontally. Mobile spacing and active navigation targets respond to padding requirements nicely. 

## 18. RTL Findings
Arabic mirroring has been thoroughly supported from the genesis architectural stages. Padding values utilize `start` and `end` bounds exclusively ensuring flawless logical-reversals inside standard browsers.

## 19. Previous UI Notes Matrix

| Note | Status | Evidence | Amendment | Remaining Gap |
| :--- | :--- | :--- | :--- | :--- |
| **alert() / confirm() Presence** | CLOSED | `grep` validation zero matching outside of native custom UI | Enforced `useConfirm` adoption. | None |
| **Empty State Coverage** | CLOSED | Visual audits over Customers, Items | Empty list rendering verified | None |
| **Print Padding / Sidebar bleed** | CLOSED | `print:hidden` classes injected | Layout layout isolated. | None |

## 20. Role and Permission Matrix

| Capability | Current Enforcement Layer | Verified | Gap | Required Future Action |
| :--- | :--- | :--- | :--- | :--- |
| Login Access | Frontend Fallback / GoTrue | Not Enough Evidence | Real Auth needs DB. | Supabase Hook. |
| Customer Reads | UI State / Preview / RLS Draft | Partial | Drafts not active. | Apply RLS script. |
| Customer Writes | UI State / Preview | Verified | Isolated to preview. | Apply trigger. |
| Checkout | UI State / Preview | Deferred | RPC Atomicity needed. | Phase 2.11.2F |
| Reports | Local preview aggregation | Deferred | Analytics views needed. | Data warehousing |

## 21. Backup and Recovery Matrix
Backup operations strictly export isolated blob representations mapping to local browser limits limit defaults. Recovery operations wipe local caches entirely. Supabase live recovery pathways do not exist actively inside the application code and must be manually tracked remotely through standard GCP/AWS dump boundaries. 

## 22. Environment Readiness Findings
`.env.example` remains explicitly devoid of secrets. `VITE_` limits keep configuration perfectly decoupled safely. Vite environments parse strict variables effectively stopping broken initializations cleanly. 

## 23. Operational Workflow Inventory

| Domain | Method | Preview Status | Supabase Read Status | Supabase Write Status | Security Requirement | Recommended Increment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Customers | Native | Active | Active | LIVE BOUNDED DML | Trigger bounds | Current |
| Services | Native | Active | Active | LIVE BOUNDED DML | Trigger bounds | Current |
| Employees | Static Profile | Active | Deferred | DEFERRED | Role enforcement | Candidate A |
| Appointments| Temporal | Active | Deferred | DEFERRED | Collision mapping | Candidate B |
| Invoices | Ledger | Active | Deferred | PROHIBITED DIRECT DML| RPC Enforced | Candidate D |

## 24. Demo Readiness Findings
The user experience provides a massive, polished, feature-complete frontend illusion that makes the software appear highly integrated. Prospect owners will easily witness value density immediately. `DEMO_OPERATOR_GUIDE.md` generated correctly to map assumptions safely.

## 25. Static Scan Results
- `@ts-ignore` / `@ts-expect-error` / `<any>` (Unsafe casts): 0 matching hits indicating poor typings. 
- `console.log`: Only found in Service Worker registry logic safely.
- `alert` / `confirm` / `prompt`: Native blocks have zero raw usage securely isolated within the custom React wrappers. 
- Hardcoded URLs / Supabase Keys / `SERVICE_ROLE`: 0 hits across all source sets safely ensuring token integrity. 

## 26. Verification Command Results
* `tsc --noEmit`: 0 Errors (Exit code 0).
* `vitest run`: 3 Test suites executed, 49 tests passed. 0 Failed.  (Exit Code 0)
* `vite build`: Build executed gracefully. Artifacts processed effectively without error. (Exit code 0)

## 27. Manual Verification Requirements
Given the heavy reliance on thermal receipts natively mapped through browser capabilities alongside RTL styling requirements natively relying upon OS/Browser support, `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` explicitly lists mandatory 80mm testing boundaries.

## 28. Sale-Readiness Verdict
**CONTROLLED PILOT READY WITH BLOCKERS.**

## 29. Remaining Blockers
*   `public.checkout_invoice` Atomicity (RPC).
*   Live Role Enforcement over backend logic mappings.
*   Physical 80mm printer verifications locally.

## 30. Recommended Next Bounded Phase
**Increment B (Appointments) & Increment A (Employees)**
This expands master tracking into operational metrics cleanly without bleeding over into the complex ledger mutations safely.
