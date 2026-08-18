# FINAL_INDEPENDENT_REVIEW — LenaBeauty

**Review date:** 2026-08-18
**Reviewer role:** independent final product / domain / UX / engineering / security / data / QA / PWA / Production reviewer
**Branch:** `arena/01a0153c-lenabeauty`
**Commits reviewed:** `8814738` (merge base) → `763aa48` → this review's fix commit
**Stance:** no previous report, comment, completion label or test claim was trusted. Every statement below is backed by a command executed in this session, or is explicitly marked **NOT VERIFIED**.

---

## VERDICT: **CONDITIONAL PASS**

**No release blocker was found.** I checked each blocking condition explicitly:

| Blocking condition | Finding | Evidence |
|---|---|---|
| Credential exposure | **None.** No `.env`, no service-role key, no private key in tree or build. The only JWT in `dist/` decodes to `{"role":"anon"}` — public by design. | secrets scan + base64url decode of the built token |
| Unauthorized access | **None found.** 0 functions and 0 tables are executable/readable by `anon`. Every admin destination is guarded by `RequireAdmin`, not by menu hiding. | `function_acl`/`grants` query on the replay artifact; test `IA-T8/IA-T10` |
| Data loss / corruption | **None found.** The only `DELETE` in the canonical chain is inside `delete_payroll_run_v1`: ADMIN-gated, tenant-scoped, `FOR UPDATE`-locked, and it restores advances before deleting. | read of `20260817000003` lines 95–135 |
| Money errors | **None found.** Earned revenue = `total − tax − prepaid + redeemed`, floored at 0 and `round(...,3)` for OMR. Clients hold **zero** INSERT/UPDATE/DELETE grants on any financial table. Duplicate payment is prevented by PK `(center_id, request_id)`. | migration read + grant query + constraint query |
| Destructive / unreviewed migration | **None.** All 36 migrations validate and replay; every migration since `20260810000002` has a paired rollback runbook. | `ci:migrations`, `audit:gate`, `ls supabase/rollbacks/` |
| Broken core journey | **None found in code.** Sign-in → dashboard → navigation renders correctly for ADMIN and STAFF, in Arabic and English. | rendered component tests, 657 passing |
| Unsafe private caching | **None.** Precache contains only app code, icons and the manifest. The single runtime cache is Google Fonts. Business/customer images and signed Storage URLs are network-only. | `dist/sw.js` manifest inspection + `vite.config.ts` |
| Unresolved Critical | **None open.** See §4. |
| Unrecoverable high-risk data change | **N/A.** No migration was applied to any hosted database from this checkout. | `preflight:supabase` fails at the network boundary |

**Why CONDITIONAL rather than PASS:** the blocker list is clear, but **hosted correctness remains unproven from this environment**. Migrations `20260817000001`–`20260818000001` are not applied to hosted Supabase, and the network is closed here, so no live role/RLS/financial behaviour was observed. That is a genuine gap, not a formality — it is the last gate before real customer data.

---

## 1. Exact commands executed, with results

Run after `rm -rf node_modules && npm ci` so nothing depended on a stale install.

| Command | Result |
|---|---|
| `npm ci` | PASS — 516 packages, **0 vulnerabilities** |
| `npm run typecheck` | PASS — `tsc --noEmit`, 0 errors |
| `npm run lint` | PASS — TypeScript + source-policy lint, **234 files** |
| `npm test` | **PASS — 111 files / 657 tests**, 0 failures |
| `npm run build` | PASS — PWA, 56 precache entries / 1572 KiB |
| `npm run audit:gate` | PASS |
| `npm run db:types:check` | PASS |
| `npm run ci:migrations` | PASS — 36 canonical migrations |
| `npm run ci:rpc-check` | PASS — all frontend RPCs defined |
| `npm run desktop:test` | PASS — 6 files / 14 tests |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| `vite preview` + HTTP probes | PASS — `/`, `/manifest.webmanifest`, `/sw.js`, `/lena-mark.svg`, `/pwa-192x192.png` all **200** |
| `npm run preflight:supabase` | **Expected FAIL** at the remote step — local schema assertions all PASS, remote requires credentials not present here |
| `curl` Supabase health | **Unreachable** (exit 35, TLS blocked by sandbox) |

---

## 2. What I verified, by area

### 2.1 Product & domain
The product is a single-center salon/spa operations PWA for Oman/GCC, Arabic-first with RTL. Verified by rendering the real component tree: the pre-auth screen now states what it is, who it serves, the single action, and what happens next. A brand-new center receives one ordered setup path in true dependency order (services → team → customers → appointment → sale). Currency is OMR at 3 decimals throughout.

### 2.2 Roles & journeys
- `RequireAuth` fails safe to `/login` for **every** session problem and preserves the attempted location.
- `RequireAdmin` admits ADMIN only and now attaches a reason so refusals are explained.
- Rendered readout confirms STAFF sees 6 operational destinations; ADMIN sees 16.
- `MANAGER` is operationally identical to STAFF, matching `can()` — verified against the permission model, not assumed.
- Empty / error / retry states use shared `ScreenState`/`ListState`; the onboarding card hides itself on a failed read rather than claiming an empty center.
- Session expiry: `onAuthStateChange` re-runs full session + membership reconciliation, with a generation counter guarding overlapping events.
- Offline: `NetworkStatus` announces loss via `role="alert"`; data is honestly online-only.

### 2.3 Security, authorization, privacy, data
- **0** functions and **0** table grants to `anon`.
- Public booking/portal RPCs grant to `postgres` only — deny-by-default confirmed at the ACL level.
- All **34** tables have RLS enabled.
- Financial tables: **0** client write grants; checkout flows through one idempotent RPC.
- CSP is strict (`script-src 'self'`, no inline scripts), plus HSTS, `X-Frame-Options: DENY`, `nosniff`, `frame-ancestors 'none'`.
- `localStorage` holds only branding, logo, language, theme, active center and an onboarding dismissal — **no customer or financial data**.

### 2.4 PWA, environments, deployment
Manifest `start_url` and both shortcuts use hash routes matching `HashRouter`. `registerType: 'prompt'` — no silent chunk swap mid-session. `sw.js` served with `max-age=0, must-revalidate`. Chart engine excluded from precache. The non-production environment is now disclosed in-app by `EnvironmentBadge`.

### 2.5 Performance, dependencies, CI, docs
0 vulnerabilities. Build is code-split per page. CI runs the full gate set on PRs, and live Demo migration is `workflow_dispatch`-only with an explicit project-ref guard.

---

## 3. Defects I found and fixed in this review

Both were found by fresh inspection, not inherited from any report.

### FIR-01 — Arabic text rendered inside the English UI (16 keys) · **Fixed**
`src/i18n.ts` sets `fallbackLng: 'ar'`, so any key missing from the English dictionary silently renders **Arabic** — with no raw-key marker and no failing test. Existing i18n tests only checked a hand-curated file list, so these survived.

Confirmed leaking to English users: **`Logout`**, `Price`, `Cost`, `Financial Summary`, `7-Day Revenue`, `Daily revenue trend`, `This Month`, `Processing...`, `Loading Chart...`, `No Revenue Data`, `No Financial Data`, `Start selling to see trends`, `Complete transactions to see data`, `Manage your client database`, `Customer created successfully`, `Customer updated successfully`.

**Fix:** added the missing English entries. Impact: an English-speaking operator can now read the sign-out control and the entire Dashboard financial card.

### FIR-02 — Raw English rendered to Arabic users on shipped surfaces (8 keys) · **Fixed**
Surfaced by the new guard: `Search pages, actions...`, `No results found`, `Quick Navigation`, `Navigate` (Global Search), plus `Employee Advances`, `Month`, `Enabled`, `Net Salary per Employee`.

**Fix:** added proper Arabic translations. Global Search — the product's fastest navigation path — is now fully Arabic.

### Regression protection added
`src/__tests__/i18n.no-language-leak.test.ts` (5 tests) scans **every** `t("…")` literal in the shipped source rather than a curated list, and fails CI on: Arabic leaking into English, keys missing from Arabic on shipped surfaces, duplicate dictionary keys, and a stale deferred-module exclusion list.

`src/__tests__/onboarding-resilience.test.tsx` (3 tests) proves the first-run card survives a rejecting repository, a throwing `localStorage` (private mode / quota), and unmount-during-fetch without a post-teardown state update.

**Verification:** 649 → **657 tests**, all passing; all gates rerun green; `git diff` reviewed — dictionary additions only, no logic changed.

---

## 4. Previously-claimed Critical/High items — re-verified independently

| Claim | Independent finding |
|---|---|
| DEF-001 sensitive RPCs ADMIN-gated | **CONFIRMED** — 0 anon grants; admin wrappers present |
| DEF-002 dashboard financials role-governed | **CONFIRMED** — `can_view_revenue` gates the summary; UI shows "Restricted", not "No data" |
| DEF-003 VAT/prepaid excluded from revenue | **CONFIRMED** — formula read directly from SQL |
| DEF-004 payroll transactional | **CONFIRMED** — single RPC, ADMIN-gated, row-locked, direct writes revoked |
| DEF-010 CI cannot auto-migrate Demo | **CONFIRMED** — live job requires `workflow_dispatch` + project-ref match |
| DEF-025 storage upload limits | **CONFIRMED in code**; hosted bucket state NOT VERIFIED |
| DEF-027 PWA cache/update safety | **CONFIRMED** — prompt-based update, no private assets precached |
| First-impression work (previous session) | **CONFIRMED** — 23 + 16 tests re-run green; no fabricated trend, no testimonials, brand-token first paint |
| IA work (previous session) | **CONFIRMED** — 33 tests re-run green; registry drives all surfaces; deep-link return is open-redirect-safe |

---

## 5. NOT VERIFIED (cannot be closed from this environment)

These are honest gaps, not assumed passes.

| Item | Why |
|---|---|
| Hosted Supabase schema, RLS and role behaviour | Network blocked (curl exit 35); migrations `20260817000001`–`20260818000001` not applied |
| Live financial acceptance with real rows | Requires hosted DB + credentials |
| Real-browser rendering, keyboard, touch, RTL visuals | No browser installable (`playwright install` fails: sandbox network + missing font packages) |
| Real device PWA install / update / offline | Same |
| Supabase Leaked Password Protection | Managed Auth setting; a 2026-08-10 snapshot reported it disabled (Pro-plan feature) |
| Backup restore drill, RPO/RTO | No hosted environment |
| `cargo check` for Tauri | `cargo` not installed |
| Lighthouse / real-network performance | No browser |
| Deferred-module translations (4 admin pages) | Hidden from navigation and search; tracked, not shipped |

---

## 6. Remaining defects (none blocking)

| ID | Severity | Item |
|---|---|---|
| R-01 | High (external) | Hosted acceptance of migrations `20260817000001`–`20260818000001` |
| R-02 | Medium | 4 deferred admin pages lack Arabic strings and shared state components — un-defer only when finished |
| R-03 | Medium | ~80 raw `text-gray-*` / `text-right` occurrences in Attendance/Payroll/Advances/Staff Analytics |
| R-04 | Medium (owner) | Commission policy undefined — payroll is fixed salary less advances |
| R-05 | Medium (owner) | Retention / anonymization / audit-trail policy undefined |
| R-06 | Medium | No server-side pagination; large-volume behaviour untested |
| R-07 | Low | 22 of 26 pages hand-roll `<h1>` instead of shared `PageHeader` |
| R-08 | Info | PR #35 (Data API grant contract) still open on another branch |

---

## 7. Next three milestones

1. **Hosted Demo acceptance** — apply pending migrations to Demo only via `workflow_dispatch`, run the committed SQL acceptance suites (STAFF denial, compensation redaction, checkout retry, payroll rollback, financial reporting), and record results. Closes R-01.
2. **Real-browser and device QA** — Chromium/Safari pass over sign-in, POS checkout, receipt print, RTL mirroring, keyboard traversal, and PWA install/update on a real phone.
3. **Owner policy + operational readiness** — decide commission, retention/anonymization and audit retention; then prove a backup restore drill with stated RPO/RTO.

---

## 7b. Owner approval received — execution blocked by token scope

**2026-08-18 — the owner approved applying pending migrations to Demo/Staging only.** I attempted execution immediately. It is blocked, and the blocker is **not** the approval:

| Attempt | Result |
|---|---|
| `gh secret list` | **HTTP 403** — `Resource not accessible by integration` |
| `gh workflow run demo-supabase-migrations.yml` | **HTTP 403** — `Resource not accessible by integration` |
| Direct DB / API reach from sandbox | Unreachable (curl exit 35) |

The agent token (`arena-ai-coding-agent[bot]`) has no `actions: write` permission and cannot read secrets. **No migration was applied.**

### Verified: the required secrets are not configured yet

Run `32069994473` (`workflow_dispatch`, 18h ago) is decisive evidence:

```
✓ Static application and database gates      2m8s
✓ Detect live Demo deployment credentials    3s
- Live Demo migration and security gates     0s   ← skipped
::notice:: Live Demo deployment is safely skipped because one or more
           required GitHub Actions secrets are not configured.
```

So even a successful dispatch today would skip the live job. **Two owner actions are required, in order.**

### Step 1 — add 8 repository secrets
`Settings → Secrets and variables → Actions → New repository secret`:

`SUPABASE_ACCESS_TOKEN` · `SUPABASE_PROJECT_REF` · `SUPABASE_DB_PASSWORD` · `DEMO_SUPABASE_PROJECT_REF` · `DEMO_SUPABASE_URL` · `DEMO_SUPABASE_PUBLISHABLE_KEY` · `DEMO_CENTER_ID` · `DEMO_SUPABASE_SERVICE_ROLE_KEY`

Both project refs must equal `tuzzvqsnbtzvkffmazyf` — the workflow hard-refuses any other target. Never paste these in chat.

### Step 2 — dispatch the workflow
`Actions → "Apply Demo Supabase migrations" → Run workflow → branch arena/01a0153c-lenabeauty`.

### What the run will do — read line by line from the committed workflow

1. Full static gate set (tests, typecheck, lint, build, `npm audit`).
2. Refuse unless both project refs equal the canonical Demo ref.
3. Enforce password-change reauthentication via the Supabase Management API.
4. Link the project and print remote migration state **before** any change.
5. **Read-only preflight** — aborts without touching a row if attendance duplicates/invalid times exist, or if the `center-assets` bucket is missing.
6. Record the manual admin bootstrap as applied without executing placeholder SQL.
7. `supabase db push --linked --yes` — pending migrations only, in filename order. **Seeds are excluded.**
8. Fail on any local/remote history drift.
9. `npm run preflight:supabase` against the live schema.
10. Run all 4 SQL acceptance suites — **each verified to end in `ROLLBACK`, so no test data is committed**.

Any failure stops the run; later migrations are not marked applied. Rollback runbooks exist for every migration in `supabase/rollbacks/`.

---

## 8. Owner / external actions required

1. Approve applying pending migrations to **Demo/Staging** (not Production).
2. Provide Demo credentials **via GitHub Actions secrets only** — never in chat.
3. Decide commission, retention and audit-retention policy.
4. Confirm whether a separate **Production** Supabase project should be provisioned before real customer data.
5. Enable Supabase Leaked Password Protection when on a paid plan.

**Release recommendation:** safe to continue on **Demo/Staging**. **Not approved for Production with real customer data** until R-01 is closed and the owner policies in §8 are decided.
