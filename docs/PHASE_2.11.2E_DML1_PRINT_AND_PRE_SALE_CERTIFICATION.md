# Phase 2.11.2E: DML Increment 1 & Pre-Sale Certification

## 1. DML Increment Results
The first DML increment is complete, focusing exclusively on the `Customer` and `Service` adapters:
*   **Customer DML:** Implemented `create`, `update`, and `delete` within `SupabaseCustomerAdapter`. Mappings have been established from `Partial<Customer>` properties to standard database columns (`loyaltyPoints` -> `loyalty_points`, etc.).
*   **Service DML:** Implemented `create`, `update`, and `delete` within `SupabaseServiceAdapter`.
*   **Tenant Mapping Strategy:** `center_id` is intentionally omitted from client-side inserts. This enforces zero-trust architecture. If the initial Postgres schema draft requires this field via `NOT NULL` with no `DEFAULT` or `BEFORE INSERT` trigger, an infrastructure error will be correctly caught and thrown to the UI. The schema should be verified separately to implement the required `app_private.get_current_user_center_id()` default.
*   **Safety Confirmed:** `previewModeEnabled` remains safely checked upstairs at the orchestrator levels, meaning preview actions never attempt to reach these actual mutations. Unsupported adapters (`Employee`, `Product`, etc.) still structurally fail closed with `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`.
*   **Verification:** `src/__tests__/supabase.test.ts` was expanded to verify DML queries directly via mocking the `supabase-js` internals. Output verified clean (`45 passed`).

## 2. Print Workflow Certification
The physical printing capabilities have been audited and hardened for localized thermal usage:
*   **Print Invocation:** Print payloads are now correctly loaded before firing `window.print()` using a 500ms delay to accommodate rendering. 
*   **Layout Isolation:** Applied `print:hidden` comprehensively across layout primitives: the main Sidebar, Header, Background ambient decorations, and Footer are strictly stripped from the printed canvas in `src/ui/layout/Layout.tsx`.
*   **Reprinting:** Successfully retrofitted `CustomersPage.tsx` with a hidden print-block and a new inline "Print" action inside the historical invoice logs. Users can now easily reprint past records. 
*   **Arabic RTL:** The print block enforces an RTL direction dynamically (`dir={i18n.language === "ar" ? "rtl" : "ltr"}`).
*   **Thermal Sizing:** The viewport specifically declares `w-[80mm]` allowing thermal POS printers to interpret it seamlessly without overflowing standard A4 margins.

## 3. Pre-Sale Audit Notes
A conclusive sweep across the UI/Usability conditions returns the following observations:
*   **Confirmations:** A strict `grep` for native block dialogs verifies NO active calls to `alert(` or `confirm(`. The application comprehensively uses the rich contextual `useConfirm()` custom hook. 
*   **Responsive Overflows:** Dense data visualizations (e.g., the large tables in `CustomersPage`) are nested deeply within standard `overflow-x-auto scrollbar-hide` constraints to prevent breaking horizontal layouts on mobile devices.
*   **RTL Design Completeness:** The layout leverages universal Tailwind `end-` / `start-` attributes, correctly preserving the visual tree when mirrored to Arabic. 
*   **Error / Empty States:** Null states uniformly implement transparent `Search`, `Receipt`, and `Calendar` lucide icons with accompanying "No Items Found" translated prompts.

## 4. Final Sale Readiness Verdict
**SUPERSEDED - NOT A v1.0 SALES GATE**

**Justification:**
This historical note predates the v1.0 source-of-truth model. Preview Mode is not a valid setup, fallback, demo, sales, or release-verification path. v1.0 sales readiness requires real Supabase auth, real CRUD persistence, and browser QA against the configured single-center Supabase PWA.

## 5. Recommended Next Phase
**PHASE 2.11.2F — SUPABASE DML INCREMENT 2 & RPC CHECKOUT**
We must prepare to implement the atomic `public.checkout_invoice` DML and adapter methods for the remaining primary tables (`appointments`, `products`, `invoices`, `inventory_movements`, etc.) to finally allow an end-to-end cloud persistence cycle.
