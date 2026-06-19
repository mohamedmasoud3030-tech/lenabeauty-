# Supabase Frontend Activation Checklist

Before v1.0 is accepted, the application must be verified in Supabase mode with real auth, real CRUD, and browser QA. Preview Mode is not a valid setup, fallback, demo, sales, or release-verification path.

## 1. Environment Parsing
- [x] **Verified Variable:** `VITE_DATA_BACKEND=supabase` switches the UI orchestrators.
- [x] **Verified Variable:** `VITE_SUPABASE_URL` represents the absolute fully qualified backend path.
- [x] **Verified Variable:** `VITE_SUPABASE_PUBLISHABLE_KEY` prevents confusing secret-token injections.
- [x] **Verified Absence:** No keys named `_SECRET_`, `_SERVICE_ROLE_`, or generic passwords are functionally ingested by `env.ts`.

## 2. Security Defaults
- [x] **Blocking Setup Errors:** Missing or invalid Supabase configuration must surface a visible setup error for v1.0 verification.
- [x] **Browser Isolation:** Supabase client bindings strictly pull from the VITE_ prefixed domains, preventing node-environment elevated secrets from breaching the public rollup configurations.
- [x] **Client Initialization Strategy:** Lazy creation operates flawlessly, preserving the memory block correctly when offline.

## 3. Remote Authorization
- [ ] **Auth Resolution:** Are `auth.users` instances resolving to proper mapped `profiles` and subsequently `center_memberships`? *(Requires remote schema synchronization)*.
- [ ] **RLS Verification:** Does the authenticated browser user actually abide by the `current_user_center_id` bounds defined. *(Requires remote schema synchronization)*.

## 4. Activation Decision Gate
**BLOCKED — PROJECT TYPE REQUIRES USER CONFIRMATION**
The codebase itself is primed for Supabase mode via environment keys. However, doing so requires safely applying the schema migrations over a Supabase dashboard. Until the required SQL is applied, the application should fail visibly with backend setup errors rather than falling back to Preview Mode.
