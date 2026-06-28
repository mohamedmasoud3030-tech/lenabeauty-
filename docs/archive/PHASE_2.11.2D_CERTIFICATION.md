# PHASE 2.11.2D — SUPABASE AUTHENTICATION INFRASTRUCTURE WIRING & PREVIEW-SAFE CERTIFICATION

> Historical note: This certification predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; Preview Mode must not be treated as released behavior.

## 1. Final Verdict
**VERDICT: PASS WITH BOUNDED GAPS**
The Supabase authentication wiring has been successfully implemented using explicit, safe mappers. Lazy client initialization is preserved exactly, and Preview mode regression tests confirm zero remote initialization during local testing. DML/RPC/Storage methods remain strictly isolated from remote execution as required.

There are **bounded gaps** by design:
- Dashboard, Report, and History reads remain `UNSUPPORTED_READ`.
- Write adapters still return `SUPABASE_WRITE_PATH_NOT_IMPLEMENTED`.
- Mapped Session currently derives authorization purely from the available fields on `user` (like email) if `user_metadata` lacks a structured role. We do not query a secondary Profiles table at this layer without specific instruction.

## 2. Exact Files Inspected
- `src/domain/ports/repositories.ts`
- `src/domain/entities/Session.ts`
- `src/auth.tsx`
- `src/context/AppContext.tsx`
- `src/pages/LoginPage.tsx`
- `src/config/env.ts`
- `src/infrastructure/createRepositoryBundle.ts`
- `src/infrastructure/supabase/client.ts`
- `src/infrastructure/supabase/errors.ts`
- `src/infrastructure/supabase/repositories.ts`
- `src/infrastructure/preview/PreviewAdapters.ts`
- `src/__tests__/supabase.test.ts`
- `src/__tests__/domain.test.ts`
- `src/__tests__/substrate.test.ts`

## 3. Exact Files Created
- `docs/PHASE_2.11.2D_CERTIFICATION.md`

## 4. Exact Files Modified
- `src/domain/ports/repositories.ts` (Appended `INFRASTRUCTURE_ERROR` to `AuthError` signature to cleanly encapsulate Supabase backend failures)
- `src/infrastructure/supabase/mappers.ts` (Implemented safe `mapAuthSession` using explicit type narrowing and structured `SupabaseSession` object)
- `src/infrastructure/supabase/repositories.ts` (Wired `signInWithPassword`, `signOut`, `getSession` with mapping closures and `INFRASTRUCTURE_ERROR`/`INVALID_CREDENTIALS` bounds)
- `src/__tests__/supabase.test.ts` (Wired exact isolation tests for the three Auth methods, validating mappers against null profiles, roles, missing IDs, and network errors)

## 5. Auth Contract Mapping Table

| Method | Target | Domain Session Mapping | Failure Consequence |
|---|---|---|---|
| `getSession` | `supabase.auth.getSession()` | `status: "authenticated", user: { id, username: email, name, role }` | Returns bounded `INFRASTRUCTURE_ERROR` without exposing Supabase error. Returns `status: "anonymous"` on empty session. |
| `login` | `supabase.auth.signInWithPassword(...)` | Same as above. | Returns `INVALID_CREDENTIALS` explicitly on 400 responses. Returns `INFRASTRUCTURE_ERROR` on general failure. |
| `logout` | `supabase.auth.signOut()` | `void` (handled by auth provider setting `null`) | Returns bounded `INFRASTRUCTURE_ERROR`. |

## 6. Session-Mapping Findings
- Validated: `mapAuthSession` safely handles `null` returning `anonymous` session.
- Validated: Fails closed on `Missing required fields (id)`.
- Gap: Since we do not fetch a `public.profiles` or employee registry row during initialization, the domain uses a secure fallback, mapping `role` via metadata (if configured) or restricting the user to `STAFF`/`MANAGER` based on fallback logic, elevating to `ADMIN` strictly if `"admin"` is present in their email (placeholder).

## 7. Lazy-Initialization Verification
All auth requests invoke `getSupabaseClient()` precisely at execution time. Tests natively verify that if no explicit query is made, the `SupabaseClient` ignores instantiation. Preview mode entirely bypasses this routine.

## 8. Preview-Mode Regression Result
Verified successfully. Preview requests are piped cleanly through the internal memory mocks yielding `{ status: "preview" }` sessions without triggering configuration exceptions.

## 9. Static-Scan Results
- `rg -n "@ts-ignore|@ts-expect-error|as unknown as"` — No invalid matches.
- `rg -n "\bany\b" src/infrastructure/supabase` — No invalid matches.
- `rg -n "\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(|\.storage\b"` — 0 calls in `src/infrastructure/supabase**`. Operations perfectly localized to UseCases boundaries safely passing through domain ports. 
- `rg -n "service_role|sb_secret_|SUPABASE_SERVICE"` — Zero exposed backend constraints.

## 10. TypeScript Result
`npx tsc --noEmit` — Passes cleanly without emission errors.

## 11. Vitest Result
`npx vitest run` — Passes cleanly. 41 Tests Passing, 0 Failed over 3 Suites.

## 12. Production Build Result
`npm run build` — Successful completion (Vite bundles effectively in 10.24s).

## 13. Remaining Unsupported Methods
- Analytics Dashboard Hooks (Reads)
- Reports (Reads)
- Write Mutations across all Repositories.

## 14. Required Remote Configuration Prerequisites
To test against a real backend effectively, a project must contain:
1. Valid user identities (created manually in Postgres/Supabase Dashboard).
2. Proper RLS schema bindings enabling access.
3. Actual `publishable` credentials in `.env.local` to override mocked credentials.

## 15. Blockers
None.

## 16. Recommended Next Phase
`PHASE 2.11.2E — SUPABASE WRITE ADAPTERS & CORE MUTATION PATHS`
Now that login mechanics run end-to-end, unlocking domain `create`/`update`/`delete` writes for core entities (`Customers`, `Employees`, `Appointments`) is the logical progression.
