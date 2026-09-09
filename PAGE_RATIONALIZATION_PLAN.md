# PAGE_RATIONALIZATION_PLAN

Decisions on the route structure itself — keep / merge / split / move / replace / remove / redirect — based on user tasks, not code organization. Verified against `src/routes.tsx`, `src/app/navigation.ts`, and the IA test locks (`information-architecture`, `sidebar-ia`, `mobile-portrait-ux`) on 2026-09-09.

## Governing principles
1. A route that maps to one real operator task stays. The nav registry already groups by operator job (Today / Catalog & People / Money / Team / Growth / System), not by engineering module.
2. No route is removed while a saved link, muscle memory, or test lock depends on it; redirects preserve compatibility.
3. Duplication is fixed by merging duplicated *content*, not by deleting pages with distinct jobs.

## KEEP (evidence-backed)
| Route | Why kept |
|---|---|
| `/login`, `/reset-password` | Distinct auth tasks; locked by `auth-flow`, `password-reset`. |
| `/dashboard` | Day-start overview; degraded-mode wrapper is deliberate resilience. |
| `/action-center` | Work queue with a different job than the dashboard (queue vs overview). Prior "merge dashboard and action center" idea is rejected: one is "what is today like", the other is "what must I do". Content duplication was already removed from the dashboard side (single Needs-Attention list). |
| `/pos` | The revenue-critical journey; split-pane operational layout is locked by `pos-flow`/mobile tests. |
| `/appointments` | The book; day/week schedule is the correct timeline pattern. |
| `/customers`, `/services`, `/inventory` | Distinct catalogs/records; table↔card transforms already correct. |
| `/gift-cards`, `/packages` | Different financial instruments (prepaid value vs service entitlements). Merge rejected — different forms, ledgers, and RPC boundaries. Nav visibility already adapts when a module holds no data. |
| `/employees`, `/reports`, `/expenses` | Admin operational records and evidence; distinct questions. |
| `/attendance`, `/advances`, `/payroll`, `/staff-analytics` | Workforce lifecycle: time → advances → settlement → analysis. Each is a distinct task with its own dialog; merging would create one overloaded page. |
| `/settings` | Configuration isolated from daily operations (correct separation). |
| `/customer-experience`, `/forecasting`, `/accounting`, `/advanced-automation` | Shipped growth/admin modules with real states; admin-only, nav-grouped. |

## MERGE (content-level, already applied / enforced)
| What | Decision | Evidence |
|---|---|---|
| Dashboard "Operational Alerts" + "Needs Attention" | **One merged exceptions list** (late appointments + low stock, capped). Verified in `DashboardPage.tsx` (`needsAttention` memo, one panel). | Prior duplicate low-stock panels no longer exist in code. |
| Search inputs on `CustomersPage` | Two inputs exist but are breakpoint-exclusive (`hidden lg:block` vs `lg:hidden`). **Not a duplicate**; keep the pattern. | Verified classes on 2026-09-09. |

## SPLIT
| What | Decision | Evidence |
|---|---|---|
| `SettingsPage` | Already split into six lazy sections behind `?tab=` (center / launch / backup / branding / notifications / payments). No further split needed. | `SettingsPage.tsx` lazy imports + URL sync. |
| `PayrollPageEnhanced` vs workforce pages | Already split by task. No action. | — |

## MOVE
| What | Decision | Evidence / compatibility |
|---|---|---|
| Branding / Notifications / Payment-gateway config | Moved into `/settings` tabs; legacy routes kept as **redirects** (`/branding → /settings?tab=branding`, etc.). | Redirects live in `routes.tsx` under `RequireAdmin`. |

## REPLACE
| What | Decision | Evidence |
|---|---|---|
| POS custom-price `window.prompt` | Replaced by branded `Modal` with starting-from floor (prior round; verified absent from code). | `grep window.prompt` → 0 hits in product code. |
| Dashboard revenue exposure for STAFF | Replaced by `canViewRevenue`-gated tiles/chart ("Restricted" label). | Verified `DashboardPage.tsx:185,353`. |

## REMOVE
**Nothing.** No live route or capability qualifies for removal: every route has a real task, an owner journey, and test locks. The former "portal" surface was already removed in past hardening rounds (`demo-residue-migration-containment`, `destructive-lifecycle-containment` guard against reintroduction).

## REDIRECT (compatibility map — keep)
| From | To | Status |
|---|---|---|
| `/` | `/login` | VERIFIED COMPLETE |
| `/branding` | `/settings?tab=branding` | VERIFIED COMPLETE |
| `/notifications` | `/settings?tab=notifications` | VERIFIED COMPLETE |
| `/payment-gateway` | `/settings?tab=payments` | VERIFIED COMPLETE |
| `*` (authed) | `/dashboard` + not-found notice | VERIFIED COMPLETE |
| `*` (public) | `/login` | VERIFIED COMPLETE |

## Risk register
- **Highest-risk change class** = touching the shell (Layout/Sidebar/Dock/Sheet) — locked by IA and mobile tests; **frozen** this round.
- Page-level changes must preserve accessible names asserted by dialog tests (`Add Expense`, etc.).
- No schema, RPC, or permission changes are part of interface rationalization.
