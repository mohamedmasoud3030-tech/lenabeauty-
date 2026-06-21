# Phase 10A.6 Preview Source Removal Certification

## Scope

This certification records the state after reviewing the latest merge commit and the current v1.0 documentation. It intentionally skips Supabase SQL execution, remote schema changes, checkout RPC implementation, and any Aida-related work.

## Verification Summary

- `VITE_DATA_BACKEND=preview` is rejected by `parseEnv` with `EnvironmentConfigurationError`.
- Missing backend configuration is rejected before repository bundles or use cases are created.
- `BackendMode` is constrained to `supabase`.
- `src/infrastructure/preview/` is absent.
- `UserRole.PREVIEW` is absent from the source role model.
- The repository bundle creates only Supabase adapters and rejects unsupported backend modes.
- Preview workflow tests now assert configuration-error behavior instead of mock workflow creation.

## Remaining Release Evidence Gap

The frontend source is ready for post-preview evidence collection, but live browser QA against a real Supabase staging project remains pending. This document does not certify remote database state, RLS policies, seeded users, checkout RPCs, invoice tables, print flows, financial reports, or settings mutations.

## Recommended Next Phase

Proceed with Phase 10A live non-checkout QA:

1. Run `npm run preflight:supabase` with a staging `.env.local`.
2. Apply only the base non-checkout schema and seed in the Supabase staging project.
3. Execute the live QA runbook for auth, customers, appointments, services, employees, products, expenses, dashboard operational counts, and reports for appointments/inventory.
4. Keep checkout, invoice print, sales reports, financial dashboard metrics, settings mutations, expense edit UI, and desktop EXE work out of scope until live non-checkout QA passes.
