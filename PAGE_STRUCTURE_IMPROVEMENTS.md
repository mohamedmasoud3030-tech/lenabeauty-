# PAGE_STRUCTURE_IMPROVEMENTS

| Decision | Where | Evidence | User impact | Roles | Deps | Risk | Verify |
|---|---|---|---|---|---|---|---|
| **Keep as is** | Login, Reports, Appointments schedule, Action Center sections, Settings tabs, workforce dialogs, deferred routes, visit→POS | Tests lock IA, mobile dock, visit checkout | No disruption | All | — | None | Existing suites |
| **Improve** | Dashboard exceptions | Two panels, same low-stock rows | One place to act | Auth | DashboardPage | Low | first-impression E2 still matches |
| **Improve** | POS starting-from | `window.prompt` | Price stays in product UI | Auth | PosInvoicesPage + Modal | Low | pos-flow |
| **Improve** | Customers search/table | Duplicate search; `py-8` | Faster find | Auth | CustomersPage | Low | customers-dialog |
| **Improve** | Expenses density/money/locale | Sparse + 2dp + ar-OM | Readable costs | ADMIN | ExpensesPage | Low | expenses-dialog |
| **Improve** | Gift card / package forms | Placeholder-only | Screen reader + mobile | Auth | those pages | Low | gift-cards tests |
| **Move section** | Dashboard Needs Attention into the right column of today | Replaces Operational Alerts | Less scroll | Auth | DashboardPage | Low | Visual + first-impression |
| **Do not consolidate** | Dashboard vs Action Center | Different jobs (overview vs work queue) | Keep both; stop copying | Auth | — | — | — |
| **Do not merge** | Gift Cards and Packages | Different instruments | Keep separate | Auth | optionalModule flags | — | IA tests |
| **Do not remove** | Any live route | Saved links | — | — | routes.tsx | High if removed | IA-T1 |

No route or capability is removed.
