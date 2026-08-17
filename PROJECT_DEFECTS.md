# PROJECT_DEFECTS — LenaBeauty Stabilization Register

**Recovery date:** 2026-08-17  
**Branch:** `arena/01a00f9e-lenabeauty`  
**Baseline commit:** `2d96110`  
**Current release verdict:** **NO-GO for Production** until hosted acceptance and the owner decisions below are closed.

## 1. Evidence rules used in this register

- `IMPLEMENTED`: code/SQL exists, but this alone is not completion.
- `LOCAL PASS`: the original failure is covered by an executable local check and the relevant wider checks pass.
- `CONTAINED`: a misleading or unsafe capability is removed/disabled/described truthfully; the full capability is not implemented.
- `HOSTED BLOCKED`: local contract passes, but the migration or role behavior was not observed on hosted Supabase.
- `OWNER BLOCKED`: the repository cannot safely invent the business/data policy.
- `OPEN`: confirmed defect remains.

A database repair is not called hosted-fixed until it is applied to Demo/Staging and its SQL acceptance is observed. No remote migration, Production operation, destructive cleanup, paid action, or public deployment was performed in this recovery.

## 2. Preserved starting state

The task started from saved baseline commit `2d96110`. Pre-existing documentation/artifact changes were preserved; no `reset`, `clean`, branch switch, or unrelated discard was used.

## 3. Baseline failures and gaps

The repository baseline compiled and its old suite passed, but direct inspection and failure-path execution confirmed the defects below. Important baseline observations:

- old suite: 90 files / 476 tests passed, so a green suite did not cover the authorization, financial, recovery, and messaging failures;
- canonical chain had 31 migrations and replayed locally, while hosted schema/RLS/grants were unverified;
- live Demo SQL job was skipped because credentials were unavailable;
- read-only live preflight reached TLS `ECONNRESET`, so no hosted table/role result was obtained;
- Settings had misleading User Management/Restore/Auto-Backup surfaces;
- sensitive RPCs and Dashboard financial reads trusted membership/UI routing too broadly;
- earned revenue used invoice totals, and payroll used non-transactional browser steps;
- customer search used raw PostgREST grammar and accepted stale responses;
- PWA/Tauri/messaging labels claimed behavior that did not exist;
- Rust `cargo` and a browser executable are not installed in this environment.

## 4. Confirmed defect register

### Critical

### DEF-001 — Sensitive admin/financial RPCs were membership-only

- **Symptom/evidence:** authenticated center members could call sensitive Settings, Accounting, AI, Customer Experience and entitlement RPCs directly even when admin routes were hidden.
- **Severity/scope:** Critical; authorization, cross-role privacy, all center data. Regression areas: grants, RLS, RPC adapters.
- **Root cause:** UI route guards were treated as security boundaries; server functions checked membership but not `ADMIN` role.
- **Smallest safe repair:** migration `20260817000001_authorization_boundary_repair.sql` adds ADMIN wrappers, revokes client execution from implementation functions, tightens policies, and governs employee writes/compensation reads.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. PGlite replay/idempotency, RPC/static contract tests and generated ACL inventory pass. `supabase/tests/20260817000001_authorization_boundary_repair.sql` contains STAFF denial/redaction and ADMIN success acceptance, but it was not executed remotely.

### DEF-002 — Dashboard exposed financial/salary summaries to operational roles

- **Symptom/evidence:** `/dashboard` was available to authenticated staff while revenue, expenses and salary capability was inferred from successful direct reads.
- **Severity/scope:** Critical; Dashboard, invoices, expenses, employee compensation.
- **Root cause:** no server-governed financial capability; query success was used as authorization.
- **Smallest safe repair:** ADMIN-aware Dashboard summary/P&L/revenue RPCs; repository no longer reads sensitive financial/employee tables directly.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. Dashboard mapping/authorization/financial focused suites pass; canonical migration replay passes. Real STAFF/ADMIN behavior needs hosted acceptance after migration approval.

### DEF-003 — Revenue/P&L counted VAT and prepaid liability as earned revenue

- **Symptom/evidence:** `invoice.total_amount` was treated as revenue. A 10.500 sale containing 0.500 VAT was reported as 10.500 earned; prepaid gift/package value was also overstated.
- **Severity/scope:** Critical; Dashboard, Reports, owner financial decisions.
- **Root cause:** cash collection, VAT liability, prepaid liability and earned revenue were conflated.
- **Smallest safe repair:** canonical formula `max(total_amount - tax - prepaid_amount + redeemed_amount, 0)` in migration `20260817000002_financial_reporting_repair.sql` and report mappers.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. VAT/prepaid/redemption unit and SQL contract tests pass; hosted values are not observed.

### DEF-004 — Payroll create/delete could leave partial financial state

- **Symptom/evidence:** browser code inserted run, inserted lines and updated advances separately; later failure could leave a partial run or incorrect advance state.
- **Severity/scope:** Critical; payroll, employee advances, accounting integrity.
- **Root cause:** one business transaction was split across client requests.
- **Smallest safe repair:** ADMIN-only transactional `create_payroll_run_v1` / `delete_payroll_run_v1` in migration `20260817000003_payroll_transaction_repair.sql`; adapter uses only those RPCs.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. Rollback/success/duplicate-month contracts pass locally; direct `INSERT/UPDATE/DELETE` grants on payroll runs/lines are now revoked so PostgREST cannot bypass advance reconciliation. Hosted transaction acceptance was not run.

### DEF-005 — Configured commission is not calculated

- **Symptom/evidence:** `commission_percentage` can be stored and UI has commission reporting fields, but no repository/domain/SQL path calculates earned commission.
- **Severity/scope:** Critical; payroll, P&L, employee compensation.
- **Root cause:** field/UI were added without an approved rule for VAT, discounts, refunds, attribution and month cut-off.
- **Smallest safe repair:** no formula was invented. The employee form, employee statistics and Dashboard commission row no longer present stored zero/reference fields as calculated earnings. Current payroll is explicitly fixed salary less approved advances.
- **Verification/status:** `CONTAINED + LOCAL PASS`. UI regressions prove commission values are neither shown nor mutated. Commission can be designed later only after a commercial policy defines earning event, refunds, VAT/discount basis, attribution and cut-off/timezone; it is not a blocker for the fixed-salary product now presented.

### High

### DEF-006 — Settings “User Management” did not manage Auth users

- **Symptom/evidence:** the form called EmployeeRepository; password/username never changed Supabase Auth and create lacked the required employee name.
- **Severity/scope:** High; login provisioning, employee identity, admin trust.
- **Root cause:** legacy account UI was wired to employee CRUD instead of trusted server-side Auth administration.
- **Smallest safe repair:** remove the misleading tab and password surface; keep employee records at `/employees`; do not fake account management.
- **Verification/status:** `CONTAINED + LOCAL PASS`. Settings tests prove User Management is absent and no password surface is exposed. Full account provisioning remains not implemented.

### DEF-007 — Backup/Restore was partial, misleading and non-transactional

- **Symptom/evidence:** “SQL Backup”, “Auto-Backup” and destructive Restore labels described a 12-dataset JSON export and sequential partial upserts.
- **Severity/scope:** High; disaster recovery and all business data.
- **Root cause:** support export was presented as complete database recovery.
- **Smallest safe repair:** relabel as partial Operational JSON Export; remove Restore/Auto-Backup/SQL claims; preserve legacy adapter only as non-UI code.
- **Verification/status:** `CONTAINED + LOCAL PASS`. Settings regression proves unsafe controls/claims are absent. A full atomic restore, RPO/RTO and managed backup proof remain not implemented.

### DEF-008 — Hard-delete lifecycle is inconsistent

- **Symptom/evidence:** appointment, customer, employee, service, product, expense, attendance and advance paths exposed hard delete despite mixed CASCADE/RESTRICT history rules; direct relation/RPC access could remain destructive even after hiding buttons; retention/anonymization policy is absent.
- **Severity/scope:** High; audit, financial history, privacy, foreign keys.
- **Root cause:** CRUD screens treated deletion as uniform while the database lifecycle is not uniform and no owner-approved retention policy exists.
- **Smallest safe repair:** contain destructive UI immediately; use existing activation flags for employees/services/products; keep edit/status workflows for attendance/advances/expenses; define anonymize/retain rules before changing rows or constraints.
- **Verification/status:** `CONTAINED + LOCAL PASS + OWNER BLOCKED FOR FINAL POLICY`. Relevant pages, including Appointments, contain no direct hard-delete calls; employee/product/service flows use activation state. Pending migration grants revoke browser `DELETE` on retained operational entities, and the legacy employee delete-named RPC deactivates instead of cascading history. No existing row was deleted or rewritten. Customer anonymization, expense reversal and final retention periods still require owner policy.

### DEF-009 — No-show “charged” language did not create a payment

- **Symptom/evidence:** no-show RPC records a fee amount/status only; it does not create invoice/payment rows or collect funds.
- **Severity/scope:** High; appointments, cash tracking, customer communication.
- **Root cause:** operational accounting marker used payment-collection wording.
- **Smallest safe repair:** UI now says recorded/manual fee and explicitly says no payment was collected.
- **Verification/status:** `CONTAINED + LOCAL PASS`. Appointment/no-show UI and i18n tests pass. Automated collection remains not implemented.

### DEF-010 — CI did not protect normal frontend changes and could auto-change Demo

- **Symptom/evidence:** old workflow had narrow triggers; SQL acceptance was not consistently run; a credentialed main push could apply remote migrations automatically.
- **Severity/scope:** High; all application/database releases and remote data safety.
- **Root cause:** deployment workflow doubled as incomplete application CI.
- **Smallest safe repair:** prepared PR/main static gates covering the full repository contract and restrict the credentialed live job to explicit `workflow_dispatch`.
- **Verification/status:** `REPAIR PREPARED + LOCAL PASS; WORKFLOW PERMISSION BLOCKED`. The hardened workflow and its focused static regression pass locally, but the connected GitHub App cannot update workflow files, so neither is included in this PR. The tracked `main` workflow can still run the live Demo job after a relevant main push when credentials exist; this PR must remain draft/unmerged until a maintainer lands the prepared workflow hardening separately.

### DEF-011 — Explicit Production could inherit tracked Demo configuration

- **Symptom/evidence:** optimized `PROD` builds selected Demo fallback even when `VITE_ENVIRONMENT=production` was explicit.
- **Severity/scope:** High; environment separation and cross-environment data.
- **Root cause:** Vite optimization mode was used as environment policy.
- **Smallest safe repair:** explicit Production fails closed with `INVALID_SUPABASE_CONFIGURATION`; explicit staging trial fallback remains separate.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Environment/fallback unit tests, initialization failure journey, typecheck and production build pass. No public deployment was changed.

### Medium

### DEF-012 — PWA shortcuts did not match `HashRouter`

- **Symptom/evidence:** manifest used `/dashboard` and `/pos` while runtime routes require `/#/dashboard` and `/#/pos`.
- **Severity/scope:** Medium; installed PWA launch/navigation.
- **Root cause:** manifest assumed BrowserRouter.
- **Smallest safe repair:** hash-based start/shortcut URLs plus static contract.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HTTP SMOKE`. Built manifest has the hash URLs; current production preview served `/`, manifest and SW with HTTP 200, and the build contains the update-prompt chunk. Browser install/standalone launch was not tested because no browser executable is available.

### DEF-013 — Critical load failures looked empty or never finished

- **Symptom/evidence:** POS could look like an empty catalog; Settings could spin forever; Notifications/Payments could silently display defaults after query failure.
- **Severity/scope:** Medium; POS and admin Settings journeys.
- **Root cause:** rejected/failed initial requests were not mapped to visible retryable page state; NOT_FOUND and QUERY_ERROR were conflated.
- **Smallest safe repair:** `ScreenState` errors with Retry; only `NOT_FOUND` is treated as first-time defaults.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. POS/settings/payment/notification failure and retry component tests pass, including successful second request after an error.

### DEF-014 — Branding import and private logo paths were broken

- **Symptom/evidence:** import saved stale React state; a private Storage object path was used directly as `<img src>`.
- **Severity/scope:** Medium; branding, Settings and invoice/receipt logos.
- **Root cause:** asynchronous state closure and conflicting path/base64 persistence strategies.
- **Smallest safe repair:** validate and save imported snapshot directly; resolve legacy `center-assets` paths to signed URLs at repository boundaries.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Branding import, repository signed-URL and invoice logo regressions pass. Real hosted Storage display is not tested.

### DEF-015 — Customer search accepted raw filter grammar and stale responses; some large lists remain unbounded

- **Symptom/evidence:** user text entered a raw `.or()` PostgREST expression; an older POS/Appointments response could replace a newer query; reports silently sliced visible rows; several repository lists still fetch all center rows.
- **Severity/scope:** Medium; search correctness, query safety, performance.
- **Root cause:** raw filter composition, no request sequencing, silent UI truncation, and no project-wide pagination contract that preserves totals/search/export semantics.
- **Smallest safe repair:** typed parallel `.ilike()` queries, per-branch limit 50, dedupe/sort, request sequence guards, explicit report “Load more”, and month-bounded attendance reads. Server pagination for customers/products/expenses requires a dedicated port/UI contract so searches, totals and exports are not silently incomplete.
- **Verification/status:** `PARTIAL + LOCAL PASS`. Raw-filter/out-of-order regressions pass; Reports proves row 21 is reachable only after “Load more”; Attendance proves selected-month query ranges and refresh. Broader server pagination and real data-volume testing remain `OPEN`.

### DEF-016 — Page-local dialogs lacked the shared accessibility foundation

- **Symptom/evidence:** Appointments, Customers, Expenses, Reports, Attendance and Advances used duplicated fixed overlays without the shared focus trap, Escape handling, scroll lock or trigger focus restoration.
- **Severity/scope:** Medium; keyboard, screen reader and mobile interaction.
- **Root cause:** dialog markup was duplicated in pages instead of using the existing shared `Modal`.
- **Smallest safe repair:** migrate each existing overlay to shared `Modal` while preserving its form actions and branded content; add a static guard against new page-local `fixed inset-0` overlays.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Focused tests observe accessible dialog names, trapped focus, Escape close, trigger restoration and create/save wiring across all six page families; source guard finds zero page-local overlays. Visual contrast/layout and physical mobile keyboard behavior remain `NOT TESTED` because no browser executable is available.

### DEF-017 — Manual/no-provider notifications claimed delivery

- **Symptom/evidence:** opening `wa.me` was logged as delivered and SMS said queued without a provider; logs included message/phone content.
- **Severity/scope:** Medium; customer trust, privacy and message analytics.
- **Root cause:** local handoff was modeled as provider delivery.
- **Smallest safe repair:** WhatsApp remains pending/unverified, statistics exclude it from sent/delivered, SMS/automation are explicitly unsupported, logs retain metadata only.
- **Verification/status:** `CONTAINED + LOCAL PASS`. WhatsApp service, notification UI, i18n and metadata-only logging regressions pass. Real provider delivery is not implemented or tested.

### DEF-018 — Attendance allowed duplicate days and invalid time order

- **Symptom/evidence:** no unique `(center_id, employee_id, date)` key; time-only strings were incorrectly passed to `Date`, allowing checkout-before-checkin to become zero hours.
- **Severity/scope:** Medium; attendance and staff analytics.
- **Root cause:** missing database business key/checks and incorrect time-only parsing.
- **Smallest safe repair:** migration `20260817000004_attendance_integrity.sql` adds read-only preflight, unique index, time-order and nonnegative-hours checks; domain/UI/repository use explicit time-of-day parsing and duplicate guard.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. PGlite executable inserts prove duplicate, reversed time and negative hours are rejected; domain tests pass. Hosted preflight may find legacy violations and intentionally aborts without deleting data; owner review is then required.

### DEF-019 — Tauri capability claims exceeded implementation

- **Symptom/evidence:** desktop health/config claimed SQLite, offline-first, shortcuts and deep-link readiness although storage is JSON and adapters are TODO.
- **Severity/scope:** Medium; release claims and desktop expectations.
- **Root cause:** prototype flags were marked ready before implementation.
- **Smallest safe repair:** all unsupported flags are false; Rust health calls the shell a JSON snapshot prototype; unused deep-link dependency/config removed; Desktop CSP enabled for local assets and required Supabase/font connections.
- **Verification/status:** `CONTAINED + LOCAL PASS`; desktop source tests cover truthful capability flags, CSP and absent deep-link registration. Native `cargo check`, package, signing and updater acceptance are `BLOCKED` because `cargo` is not installed.

### Low / Operations

### DEF-020 — Live preflight crashed on network rejection

- **Symptom/evidence:** TLS failure produced an uncaught `TypeError: fetch failed` stack instead of a controlled check summary.
- **Severity/scope:** Low; CI/operator diagnostics.
- **Root cause:** table requests had no per-request exception boundary.
- **Smallest safe repair:** catch and aggregate each network failure, redact configuration and exit non-zero.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Controlled run reported 12 `ECONNRESET` remote failures, printed no credential/config value or uncaught stack, and exited 1. Hosted reachability itself remains blocked by this network.

### DEF-021 — No repository proof of production telemetry or disaster-recovery operation

- **Symptom/evidence:** runtime logging is local/console; no uptime/error alert integration, hosted backup/PITR evidence, restore drill, RPO or RTO is stored in the repository.
- **Severity/scope:** High operational gap; support, outage detection and disaster recovery.
- **Root cause:** operational ownership/provider plan is outside current application contract.
- **Smallest safe repair:** owner selects privacy-safe telemetry and managed backup plan, documents quota/RPO/RTO, then runs restore drill on a disposable project.
- **Verification/status:** `OWNER/EXTERNAL BLOCKED`. This recovery did not create paid services, transmit customer data, or run destructive restore tests.

### DEF-022 — Auth metadata role and center membership role could disagree

- **Symptom/evidence:** UI role came from Auth `app_metadata`, while database authorization uses `center_memberships.role`; `getMyCenters()` previously omitted role.
- **Severity/scope:** High; route visibility, multi-center authorization and stale downgrade behavior.
- **Root cause:** two server-owned role sources were read independently without active-center reconciliation.
- **Smallest safe repair:** return role with every center membership and make the active membership role the UI source of truth; revalidate after Auth state/token changes.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. A regression proves stale Auth `ADMIN` becomes UI `STAFF` when the active membership is STAFF; Auth state changes rerun session/membership verification. Hosted multi-center acceptance remains required.

### DEF-023 — Workforce modules mixed hard-coded Arabic and were difficult to discover

- **Symptom/evidence:** Attendance, Advances, Payroll and Staff Analytics embedded Arabic visible copy; workforce routes were absent from Sidebar/Global Search.
- **Severity/scope:** Medium; English UX, admin navigation and support.
- **Root cause:** modules were added after the shared i18n/navigation contracts.
- **Smallest safe repair:** move visible copy to i18n and expose supported ADMIN routes in Sidebar and Global Search.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Source guard finds zero Arabic code points in the four page files; navigation/search contract covers all four routes. Browser visual translation review remains unavailable.

### DEF-024 — Auth session UI did not react to token/user state changes

- **Symptom/evidence:** AppContext checked the session only at initialization/login; token refresh, remote sign-out or updated server metadata could leave stale shell state until reload.
- **Severity/scope:** Medium; Auth lifecycle and revoked-role UX.
- **Root cause:** no `onAuthStateChange` subscription or membership revalidation path.
- **Smallest safe repair:** subscribe through AuthRepository, ignore the initial duplicate event, and rerun canonical session/membership reconciliation for later events; unsubscribe on unmount.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`. Tests observe revalidation on `TOKEN_REFRESHED`, cleanup, and generation-ordered reconciliation: a delayed older membership response cannot restore an authenticated shell after a newer `SIGNED_OUT`. Invite/reset-password delivery still depends on a configured hosted email/operator flow and is not claimed implemented.

### DEF-025 — Logo uploads lacked MIME/size/server quota boundaries

- **Symptom/evidence:** direct Storage callers could bypass `accept=image/*`; each upload used a timestamped key and could accumulate objects.
- **Severity/scope:** Medium; Storage safety, quota and content handling.
- **Root cause:** UI-only validation and no bucket metadata restrictions.
- **Smallest safe repair:** validate JPEG/PNG/WebP and 2 MiB at repository boundary, use stable `logo-current`, and add ADMIN/center-scoped bucket MIME/size migration.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS + HOSTED BLOCKED`. Oversized/SVG files fail before Storage; migration replay/policies pass locally. Migration `20260817000005_storage_upload_hardening.sql` requires approval before Demo application.

### DEF-026 — Non-ledger CRUD lacks a centralized immutable audit trail

- **Symptom/evidence:** customer/settings/catalog edits do not produce a repository-owned actor/reason audit event; console logs are not an audit trail.
- **Severity/scope:** Medium governance/operations gap.
- **Root cause:** audit retention, event scope and privacy policy were never defined.
- **Smallest safe repair:** owner defines audited entities, retention and access; then add append-only metadata events without passwords or unnecessary PII.
- **Verification/status:** `OWNER BLOCKED`. Destructive UI was contained, but an unbounded audit table was not invented without retention/privacy policy.

### DEF-027 — PWA update/precache policy could disrupt sessions or retain private imagery

- **Symptom/evidence:** `autoUpdate` used immediate activation, every install precached the large lazy chart chunk, and a broad CacheFirst image rule could retain business or signed private images on a shared device.
- **Severity/scope:** High; open POS sessions, install cost, mixed-version risk and logout/privacy boundaries.
- **Root cause:** generated SW defaults and extension-wide image caching were used without data-classification rules.
- **Smallest safe repair:** prompt for explicit reload, allow dismissal, exclude the online-report chart engine from install precache, and keep business/customer images network-only; only explicitly public fonts retain runtime caching.
- **Verification/status:** `IMPLEMENTED + LOCAL PASS`; static contract and production build confirm prompt registration, chart exclusion and absence of broad image runtime caching. Installed-device update/logout acceptance remains not tested without a browser.

### DEF-028 — `lint` was only a duplicate typecheck and package-manager policy was ambiguous

- **Symptom/evidence:** `npm run lint` executed only `tsc`; npm and pnpm lockfiles coexist while CI uses npm.
- **Severity/scope:** Low maintainability/CI reliability.
- **Root cause:** no explicit source-policy gate or package manager declaration.
- **Smallest safe repair:** pin npm in `packageManager`; add a no-dependency source policy lint for focused/skipped tests, raw PostgREST disjunctions, local overlays and undersized buttons while retaining typecheck.
- **Verification/status:** `CONTAINED + LOCAL PASS`. `npm run lint` now executes typecheck plus policy lint. The historical pnpm lockfile was preserved rather than deleted without approval; broad dependency upgrades/dead-code deletion remain separate work.

### DEF-029 — Green unit tests do not prove real browser/hosted journeys

- **Symptom/evidence:** jsdom/mocked tests cannot prove Supabase RLS/Auth/Storage, PWA install/update, visual contrast or physical keyboard/printer behavior.
- **Severity/scope:** High release-evidence gap.
- **Root cause:** no reachable browser executable or hosted test credentials/network in this environment.
- **Smallest safe repair:** run committed role/SQL acceptance and browser journeys on approved Demo/Staging; retain local component/static coverage as a lower evidence tier.
- **Verification/status:** `EXTERNAL BLOCKED`. Local coverage increased and warnings/regressions were fixed, but no browser/hosted claim is made.

## 5. Reconciliation of every original audit finding

This table reconciles all 28 IDs from the original `FULL_PROJECT_AUDIT.md`; none are silently omitted. “Local” never means hosted acceptance.

| Audit ID | Current disposition | Evidence / linked defect |
|---|---|---|
| H-01 User Management/Auth mismatch | CONTAINED + LOCAL PASS | `DEF-006`; misleading account UI removed |
| H-02 partial Backup/Restore | CONTAINED + LOCAL PASS | `DEF-007`; truthful export only |
| H-03 hard-delete lifecycle | CONTAINED; owner policy remains | `DEF-008`; destructive master/financial UI paths removed or deactivated |
| H-04 no-show charged without payment | CONTAINED + LOCAL PASS | `DEF-009` |
| H-05 CI coverage/live SQL gap | REPAIR PREPARED locally; workflow-write permission blocked | `DEF-010`; do not merge pending migrations before maintainer lands the manual-only live gate |
| H-06 Production Demo fallback | IMPLEMENTED + LOCAL PASS | `DEF-011` |
| H-07 dual role sources | IMPLEMENTED + LOCAL PASS; hosted pending | `DEF-022` |
| H-08 hosted schema/security unknown | EXTERNAL BLOCKED | `DEF-029`; no remote migration applied |
| M-01 fake notification delivery | CONTAINED + LOCAL PASS | `DEF-017` |
| M-02 PWA route/offline/update mismatch | PARTIAL/CONTAINED | hash routes + update prompt fixed; Supabase data remains explicitly online-only |
| M-03 blank/spinner load failures | IMPLEMENTED + LOCAL PASS | `DEF-013` |
| M-04 branding/logo path/import | IMPLEMENTED + LOCAL PASS; Storage hosted pending | `DEF-014`, `DEF-025` |
| M-05 unbounded/raw/stale search | PARTIAL + LOCAL PASS | `DEF-015`; raw filters/stale/report visibility/month ranges fixed, broad pagination remains |
| M-06 accessibility inconsistency | IMPLEMENTED + LOCAL PASS | `DEF-016`; shared dialogs/44px policy; browser visual pending |
| M-07 i18n/route discoverability | IMPLEMENTED + LOCAL PASS | `DEF-023` |
| M-08 Auth lifecycle/stale session | PARTIAL + LOCAL PASS | `DEF-006`, `DEF-024`; session events fixed, invite/reset provider flow pending |
| M-09 test count vs real journeys | EXTERNAL BLOCKED for highest tier | `DEF-029`; local suite expanded, browser/hosted unavailable |
| M-10 Tauri claims/CSP | CONTAINED + LOCAL PASS | `DEF-019`; truthful prototype, CSP enabled, unused deep-link removed; cargo unavailable |
| M-11 logo MIME/size/quota | IMPLEMENTED + LOCAL PASS; hosted pending | `DEF-025`, migration `000005` |
| M-12 missing audit trail | OWNER BLOCKED | `DEF-026`; retention/privacy decision required |
| M-13 attendance duplicates/times | IMPLEMENTED + LOCAL PASS; hosted pending | `DEF-018`, migration `000004` |
| M-14 payment/public booking incomplete | CONTAINED + LOCAL PASS | gateway stays visibly `Not connected`, saves disabled/sandbox metadata only, POS labels external/manual tender recording, public RPCs deny-by-default |
| M-15 PWA precache/immediate update | IMPLEMENTED locally; device acceptance pending | `DEF-027` |
| M-16 monitoring/DR proof | OWNER/EXTERNAL BLOCKED | `DEF-021` |
| L-01 lint/locks/dead candidates | PARTIAL/CONTAINED | `DEF-028`; npm pinned + policy lint; no risky bulk deletion |
| L-02 dependency note | MONITORED, not a current defect | `npm audit` remains 0; broad major upgrade intentionally not mixed into recovery |
| L-03 documentation drift | IMPLEMENTED | canonical docs designated; historical files carry banners |
| L-04 preflight network crash | IMPLEMENTED + LOCAL PASS | `DEF-020` |

## 6. Local verification snapshot

The final exact verification snapshot is recorded after all edits in the section below. An intermediate full run caught two regressions introduced by the accessibility migration (an ambiguous test selector after naming the mobile FAB, and a stale mobile source assertion after moving keyboard handling into shared `Modal`); both were corrected and the full suite was rerun to green. Expected negative-path logs (for example, the deliberate missing-configuration initialization test) are not treated as runtime success claims.

| Check | Observed result |
|---|---|
| Full Vitest suite after independent review corrections | PASS; 105 files / 570 tests. Expected missing-config and branding-import rejection tests logged their deliberate failure paths; process exit 0. |
| `npm run typecheck` | PASS; `tsc --noEmit` |
| `npm run lint` | PASS; TypeScript + source-policy lint across 227 files |
| `npm run build` | PASS after independent review corrections; 2,833 modules; PWA 53 entries / 1,557.68 KiB |
| `npm run ci:migrations` | PASS; 36 canonical migrations, identifier/extension ordering valid |
| `npm run ci:rpc-check` | PASS; 29 frontend RPC references, all defined canonically |
| `npm run db:types:check` | PASS; generated types match canonical replay inventory |
| `npm run audit:gate` | PASS; 35 automated migrations + 1 manual bootstrap, identical repeat fingerprint, 0 replay/idempotency failures |
| `npm audit --audit-level=low` | PASS; 0 vulnerabilities |
| `git diff --check` | PASS; no whitespace errors |
| Desktop tests | PASS; 6 files / 13 tests |
| Production preview smoke after final build | PASS; `/`, manifest and SW HTTP 200; hash routes/update prompt/chart-precache exclusion PASS |
| `desktop:tauri:check` | BLOCKED: `cargo: not found` |
| Hosted Supabase role/data acceptance | BLOCKED: migrations not approved/applied; network TLS reset |
| Browser visual/keyboard/PWA install | NOT TESTED: no browser executable; download blocked by network reset |

## 7. Remaining approvals and safest next milestone

1. Have a maintainer land the prepared workflow hardening so live Demo migration requires explicit `workflow_dispatch`; do not merge this migration-bearing PR before that gate exists.
2. Approve applying migrations `20260817000001`–`20260817000005` to **Demo/Staging only**, after reviewing attendance preflight and current `center-assets` bucket metadata; then use CI-held credentials (not chat) for the manual live job and SQL acceptance.
3. Decide commission policy (`DEF-005`) and final anonymization/retention/reversal policy (`DEF-008`).
4. Decide immutable audit retention/privacy (`DEF-026`) and telemetry/backup provider, RPO/RTO and disposable restore drill (`DEF-021`).
5. Design server pagination with real data-volume acceptance while preserving global search, totals and CSV export semantics; run browser/mobile visual acceptance when a browser environment is available.
