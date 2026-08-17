# FINAL_INDEPENDENT_REVIEW — LenaBeauty

**Review date:** 2026-08-17
**Branch:** `arena/01a00f9e-lenabeauty`
**Method:** fresh repository/runtime/database/CI/deployment review; previous status labels were treated as untrusted until reproduced.

## 1. Final verdict

# **FAIL — NO-GO for Production or real customer data**

The current codebase is a coherent staff-operated salon management product and the local application contract is substantially stronger after this review. It is **not production-safe yet** because the hosted Supabase state and real role isolation are unverified, five security/integrity migrations are not applied, the tracked `main` workflow can still run a credentialed Demo migration automatically after a relevant merge, disaster recovery/monitoring are not operationally proven, and revocation of a credential exposed outside the repository cannot be verified from this environment.

A **controlled Demo/Staging acceptance** is the correct next milestone. Production/public launch is not recommended.

## 2. Decisive product verdicts

| Area | Verdict | Reason |
|---|---|---|
| Product/domain correctness | **CONDITIONAL PASS** | The shipped product is a staff-only salon operations system: customer → appointment → service/product/package → operator-confirmed tender → receipt, plus inventory and ADMIN workforce/reporting. Live gateway charging, automated messaging, public booking and customer portal are not shipped and are now presented as unavailable/manual rather than working features. |
| User experience and completeness | **CONDITIONAL PASS** | Primary daily journeys are understandable in Arabic/English with RTL, mobile navigation, retry/empty states and shared accessible dialogs. Real browser visual/keyboard/mobile-device acceptance was unavailable. Account provisioning is still an external operator task, so this is suitable only for a controlled staff pilot. |
| Security/data/reliability | **FAIL for hosted launch** | Local migration replay, role wrappers, idempotent checkout and integrity tests pass. Hosted RLS/grants, cross-center isolation, legacy data preflight and migration application remain unobserved. Backup/restore and incident recovery are not production-grade. |
| PWA/domain/deployment | **FAIL for launch; local PWA contract PASS** | Local manifest, SW, update prompt and cache policy pass. The current public login is reachable, but the deployed commit/version and security headers could not be established. GitHub’s configured homepage points to a dead Vercel URL. |

## 3. What the product actually is

LenaBeauty is currently a **closed, authenticated salon/beauty-center operations PWA** for:

- reception/operational staff: Dashboard, customers, appointments, POS, services, products, packages, gift cards and inventory;
- ADMIN: employees, attendance, advances, payroll, staff analytics, expenses, reports and settings;
- manual external tender recording: cash/card/transfer indicate that the operator collected payment outside the application;
- Arabic and English use, including RTL/LTR switching;
- online Supabase-backed business data.

It is **not** currently:

- a self-service signup/account-administration product;
- a live online payment gateway;
- an SMS/WhatsApp delivery platform;
- a public booking or customer-portal release;
- an offline transaction database;
- a production backup/restore system;
- a finished native SQLite desktop product.

Those boundaries are now mostly truthful in the UI. They must remain part of release messaging.

## 4. Primary user outcome

For an already-provisioned staff member, the primary journey is coherent:

1. Sign in.
2. Select/search or create a customer.
3. Create and manage an appointment.
4. Add a service/product/package in POS.
5. Select the employee and manually collected tender method.
6. Record the completed sale exactly once.
7. View/print a receipt and refreshed inventory.

Component and contract tests cover normal, empty, invalid, retry, out-of-order search, repeated checkout, terminal appointment, role and initialization paths. A real hosted/browser observation of the complete journey is still required before real users/data.

## 5. Fresh review of previous Critical/High claims

| Previous area | Fresh evidence and final status |
|---|---|
| Sensitive RPC authorization | Migration `20260817000001` contains ADMIN-checking wrappers, fixed search paths and private implementation ACLs. Replay/tests pass. **Hosted behavior remains unverified and is a release blocker.** |
| Dashboard finance/compensation visibility | Dashboard uses role-governed RPCs; STAFF financial capability is not inferred from table reads. Local mapping/DDL tests pass. **Hosted STAFF/ADMIN acceptance remains required.** |
| VAT/prepaid revenue classification | Reporting uses net earned revenue: tax and prepaid sale liability are excluded and ledger redemption is recognized. Unit/SQL contracts pass. **Hosted reconciliation against real invoices remains required.** |
| Payroll atomicity | The RPC creates run/lines and changes advance state in one transaction. This review found a missed bypass: direct PostgREST writes to payroll tables could avoid reconciliation. Direct `INSERT/UPDATE/DELETE` grants are now revoked locally and regression-protected. **Hosted migration is pending.** |
| Commission calculation | Previous “owner blocked” status left misleading commission inputs/statistics visible. This review removed those claims and mutations. The presented product is now fixed-salary minus approved advances; no formula was invented. **Contained for the current product.** |
| User Management | The false employee/password account UI is absent. Real Auth provisioning/invite/reset is still not implemented. **Acceptable only for a controlled pilot with operator provisioning; incomplete for scaled Production.** |
| Backup/Restore | UI describes an operational JSON export and does not claim SQL/atomic restore. **Production DR remains absent and blocks real-data launch.** |
| Destructive lifecycle | This review found an Appointment hard-delete button and relation/RPC deletion paths despite prior “contained” claims. Appointment deletion was removed; cancellation remains. Pending migrations revoke browser DELETE on retained operational records, make the legacy employee delete RPC deactivate, and block direct payroll writes. **Local pass; hosted pending; final retention/anonymization policy still external.** |
| No-show charge wording | UI records a manual fee marker and does not claim that money was collected. **Contained locally.** |
| CI/live migration safety | Previous “implemented” status was not true for the PR: the hardened workflow exists locally but GitHub App permissions prevented committing it. The tracked `main` workflow can run the live Demo job when credentials exist after a relevant main push. **Release blocker; PR must stay Draft/unmerged.** |
| Production environment fallback | Explicit `VITE_ENVIRONMENT=production` fails closed without explicit URL/key/center; optimized trial builds default to Demo/Staging. Tests pass. **No public Production configuration was verified.** |
| Auth role/session lifecycle | Membership role is the UI source of truth. This review found an overlapping-event race where a delayed older membership response could restore an authenticated shell after sign-out. Generation-ordered reconciliation and a regression test now prevent it. |
| PWA session/privacy | Prompted updates and chart-precache exclusion were confirmed. This review found a broad CacheFirst image rule that could retain business/signed images on shared devices. It was removed; business/customer images are network-only. |
| Monitoring/DR evidence | No operational telemetry provider, alert path, restore drill, RPO or RTO is proven. **Release blocker for real customer data.** |
| Highest-tier QA evidence | jsdom/PGlite/static gates are not browser/hosted E2E proof. **Still external-blocked.** |

## 6. Safe corrections completed in this independent review

### 6.1 Prevented stale authentication after sign-out

- **Root cause:** overlapping `init()` calls had no ordering token.
- **Correction:** only the newest auth/membership reconciliation may update state; unmount invalidates pending work.
- **Regression:** delayed `TOKEN_REFRESHED` membership response cannot overwrite a newer `SIGNED_OUT` state.

### 6.2 Closed a repeated POS sale window

- **Root cause:** keyboard listener captured stale React `checkingOut=false`; after the checkout RPC returned but receipt loading was pending, Ctrl+Enter could start a new request ID.
- **Correction:** synchronous `checkoutInFlightRef` guards the entire checkout/receipt/refresh operation.
- **Regression:** repeated Ctrl+Enter while receipt loading produces exactly one checkout call.

### 6.3 Made tender/payment scope truthful

- POS now says **Record completed sale**, explains that cash/card/transfer confirm manual collection outside the app, and does not claim that selecting Card charges a card.
- Gateway Settings always presents **Not connected** and saves disabled/sandbox metadata until a real server-side session/webhook exists.
- Success/failure text refers to recording a sale and payment method, not processing an external charge.

### 6.4 Removed unsupported commission claims

- Removed commission input, month/team commission values, “top performer” based on zero/reference commission and Dashboard commission row.
- Employee saves preserve legacy fields without mutating them.
- Fixed-salary payroll remains explicit and tested.

### 6.5 Strengthened deletion and payroll boundaries

- Removed direct Appointment hard delete; cancellation remains the correct lifecycle action.
- Pending authorization migration revokes browser DELETE from retained operational entities.
- Wrapper-managed tables reject direct browser writes.
- Legacy employee delete-named RPC now deactivates instead of cascading attendance/payroll history.
- Payroll runs/lines reject direct PostgREST writes; only transactional RPCs mutate them.
- Rollback runbooks and focused tests were updated.

### 6.6 Removed unsafe private-image PWA caching

- Deleted the extension-wide `images-cache` CacheFirst rule.
- Only explicitly public Google font assets retain runtime caching.
- Supabase/customer/business images are not stored by Workbox runtime caching.

### 6.7 Corrected smaller trust/PWA issues

- Dashboard no longer claims the center is “performing optimally” without evidence and no longer falls back to the username `admin`.
- Removed duplicate source manifest link and duplicate iOS status-bar metadata; the built app now contains exactly one of each.

## 7. Actual checks executed

| Check | Fresh observed result |
|---|---|
| `npm ci` | PASS; 516 packages; audit reported 0 vulnerabilities |
| `npm test -- --reporter=dot` | **PASS: 105 files / 570 tests** |
| Focused auth/POS/PWA/lifecycle tests | PASS |
| Focused authorization/payroll/replay tests | PASS: 4 files / 21 tests before final wider run |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; TypeScript + source policy across **227 files** |
| `npm run build` | PASS; **2,833 modules** |
| PWA generation | PASS; **53 precache entries / 1,557.68 KiB**; `sw.js` generated |
| `npm run audit:gate` | PASS after expected regeneration of stale generated artifacts |
| Canonical replay | **36 migrations: 35 automated + 1 manual bootstrap; 0 replay failures; repeat fingerprint identical** |
| Replay fingerprint | `1616b31569eee5a057a42dea3d06a2f38d65cf435ba1e6a3d471d0dd9e7a5aff` |
| Database inventory | 34 tables, 46 policies, 59 functions; 4 findings, all `info` |
| `npm run db:types:check` | PASS |
| `npm run ci:migrations` | PASS; 36 canonical migrations |
| `npm run ci:rpc-check` | PASS; 29 frontend RPC references defined |
| `npm run desktop:test` | PASS: 6 files / 13 tests |
| `npm audit --audit-level=low` | PASS; 0 vulnerabilities |
| `npm ls --all` | PASS; no dependency-tree problems |
| Repository secret-pattern scan | PASS for GitHub/payment/Supabase secret-token patterns; tracked Supabase publishable/anon key is public by design |
| `git diff --check` | PASS |
| Local production preview | PASS: `/`, `/manifest.webmanifest`, `/sw.js` returned HTTP 200 |
| Built PWA contract | PASS: hash start/shortcut routes, update prompt chunk, chart excluded, no image runtime cache, one manifest link, one iOS status meta |

Expected negative-path test logs were observed for missing configuration and rejected malformed branding imports. Their processes exited successfully and assertions passed.

## 8. Runtime/deployment evidence

- `https://lenabeauty.vercel.app/#/login` was fetched successfully and exposes the Arabic staff login with English switch.
- Repository homepage metadata points to `https://spa-five-alpha.vercel.app`, which currently returns Vercel `404 DEPLOYMENT_NOT_FOUND`.
- Latest visible GitHub Production deployment record is from 2026-08-13 at SHA `5376bfca...`, not this branch.
- Latest observed `main` workflow run `32028433292` passed static gates; its live Demo migration/security job was **skipped**.
- PR #34 remains Draft/clean; these independent-review corrections are prepared as a separate follow-up commit while workflow hardening remains intentionally excluded.
- Direct HTTPS/header diagnostics from the sandbox failed with `SSL_ERROR_SYSCALL`; therefore deployed CSP/HSTS/cache headers were not observed.

## 9. Unresolved release blockers

1. **Credential exposure outside the repository:** a GitHub PAT was placed in chat. Repository scans are clean, but revocation cannot be verified. It must be revoked before any release action.
2. **Unsafe merge automation:** workflow hardening cannot be pushed by the connected GitHub App. The current main workflow may run a credentialed Demo migration after merge. PR #34 must remain Draft/unmerged until a maintainer lands the prepared workflow change.
3. **Hosted state unknown:** migrations `20260817000001..20260817000005` are local only. Hosted ADMIN/STAFF denial, compensation redaction, cross-center isolation, transaction behavior and Storage policies are unverified.
4. **Legacy data preflight unknown:** attendance duplicates/invalid times and current Storage bucket metadata must be checked before migration; the migration intentionally aborts instead of rewriting data.
5. **No production DR/monitoring proof:** operational export is not backup/restore; no restore drill, alerting, RPO or RTO exists.
6. **No real browser/device acceptance:** visual layout, contrast, screen readers, physical keyboard, PWA install/update/logout cache, iOS/Android behavior and printing hardware were not observed.
7. **Account operations incomplete:** staff Auth provisioning/invite/reset requires an external trusted operator flow.
8. **Production deployment identity unknown:** current code is not proven deployed, and repository homepage metadata is stale.

## 10. Accepted/unavoidable limitations for a controlled pilot

These are acceptable only when disclosed and operationally controlled:

- staff-only login; no self-registration;
- public booking/customer portal disabled;
- manual WhatsApp handoff and no SMS provider;
- manual external payment collection only;
- fixed-salary payroll only; no commission engine;
- online-only business data; PWA provides shell/install/update behavior, not offline transactions;
- Tauri remains a truthful JSON snapshot prototype, not the delivery target;
- broad server pagination remains incomplete, so large real datasets require a later volume milestone.

## 11. Unverified areas

- real ADMIN, STAFF and MANAGER accounts;
- hosted RLS/grants and clean PostgREST behavior;
- cross-center attempts with two real memberships;
- live checkout and retry against hosted PostgreSQL;
- hosted Storage upload/read policy;
- browser console/network logs;
- PWA installed-device update and logout cache behavior;
- Vercel environment variables and deployed SHA;
- Cargo/native compile, package, signing and updater;
- printer hardware;
- managed backup/PITR and disposable restore drill;
- revocation of the exposed PAT.

## 12. Exact external actions required

Recommended release-safety sequence:

1. Revoke the exposed GitHub PAT; do not place replacement credentials in chat or source.
2. A maintainer with workflow-write permission lands the prepared workflow hardening and focused test so live migration runs only on explicit `workflow_dispatch`.
3. Keep PR #34 Draft until step 2 is on `main`.
4. Approve **Demo/Staging only** preflight and migration `20260817000001..20260817000005`; never Production first.
5. Run rollback-safe SQL acceptance with real ADMIN/STAFF accounts and cross-center attempts.
6. Run browser/mobile/PWA/printing acceptance against Demo.
7. Select and configure monitoring plus managed backup; document RPO/RTO and complete a disposable restore drill.
8. Only after all above pass, create a separate Production go/no-go review and correct the public repository homepage/deployment metadata.

## 13. Final launch recommendation

- **Production/public real-data launch:** **NO**.
- **Merge current Draft PR before workflow hardening:** **NO**.
- **Controlled Demo/Staging verification after credential/workflow gate:** **YES, recommended**.
- **Real customer data before hosted role/data/restore acceptance:** **NO**.

The safest next action is one approval-gated Demo milestone, not a Production deployment.
