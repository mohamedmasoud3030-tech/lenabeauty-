# SHARED_COMPONENT_IMPROVEMENTS

| Component | Class | Problem | Improvement | Where | Priority | Migration | Verify |
|---|---|---|---|---|---|---|---|
| Modal | KEEP/IMPROVE | None structural | Reuse for POS price | POS | P0 | None | modal-overlay, pos-flow |
| PageHeader | KEEP | Not used on expenses/gift/inventory/employees | Adopt only where cheap; do not force | Gift cards | P1 | Optional | page-header.test |
| ScreenState / ListState | KEEP | — | Keep as the three-state owner | Lists | — | None | Existing |
| StatusPill | KEEP | Not universal | Do not replace local badges this round | — | — | None | — |
| StatCard | IMPROVE | `text-[8px]` | `text-[10px] sm:text-xs` | Dashboard | P1 | None | first-impression |
| QuickActionButton | IMPROVE | Arrow not RTL | `rtl:rotate-180` | Dashboard | P2 | None | Visual RTL |
| Layout / Dock / Sheet | KEEP | Locked by IA + mobile tests | Do not restyle | Shell | — | Forbidden | information-architecture, mobile-portrait-ux |
| Sidebar | KEEP | — | — | Desktop | — | None | IA-T18 |
| GlobalSearch | KEEP | — | — | Shell | — | None | global-search a11y |
| Toast / Confirm / ErrorBoundary / NetworkStatus | KEEP | — | — | App | — | None | — |
| ReceiptPreviewModal | KEEP | — | — | POS / customers | — | None | receipt-preview |
| Hand-rolled headers | IMPROVE later | Visual drift | Not a redesign this round | Expenses, inventory | P3 | None | — |

No new design system. No giant universal component. New UI only when POS price needs the existing Modal.
