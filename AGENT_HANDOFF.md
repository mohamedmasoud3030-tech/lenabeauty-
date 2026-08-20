# AGENT_HANDOFF — LenaBeauty

**Last updated:** 2026-08-20
**Branch:** `arena/01a01c90-lenabeauty`
**Head:** communication system milestone (see `git log`)
**Release status:** CONDITIONAL PASS — safe on Demo/Staging, not approved for Production with real data.

Read this before touching anything. It is written for the next agent, not for the owner.

---

## 1. What the product is

A single-center salon/spa operations PWA for the Omani/GCC market. Staff-only: there is **no** public booking site and **no** customer portal — those RPCs exist in the database but carry **zero client grants** and are deny-by-default. Arabic-first with RTL, English secondary. Currency OMR at **3 decimals**.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind v4 · Supabase (Auth + Postgres + Storage + RPC) · i18next · vite-plugin-pwa · Vitest. Clean architecture: `domain/` → `application/` → `infrastructure/supabase/` → `pages/`+`ui/`+`shared/`.

**Roles:** ADMIN, MANAGER, STAFF. In practice there are only **two** audiences — MANAGER has the same scope as STAFF (`MANAGER_PERMISSIONS` is empty by design).

---

## 2. Ground rules that will bite you if ignored

1. **`fallbackLng: 'ar'`.** A key missing from the English dictionary renders **Arabic** to English users — silently. Always add keys to **both** dictionaries. `i18n.no-language-leak.test.ts` enforces this app-wide.
2. **Navigation is not authorization.** `src/app/navigation.ts` controls *visibility*; `RequireAdmin` in `src/routes.tsx` is the boundary. Never hide a route instead of guarding it — test `IA-T8/IA-T10` fails you.
3. **One name per destination.** `src/app/navigation.ts` is the single registry feeding the sidebar, both mobile menus, the header title and Global Search. Do not hand-roll a page-name list.
4. **No fabricated data, ever.** No invented metrics, trends, testimonials or ratings. A failed read must hide a surface, not claim emptiness.
5. **Deferred modules** (`accounting`, `customer-experience`, `forecasting`, `advanced-automation`) carry `deferred: true` and are hidden from navigation **and** search. Their routes stay live. Flip the flag only when the page has real loading/empty/error states, brand styling and Arabic strings.
6. **Never apply migrations to a hosted database from a checkout.** Live Demo migration is `workflow_dispatch`-only with a project-ref guard.
7. **Money is 3-decimal OMR.** Earned revenue = `total − tax − prepaid + redeemed`, floored at 0. Never treat invoice total as revenue.

---

## 3. Verified current state (re-run from scratch on 2026-08-18)

| Check | Result |
|---|---|
| `npm ci` | 0 vulnerabilities |
| `npm run typecheck` · `lint` | PASS (234 files) |
| `npm test` | **111 files / 657 tests, all pass** |
| `npm run build` | PASS — 56 precache entries |
| `audit:gate` · `db:types:check` · `ci:migrations` · `ci:rpc-check` | PASS (38 migrations) |
| `desktop:test` | PASS (14) |
| `npm audit` | 0 vulnerabilities |
| Hosted Supabase | **UNREACHABLE from sandbox** — hosted state unverified |
| Real browser | **UNAVAILABLE** — cannot install Chromium here |

---

## 4. Key files

| Path | Why it matters |
|---|---|
| `src/app/navigation.ts` | Route registry: names, icons, groups, `adminOnly`, `deferred`, optional modules |
| `src/routes.tsx` | Route table + guards + not-found notice |
| `src/route-guards.tsx` | `RequireAuth` / `RequireAdmin` — the real authorization boundary |
| `src/config/env.ts` | Hard env validation; Demo/Staging fallback for non-production builds |
| `src/i18n.ts` | Both dictionaries. ~1200 keys. Mind rule #1 |
| `src/pages/LoginPage.tsx` | Public entry; `resolvePostLoginPath()` is open-redirect-guarded |
| `src/shared/components/GettingStartedCard.tsx` | First-run path driven by real counts |
| `src/shared/components/NavigationNotice.tsx` | Explains admin-only / not-found redirects |
| `supabase/migrations/` | 36 canonical migrations; paired rollbacks in `supabase/rollbacks/` |
| `docs/database-contract/artifacts/` | Generated replay evidence — regenerate with `npm run audit:all` |

---

## 5. Traps discovered the hard way

- **`audit:gate` fails after adding/removing any source file** — it pins a file count. Run `npm run audit:all`, then commit `docs/database-contract/artifacts/frontend-usage.json`.
- **`<output>` has an implicit `role="status"`** — it collides with status-role queries in tests. Use a `<span data-testid>` probe instead.
- **Regex `<button\b[\s\S]*?>` breaks** on arrow functions in JSX props. Match `<button\b` and inspect a fixed window.
- **i18n keys can silently duplicate**; TypeScript catches it only as `TS1117`. The leak guard also checks duplicates.
- **`fallbackLng: 'ar'` masks missing English keys** — a green i18n test proved nothing until the app-wide guard existed.

---

## 5b. Communication system (2026-08-20)

Added a provider-neutral notification core with no live provider activation:

- `COMMUNICATION_SYSTEM_SPEC.md` — full event-channel matrix, templates, preferences, delivery lifecycle, provider boundary, retries, monitoring, cost controls, tests.
- `src/domain/notification/` — types, event registry, bilingual template registry + validation, preference enforcement (opt-in + quiet hours), deduplication, rate limiting, and the `NotificationService` orchestrator.
- `src/infrastructure/notification/` — `ToastChannel` (staff in-app), `WhatsAppWaMeChannel` (manual wa.me, truthful pending status), and a factory wiring real channels; SMS/email/push adapters exist as unavailable stubs (no credentials, no cost).
- UI: `NotificationCenter` bell dropdown in the header (all roles; admin sees Configure link), `NotificationServiceProvider` in `App.tsx`, template previews on the Notifications settings page, and a staff-toast hook on appointment creation.
- DB: migration `20260820000001_customer_notification_preferences.sql` — per-customer channel opt-in + quiet hours + opt-out RPC, dedup key column on the timeline + atomic dedup-check RPC, and an explicit EXECUTE grant for `add_customer_notification_event_v1` (now frontend-called; the 20260810000006 grant-repair whitelist predates it). Fingerprint-stable on re-application; audit gate PASS.
- Tests: `src/__tests__/communication-system.test.ts` (32 tests) — interpolation, bilingual parity, dedup, rate limit, quiet hours, opt-out, channel behavior, test-mode prefix, unknown-event skip.
- **Nothing was sent, enabled, or purchased.** No provider env vars are read; test mode prefixes `[TEST MODE]` and the factory marks external channels unavailable. Live WhatsApp API / SMS / email / push activation requires owner approval (single yes/no gate).

## 5c. Help & support system (2026-08-20)

- `HELP_SUPPORT_SYSTEM.md` — content map, ownership/update triggers, search/navigation,
  safe support intake, privacy, urgency/escalation, freshness criteria.
- `src/shared/help/articles.ts` — 12 verified bilingual task-based articles (onboarding,
  POS, appointments, permissions, account, data, errors, offline, payments).
- `/help` route (all authenticated roles) with search, category chips, deep links
  (`/?help=slug`), article reader, related articles, and a support-intake form.
- Header help button (?) on every page; ErrorBoundary now offers "Get help with this
  error" carrying the report ID via sessionStorage.
- Intake captures route/version/environment/role/error-ref/expected/actual only —
  rejects secrets patterns, min description, 2000-char cap. Stored via
  `create_support_ticket_v1` RPC into `support_tickets` (member-scoped RLS, immutable).
- Migration `20260820000003_help_support.sql` (canonical count now 40).
- Tests: `src/__tests__/help-system.test.tsx` (17) — registry freshness, bilingual
  search, deep links, intake validation (secret rejection, empty rejection, submit,
  route prefill). Full suite: 122 files / 843 tests pass; audit gate PASS.

## 6. What is NOT done

**Blocking Production:** hosted acceptance of migrations `20260817000001`–`20260818000001` (R-01).

**Not blocking:** deferred-module translations (R-02) · raw palette in 4 workforce pages (R-03) · commission policy (R-04, owner) · retention/audit policy (R-05, owner) · server pagination (R-06) · `PageHeader` adoption in 22 pages (R-07) · open PR #35 on another branch (R-08).

**Never verified here:** hosted DB behaviour, real-browser/device rendering, PWA install on hardware, Lighthouse, backup restore drill, `cargo check`.

---

## 6b. Migration approval status — read before retrying

The owner **approved** applying pending migrations to Demo/Staging on 2026-08-18. Execution is blocked by two independent facts, both verified, not assumed:

1. **The agent token cannot dispatch workflows or read secrets** — `gh workflow run` and `gh secret list` both return `HTTP 403: Resource not accessible by integration`. The bot lacks `actions: write`.
2. **The 8 required secrets are not configured.** Run `32069994473` (`workflow_dispatch`, 2026-08-17) skipped the live job with: *"Live Demo deployment is safely skipped because one or more required GitHub Actions secrets are not configured."*

**Do not** attempt to work around this: never put credentials in `.env`, in the repo, or in chat, and never migrate a hosted database from a checkout. The owner must add the secrets and press Run in the Actions tab. Required names are listed in `FINAL_INDEPENDENT_REVIEW.md` §7b.

**No migration has been applied to any hosted database.**

---

## 7. If you pick this up next

Start with milestone 1 in `FINAL_INDEPENDENT_REVIEW.md` §7: hosted Demo acceptance. It needs owner approval and CI-held credentials — do not ask for secrets in chat.

Before any commit: `npm run typecheck && npm run lint && npm test && npm run build && npm run audit:gate`. Then read your own `git diff` before committing.
