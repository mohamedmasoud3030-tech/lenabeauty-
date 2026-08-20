# REMEDIATION_PLAN — LenaBeauty

**Date:** 2026-08-20
**Branch:** `arena/01a01c90-lenabeauty` (HEAD `db736c3`; PR #39 open)
**Source documents read & verified:** `docs/database-contract/00_BASELINE.md` … `04_ROOT_CAUSE_REMEDIATION_PLAN.md` (the numbered set closest to the requested `01_PROJECT_DISCOVERY.md`–`06_TEST_RELIABILITY_AUDIT.md`, which do not exist verbatim), `PROJECT_DEFECTS.md` (DEF-001…DEF-029), `docs/SECURITY_HARDENING_REPORT_2026-08-10.md`, `docs/DB_AUDIT_REPORT.md`, `FULL_PROJECT_AUDIT.md`, `FINAL_INDEPENDENT_REVIEW.md`, `FULL_UX_REVIEW.md`.

**Method:** every high-impact finding below was re-verified against the current tree (not trusted from prose). Evidence column shows the command/artifact that confirms it.

---

## 1. Verified baseline (this session, re-run)

| Check | Result |
|---|---|
| `npm test` | **124 files / 853 tests — PASS** |
| `npm run typecheck` | PASS |
| `npm run lint` (source-policy) | PASS (268 files) |
| `npm run build` | PASS (61 precache entries) |
| `npm run audit:gate` | **PASS** (0 high/medium findings; 4 info) |
| `npm run ci:migrations` | PASS (40 canonical, 39 automated replayed) |
| `npm run ci:rpc-check` / `db:types:check` | PASS |
| `audit:replay` fingerprint | identical on repeat (idempotent) |
| SonarCloud on PR #39 | **Quality Gate PASS** (after 3 remediation rounds) |

---

## 2. Consolidated findings (duplicates merged, risk-ordered)

Legend: ✅ VERIFIED COMPLETE · 🟡 IMPLEMENTED BUT NOT VERIFIED (hosted/browser pending) · 🛑 BLOCKED · ⬜ NOT STARTED

### 2.1 Critical — security / authorization / money

| # | Finding (merged) | Evidence in tree | Status |
|---|---|---|---|
| C-1 | Sensitive admin/financial RPCs were membership-only (DEF-001) | `20260817000001_authorization_boundary_repair.sql`; ADMIN wrappers + revoked impl grants; audit gate ACL inventory | 🟡 local PASS, hosted BLOCKED |
| C-2 | Dashboard exposed financial/salary summaries to staff (DEF-002) | `get_dashboard_*_v1` ADMIN-governed RPCs; `DashboardPage` restricted tiles | 🟡 hosted BLOCKED |
| C-3 | Revenue/P&L counted VAT+prepaid as earned (DEF-003) | `20260817000002_financial_reporting_repair.sql`; `max(total−tax−prepaid+redeemed,0)` in mappers | 🟡 hosted BLOCKED |
| C-4 | Payroll create/delete could leave partial state (DEF-004) | `20260817000003_payroll_transaction_repair.sql`; transactional `create/delete_payroll_run_v1` | 🟡 hosted BLOCKED |
| C-5 | Commission stored but never calculated (DEF-005) | UI no longer presents stored fields as earnings; fixed-salary product only | ✅ contained (owner policy remains for design) |
| C-6 | Inherited grants left dormant public RPCs executable (security report) | `20260810000006_security_grant_repair.sql`; zero anon/authenticated grants on `public_*_v1` | ✅ verified (ACL inventory) |
| C-7 | Cross-tenant storage access (security report) | `storage_path_center_id` + center-member storage policies | ✅ verified |
| C-8 | Mutable routine search_paths (security report) | all plpgsql pinned to `pg_catalog, public, app_private` | ✅ verified (replay fingerprint) |
| C-9 | **Leaked Password Protection disabled (Supabase Advisor)** | guarded SQL cannot run on hosted project | 🛑 owner action (Supabase dashboard) |

### 2.2 High — data / auth / release safety

| # | Finding | Evidence | Status |
|---|---|---|---|
| H-1 | CI could auto-change Demo; narrow gates (DEF-010) | hardened workflow prepared; live job gated to `workflow_dispatch` + secrets | 🟡 workflow-write permission BLOCKED (owner/App) |
| H-2 | Explicit Production could inherit Demo config (DEF-011) | `useDemoFallbacks = isProdBuild && env==="staging"`; production fails closed | ✅ verified |
| H-3 | Dual role sources could disagree (DEF-022) | membership role = UI source; revalidated on auth events | 🟡 hosted BLOCKED |
| H-4 | No-show “charged” wording without payment (DEF-009) | UI says recorded/manual fee only | ✅ verified |
| H-5 | Backup/Restore misleading (DEF-007) | operational JSON export only; restore removed | ✅ verified |
| H-6 | Hard-delete lifecycle inconsistent (DEF-008) | destructive UI contained; activation flags for employees/services/products | ✅ contained; owner retention policy remains |
| H-7 | PWA update/precache could disrupt sessions or retain imagery (DEF-027) | `registerType:'prompt'`; chart excluded from precache; images network-only | ✅ verified |
| H-8 | PWA shortcuts mismatch HashRouter (DEF-012) | `start_url:'/#/dashboard'` | ✅ verified |
| H-9 | User Management didn't manage Auth users (DEF-006) | misleading tab removed | ✅ verified |
| H-10 | No repository proof of telemetry/DR (DEF-021) | — | 🛑 owner/external (provider plan + restore drill) |
| H-11 | Green unit tests don't prove browser/hosted journeys (DEF-029) | — | 🛑 external (no browser/hosted reachable) |

### 2.3 Medium — UX / correctness / privacy

| # | Finding | Evidence | Status |
|---|---|---|---|
| M-1 | Load failures looked empty/never finished (DEF-013) | `ScreenState` error+Retry everywhere | ✅ verified |
| M-2 | Branding import / private logo paths (DEF-014) | signed-URL resolution at repository boundary | ✅ verified |
| M-3 | Raw filter grammar / stale search / unbounded lists (DEF-015) | typed `.ilike()`; seq guards; report “Load more”; **server pagination for customers/products/expenses OPEN** | 🟡 partial — pagination ⬜ |
| M-4 | Page-local dialogs lacked a11y foundation (DEF-016) | all moved to shared `Modal`; static guard | ✅ verified |
| M-5 | Manual notifications claimed delivery (DEF-017) | wa.me pending/unverified; SMS unsupported | ✅ verified |
| M-6 | Attendance duplicates / reversed times (DEF-018) | preflight + unique index + time-order checks | 🟡 hosted BLOCKED |
| M-7 | Tauri capability claims exceeded implementation (DEF-019) | truthful flags; CSP enabled | ✅ contained; cargo ⬛ external |
| M-8 | Workforce pages hardcoded Arabic / undiscoverable (DEF-023) | i18n + nav registry coverage | ✅ verified |
| M-9 | Auth session didn't react to token changes (DEF-024) | onAuthStateChange + membership revalidation | ✅ verified |
| M-10 | Logo upload lacked MIME/size/quota (DEF-025) | repo validation + bucket metadata + ADMIN policy | 🟡 hosted BLOCKED |
| M-11 | Non-ledger CRUD lacks immutable audit trail (DEF-026) | **addressed this session**: `admin_audit_events` (migration 00002) | 🟡 scope expanded; retention policy still owner |
| M-12 | Preflight crashed on network rejection (DEF-020) | per-request catch + redaction | ✅ verified |

### 2.4 Low — maintainability

| # | Finding | Evidence | Status |
|---|---|---|---|
| L-1 | `lint` was duplicate typecheck; lockfile ambiguity (DEF-028) | npm pinned; policy lint; pnpm-lock preserved | ✅ verified |
| L-2 | Dependency note | `npm audit` 0; no broad upgrades mixed | ✅ monitored |
| L-3 | Documentation drift | canonical docs + banners | ✅ verified |

---

## 3. Milestone order (risk first)

| Milestone | Scope | Owner gate? | Status |
|---|---|---|---|
| **M-0** | Consolidation + verification (this document) | no | ✅ done |
| **M-1** | Hosted Demo acceptance: apply migrations `20260817000001…18000001` + this session's `20260820000001…00003`; run SQL acceptance + `preflight:supabase` | **YES — GitHub secrets + workflow run** | 🛑 BLOCKED |
| **M-2** | Enable Supabase Leaked Password Protection | **YES — Supabase dashboard** | 🛑 BLOCKED |
| **M-3** | Land hardened CI workflow (manual-only live gate) | **YES — repo admin (workflows permission)** | 🛑 BLOCKED |
| **M-4** | Server pagination contract for customers/products/expenses (DEF-015 remainder) | no (in-repo, reversible) | ⬜ NOT STARTED — proposed, medium-large, needs scope confirmation |
| **M-5** | Owner policy: commission (C-5), retention/anonymization (H-6/M-11), DR plan (H-10) | **YES — commercial/legal decisions** | 🛑 BLOCKED |
| **M-6** | Browser + device acceptance (DEF-029) | **YES — hosted creds + browser env** | 🛑 BLOCKED |

---

## 4. Honest statement

Every **safe, reversible, in-repo** remediation identified by the audit series is already implemented and locally verified (853 tests; audit gate PASS; SonarCloud PASS). The remaining items are genuinely gated on **owner/external** actions (hosted credentials, Supabase dashboard, GitHub App permissions, commercial/legal policy, or a browser/hosted environment) — they cannot be honestly completed from this sandbox. No claim of hosted or browser verification is made anywhere in this plan.
