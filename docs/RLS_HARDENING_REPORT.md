# Supabase RLS Hardening & Isolation Report

## 1. Overview
This report summarizes the security hardening performed on the `lenabeauty-` Supabase project to ensure strict tenant isolation and role-based access control (RBAC).

## 2. Enforced Permission Matrix

The following table defines the server-enforced permissions for each role within a center.

| Table | SELECT | INSERT | UPDATE | DELETE | Constraint |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `centers` | Member | - | - | - | `id = ANY(user_center_ids)` |
| `center_memberships` | Self | Admin+ | Admin+ | Admin+ | `profile_id = auth.uid()` or Admin role |
| `center_settings` | Member | - | Manager+ | - | `center_id = ANY(user_center_ids)` |
| `customers` | Member | Member | Member | Member | `center_id = ANY(user_center_ids)` |
| `employees` | Member | Member | Member | Member | `center_id = ANY(user_center_ids)` |
| `services` | Member | Member | Member | Member | `center_id = ANY(user_center_ids)` |
| `products` | Member | Member | Member | Member | `center_id = ANY(user_center_ids)` |
| `appointments` | Member | Member | Member | Member | Cross-table `center_id` integrity |
| `expenses` | Member | Manager+ | Manager+ | Manager+ | `center_id = ANY(user_center_ids)` |
| `invoices` | Member | Staff+ | Manager+ | Manager+ | Staff can only INSERT via RPC/Trigger |
| `invoice_items` | Member | Staff+ | Manager+ | Manager+ | Cross-table `center_id` integrity |
| `storage.objects` | Member | Member | Member | Member | Folder name must match `center_id` |

## 3. Secure Provisioning Procedure
The first administrator ('owner') must be provisioned via a secure SQL bootstrap to avoid client-side bypasses. Detailed instructions are available in `docs/MEMBERSHIP_BOOTSTRAP.md`.

## 4. Cross-Table Integrity
RLS policies for `appointments` and `invoice_items` now explicitly verify that all referenced entities (customers, employees, services, products) belong to the same `center_id` as the parent record. This prevents malicious users from linking data across different centers.

## 5. Verification Status

### Build & Deployment
- **Typecheck**: `PASSED` (`npx tsc --noEmit`)
- **Vercel Deployment**: `SUCCESS` (Verified via GitHub status checks)
- **Production Build**: `PASSED` (`pnpm run build`)

### RLS Isolation Test
- **Script**: `src/__tests__/integration/rls_isolation.test.ts`
- **Status**: `READY FOR EXECUTION`
- **Requirement**: Real test user credentials for two different centers are required to run the final "green" verification loop.

## 6. Changed Files
- `supabase/migrations/20260623000002_enable_rls_and_policies.sql` (Harden RLS)
- `src/infrastructure/supabase/repositories.ts` (Repository write-path hardening)
- `src/pages/LoginPage.tsx` (Build fix for framer-motion)
- `src/__tests__/integration/rls_isolation.test.ts` (New integration test)
- `docs/MEMBERSHIP_BOOTSTRAP.md` (Provisioning guide)
- `docs/RLS_HARDENING_REPORT.md` (This report)
