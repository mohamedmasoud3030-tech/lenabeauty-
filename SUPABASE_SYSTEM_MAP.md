# Supabase System Map — LenaBeauty

Generated 2026-08-18 from the repository and the canonical migration chain.
No production system was contacted (see *Access boundary* below).

---

## 1. Access boundary for this audit

| Capability | Status |
|---|---|
| Repository, migrations, frontend source | Full access |
| Canonical schema replay (PGlite, PostgreSQL 18) | Full access — used as the oracle |
| Live Demo/Staging project (`tuzzvqsnbtzvkffmazyf`) | **Unreachable** — outbound network is blocked in this environment |
| Production project | **Does not exist yet** (see §3) |

Everything in these reports is proven against the canonical migration chain
replayed into a real PostgreSQL, executed under real client roles. Any statement
that could only be confirmed against the live project is explicitly marked
*not verifiable here*.

---

## 2. Architecture in one line

A React 19 + Vite single-page PWA (also packaged as a Tauri desktop app) talking
**directly** to Supabase from the browser. There is no server tier, no SSR, no
middleware, and no Edge Function. Therefore **PostgreSQL is the only place where
authorization can be enforced.**

```
React page → use case → repository adapter (src/infrastructure/supabase)
           → supabase-js (browser) → PostgREST
           → GRANTs → RLS policies → SECURITY DEFINER RPCs → tables
```

Consequence: every security decision must hold in the database. A hidden button
or a client-side role check is presentation only, and this codebase correctly
treats it that way.

---

## 3. Clients, contexts and environments

### Supabase clients

| Client | File | Context | Key type |
|---|---|---|---|
| Single shared browser client | `src/infrastructure/supabase/client.ts` | Browser only | Publishable/anon (public by design) |

There is exactly one client, created lazily as a singleton. There is **no**
server client, admin client, or `service_role` usage anywhere in the repository.
`src/config/env.ts` actively rejects any key beginning with `sb_secret_`.

**Verified:** no privileged key exists in browser-reachable code.

### Environments

`VITE_ENVIRONMENT` selects `development | staging | production`.

| Environment | Backend target | Notes |
|---|---|---|
| development | From `.env` | Local; no fallback values |
| staging | Demo project `tuzzvqsnbtzvkffmazyf` | Tracked fallback URL/anon key/center in `env.ts` |
| production | **Must be supplied explicitly** | Fails closed if any value is missing |

The tracked staging fallback is an anon key, which is public by design. A future
production environment cannot silently inherit it: `useDemoFallbacks` is only
true when the build is a production build **and** the environment is `staging`.

**Confirmed:** no Production Supabase project exists yet. The optimized build
currently ships against Demo/Staging.

### Session handling

`persistSession`, `autoRefreshToken` and `detectSessionInUrl` are left at
supabase-js defaults (all enabled), which is correct for a browser SPA.
`AppContext` re-runs its membership reconciliation on every auth state change
and uses a generation counter so an older overlapping reconciliation can never
overwrite a newer one — a real race-condition guard, correctly implemented.

---

## 4. Identity, roles and tenancy

### The model

```
auth.users  →  public.profiles (id = auth.users.id)
                     ↓
        public.center_memberships (profile_id, center_id, role)
                     ↓
              public.centers  →  all tenant data (center_id)
```

`role` is one of `ADMIN | MANAGER | STAFF` and is **center-scoped**.

### Two role locations, one authority

| Location | Used by | Authority |
|---|---|---|
| `center_memberships.role` | All RLS policies and RPCs | **Authoritative** |
| `auth.users.raw_app_meta_data.role` | Frontend route guards only | Presentation |

The role is stored in `app_metadata` (server-owned), never `user_metadata`
(user-writable). `AppContext` deliberately overrides the token's role with the
active membership's role, because a token can be stale after a role change while
the database is always current. This is the right precedence.

### Provisioning

Membership creation is **out-of-band only** (`docs/MEMBERSHIP_BOOTSTRAP.md`,
migration `20260628000002_admin_bootstrap.sql`, run manually). No client role can
insert or update `center_memberships`. **Verified executably** — see
`supabase.data-api-grant-contract.test.ts`.

There is no `handle_new_user` trigger: a new `auth.users` row gets no profile and
no membership automatically. That is a deliberate deny-by-default posture for a
single-tenant salon product, not a defect.

### Branch mode

`single` (current) pins the tenant to `VITE_CENTER_ID` and requires the signed-in
user to hold a membership in exactly that center. `multi` resolves the active
center from the user's memberships at runtime. In both modes the center id sent
by the browser is only ever a *filter*; the database independently verifies
membership, so a tampered client cannot reach another tenant.

---

## 5. Authorization layers

PostgreSQL checks these **in order**. Both must pass.

1. **GRANT** — may this role touch this table at all? Failure ⇒ `42501`, the
   page shows an error.
2. **RLS policy** — which rows? Failure ⇒ zero rows, the page shows an empty
   state.

Distinguishing these two is essential: they look completely different to a user.

### Policy helper functions

All three are `SECURITY DEFINER`, `STABLE`, with a pinned
`search_path = pg_catalog, public, app_private`:

| Function | Purpose |
|---|---|
| `app_private.user_center_ids()` | Centers the caller belongs to |
| `app_private.is_center_member(uuid)` | Membership test |
| `app_private.has_center_role(uuid, text[])` | Role test (ADMIN gates) |

Each derives identity solely from `auth.uid()`. None accepts a client-supplied
user id. The pinned `search_path` closes the classic definer-function hijack.

### RLS coverage

**34/34 public tables have RLS enabled.** 46 policies.
`checkout_idempotency` intentionally has RLS on and *no* policy and *no* grant —
it is reachable only by its `SECURITY DEFINER` owner. That is deny-by-default
done correctly.

Access shape by table group:

| Group | Read | Write |
|---|---|---|
| Master data (customers, services, products, appointments) | Any center member | Any center member |
| ADMIN-only (expenses, attendance, advances, payroll, settings, accounting) | ADMIN of that center | ADMIN of that center |
| Financial (invoices, invoice_items, payments, gift cards, entitlements) | Center member | **RPC only** |
| Identity (profiles, center_memberships, centers) | Own rows only | Profile self-service only |
| `employees` | Column-restricted (no compensation) | **RPC only** |

### Effective privilege matrix (after remediation)

Every value below is read from the live catalog after replaying the chain, not
from migration text. `anon` holds **nothing** on **every** table.

| Table | `authenticated` |
|---|---|
| appointments, attendance_records, center_settings, customers, employee_advances, expenses, products, profiles, service_categories, services | INSERT, SELECT, UPDATE |
| accounting_journal_entries, ai_booking_leads, center_memberships, centers, customer_entitlements, customer_notification_timeline, customer_reviews, employees*, entitlement_ledger, gift_card_transactions, gift_cards, invoice_items, invoices, notification_settings, package_entitlement_units, payment_gateway_settings, payments, payroll_line_items, payroll_runs, service_file_images, service_files, service_package_items, service_packages | SELECT |
| checkout_idempotency | — (none) |

`*` `employees` is **column-restricted** to
`(id, center_id, name, role, phone, is_active, created_at, updated_at)`.
`salary`, `base_salary`, `commission_percentage` and `month_commission_total`
are unreachable through the Data API for every client role.

**No table grants DELETE to any client role.** Retained records are deactivated,
never erased.

---

## 6. RPC surface

59 functions. All `SECURITY DEFINER` routines pin `search_path`.

**Granted to `authenticated` (the staff UI surface):** checkout (idempotent and
legacy overload), employee admin CRUD, payroll run create/delete, dashboard
summary/P&L/revenue, notification and payment-gateway settings, gift card issue,
service package create, customer review, service file, accounting entry, AI
booking lead, entitlement refund/void/expire, portal token rotation, no-show.

**Installed but deliberately ungranted (dormant):** the nine
`public_*` booking and client-portal functions. They have no `PUBLIC`, `anon` or
`authenticated` EXECUTE grant and their routes are not registered. This is the
correct posture for an unreleased feature; re-audit rate limiting and abuse
controls before enabling them.

Every privileged RPC re-checks authorization internally with
`is_center_member` / `has_center_role` rather than trusting its arguments.

---

## 7. Storage

One bucket: `center-assets`.

- Object path is `"{center_id}/logo-current"`; `app_private.storage_path_center_id()`
  extracts the tenant from the path.
- Policies require ADMIN of the center named in the path.
- Bucket enforces a 2 MiB cap and JPEG/PNG/WebP only, server-side.
- The client validates type and size too, but the server boundary is the one
  that counts.
- Reads use time-limited signed URLs (1 hour); the bucket is not public.

Ownership is derived from the path and re-verified against membership, so a
crafted path cannot write into another tenant's prefix.

---

## 8. Realtime, Edge Functions, caching

- **Realtime:** not used. The only `subscribe`/`unsubscribe` calls are
  `onAuthStateChange`. No publication or channel filter risk exists.
- **Edge Functions:** none in the repository.
- **Caching:** no react-query/SWR. Pages fetch in `useEffect` and refetch after
  mutations, so there is no stale-cache layer to invalidate. The PWA service
  worker precaches the app shell only — never API responses — so it cannot serve
  stale tenant data.

---

## 9. Migrations, types and CI

- **37 canonical migrations**, all forward-only, timestamp-ordered.
  36 automated + 1 documented manual bootstrap.
- **Replay is clean and idempotent:** the whole chain applies twice with an
  identical catalog fingerprint (0 failures, 0 non-idempotent files).
- **Generated types** (`database.types.ts`) are derived from the replayed
  catalog and CI-verified with `db:types:check`, so type drift cannot land.
- **Rollback notes** exist per risky migration in `supabase/rollbacks/`.
- **CI** (`.github/workflows/demo-supabase-migrations.yml`) runs the full static
  gate set on every PR. Remote schema changes are approval-gated: they require a
  manual `workflow_dispatch`, refuse to run against any project ref other than
  the canonical Demo one, and abort on pre-existing attendance integrity
  violations before touching anything.

### Local verification commands

```bash
npm test                  # 665 assertions, includes executable RLS/grant suite
npm run audit:all         # replay + frontend scan + contract matrix
npm run audit:gate        # CI contract gate
npm run db:types:check    # generated types match the schema
npm run ci:migrations     # migration order and extension ordering
npm run ci:rpc-check      # every frontend RPC exists in a migration
```

---

## 10. Data journeys traced end to end

| Journey | Path | Status |
|---|---|---|
| Login | Login → `signInWithPassword` → `getMyCenters()` → `center_memberships` + `centers` → role reconciliation → route guard | **Was broken on a clean project** (no grant); fixed and covered by tests |
| Customers list | Page → adapter → `customers` filtered by center → RLS `customers_tenant` | Works; isolation proven |
| Checkout | POS → `process_checkout_idempotent_v1` → idempotency ledger → invoice/payment/stock in one transaction | Correct; retry-safe via `(center_id, request_id)` |
| Payroll run | Page → `create_payroll_run_v1` (ADMIN-checked, transactional) | Correct; direct table writes revoked |
| Employees | Page → `list_employees_v1` (strips compensation for non-ADMIN) | Correct; column grant is the backstop |
| Backup export | Settings → 12 parallel reads → JSON | **Was silently partial/truncated**; fixed |
| Sales report | Reports → invoices + embedded items + ledger redemptions | **Redemption error was ignored**; fixed |
| Logo upload | Settings → validate → Storage `{center}/logo-current` → signed URL | Correct |
