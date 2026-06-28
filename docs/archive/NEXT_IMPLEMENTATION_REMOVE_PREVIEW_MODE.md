# Next Implementation PR: Remove Preview Mode From Source

This document is the source-of-truth handoff for the next implementation PR. This branch is documentation-only; do not apply the source changes listed here until the follow-up implementation branch.

## Locked Product Decisions

- Preview Mode is removed. `VITE_DATA_BACKEND=preview` is not a valid mode in the released product.
- Missing or invalid configuration must produce a hard blocking `EnvironmentConfigurationError` screen.
- v1.0 is a single-customer, single-center Supabase PWA with real auth, real CRUD, and no fake mode.
- v1.1 adds checkout, print, financial reports, settings mutations, and expense edit UI.
- v2.0 is a Windows Desktop EXE via Tauri v2 + SQLite, offline-first, with no Supabase dependency.
- `Expense.update` already exists in the domain port and Supabase adapter contract. The edit UI is v1.1 work.
- `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` is the canonical schema file for v1.0 bootstrapping. All schema setup references must point to that exact file name.

## Required Search Before Editing Source

```bash
grep -rn "preview\|Preview\|PREVIEW\|demo mode\|fake\|Expense\.update\|multi-customer\|SaaS\|SUPABASE_BASE_SCHEMA_BOOTSTRAP\|VITE_DATA_BACKEND" docs/ src/ .env.example 2>/dev/null
```

## Required Source Changes

1. Delete the entire `src/infrastructure/preview/` directory.
2. In `src/config/env.ts`, remove `"preview"` from `BackendMode`, remove `PREVIEW_CENTER_ID`, remove the `backend === "preview"` parse branch, require `VITE_DATA_BACKEND === "supabase"`, and remove `previewModeEnabled` from the returned config.
3. In `src/infrastructure/createRepositoryBundle.ts`, remove all `Preview*Adapter` imports, remove the preview fallback bundle, and throw `InfrastructureError` if `config.backend !== "supabase"`.
4. In `src/domain/entities/Session.ts`, remove `UserRole.PREVIEW`, `PreviewSession`, the preview session union variant, and the preview bypass inside `can()`.
5. In `src/domain/ports/repositories.ts`, remove `PREVIEW_READ_ONLY` from `AuthError.code` and `DomainError.code`.
6. In `src/app/composition/useCases.ts`, remove `checkPreviewWrite<T>()` and all `checkPreviewWrite(...) ||` call sites.
7. In `src/context/AppContext.tsx`, remove the `res.data.status === "preview"` branch.
8. In `src/route-guards.tsx`, remove preview status checks, the amber preview banner, preview spacing conditionals, and the preview admin-bypass comment/logic.
9. In `src/pages/LoginPage.tsx`, remove `handlePreview()` and the conditional "Enter Preview Mode" button.
10. In `src/shared/components/Primitives.tsx`, remove `PreviewReadOnlyBanner`.
11. In `src/application/errors/ErrorMapper.ts`, remove the `PREVIEW_READ_ONLY` mapping.
12. In `src/i18n.ts`, remove Preview Mode translation keys and their Arabic equivalents.

## Acceptance Criteria

- `src/infrastructure/preview/` does not exist.
- `UserRole.PREVIEW` does not exist anywhere in `src/`.
- `VITE_DATA_BACKEND=preview` causes `EnvironmentConfigurationError` at startup.
- Missing `.env` causes `EnvironmentConfigurationError`, not a preview fallback.
- The "Enter Preview Mode" button is gone from `LoginPage`.
- The amber preview banner is gone from all route guards.
- `tsc --noEmit` passes with 0 errors.
- `vitest run` passes, with preview-specific test cases updated to test the error path instead.
- `npm run build` produces a clean PWA build.

## Do Not Include

- Do not apply remote Supabase schema changes.
- Do not implement `Invoice.checkout` RPC.
- Do not implement expense edit UI.
- Do not implement the Desktop EXE.
- Do not modify production environment variables.
