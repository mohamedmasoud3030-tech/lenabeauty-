# NEXT VERSION PLAN — v1.1
**Prerequisite:** v1.0 release gate fully signed off — all items in `CURRENT_VERSION_CLOSURE.md` checked.  
**Goal:** Unlock POS billing, receipt printing, financial reporting, settings persistence, and mobile performance.

---

## CONTEXT: WHAT IS ALREADY CODE-COMPLETE

These features are **implemented in the Supabase adapters** on `main`. They only require the Phase 10B SQL to be applied to the live Supabase project:

| Feature | Location in source | Blocker |
|---|---|---|
| `Invoice.checkout` | `repositories.ts` line 689 | Phase 10B SQL not applied |
| `Invoice.getForPrint` | `repositories.ts` line 731 | Phase 10B SQL not applied |
| `Dashboard.getPnlMonth` | `repositories.ts` line 977 | Phase 10B SQL not applied |
| `Dashboard.getRevenueLast7Days` | `repositories.ts` line 1017 | Phase 10B SQL not applied |
| `Report.getSales` | `repositories.ts` line 1055 | Phase 10B SQL not applied |
| `Customer.getHistory` | `repositories.ts` line 244 | Phase 10B SQL not applied |

v1.1 **starts** by applying the Phase 10B SQL and **verifying** these adapters work end-to-end.

---

## PHASE 10B ACTIVATION (Week 1 of v1.1)

### Step 1 — Apply Checkout SQL to Production Supabase
**Owner:** DBA / DevOps  
**Effort:** 30 minutes

File: `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql`

Apply to production Supabase via SQL Editor. This creates:
- `invoices` table with RLS (staff can read, only RPC can write)
- `invoice_items` table with catalog constraint (service OR product, not both)
- `process_checkout_v1` RPC (SECURITY DEFINER, atomic transaction)
- Performance indexes

**Verify:**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'process_checkout_v1';
```
Must return one row.

### Step 2 — End-to-End POS Checkout QA
**Owner:** QA  
**Effort:** 4 hours

- [ ] Add customer + services to POS cart
- [ ] Click "Finalize Checkout" → success message + invoice number
- [ ] Invoice row exists in `invoices` table
- [ ] `invoice_items` rows match cart contents
- [ ] Customer loyalty points updated
- [ ] Product stock decremented (if product used)
- [ ] Checkout with empty cart → correct error, not crash
- [ ] Reprint previous invoice → correct data

### Step 3 — Receipt Print UI
**Owner:** Engineer (frontend)  
**Effort:** 2 days

`Invoice.getForPrint` adapter is ready. Need a print component:
- `src/components/InvoicePrintLayout.tsx` — 80mm thermal format
- Triggered after checkout success and via "Reprint" button
- CSS `@media print` isolates the receipt from app shell
- Arabic RTL in receipt
- Logo included if `settings.logoPath` is set

**QA:**
- [ ] A4 paper print works
- [ ] 80mm thermal print works
- [ ] Arabic text renders correctly
- [ ] Long service names wrap without cut-off

---

## FINANCIAL FEATURES (Week 2)

All adapters are implemented. This is integration + UI work only.

### Dashboard Financial Metrics
**Owner:** Engineer  
**Effort:** 2 days

Connect `getPnlMonth()` and `getRevenueLast7Days()` to `DashboardPage.tsx`:
- Monthly P&L card (revenue vs expenses)
- 7-day revenue sparkline using Recharts (already in dependencies)

### Sales Report
**Owner:** Engineer  
**Effort:** 2 days

Connect `Report.getSales(from, to)` to `ReportsPage.tsx`:
- Date range picker
- Sales breakdown table/chart (by service, by employee)

### Customer History
**Owner:** Engineer  
**Effort:** 1 day

Connect `Customer.getHistory(id)` to `CustomersPage.tsx`:
- "View History" button per customer row
- Modal showing appointments + invoices + total spent + loyalty points

---

## SETTINGS MUTATIONS (Week 3)

These adapters do not yet exist. Must implement in `SupabaseSettingsAdapter`:

### Settings.update
```typescript
async update(data: Partial<Center>): Promise<Result<Center, DomainError>> {
  const { data: updated, error } = await supabase
    .from("centers")
    .update({ name: data.name, currency: data.currency, ... })
    .eq("id", centerId)
    .select()
    .single();
  // map + return
}
```

### Settings.uploadLogo
- Upload to Supabase Storage bucket `center-logos`
- Update `centers.logo_path` with storage URL

### Settings.exportData
- Query all center entities, return as JSON blob

### Settings.backup / restore
- Backup: `exportData()` wrapped with schema version + timestamp
- Restore: validate schema version, upsert all entities

**QA:**
- [ ] Center name update persists on reload
- [ ] Logo upload appears in settings and receipt
- [ ] Export JSON file is valid and complete
- [ ] Backup file restores all data

---

## EXPENSE EDIT UI (Week 3 — parallel)

**Effort:** 1 day

The domain port and adapter contract already exist (`repositories.ts` line 666 — returns `BACKEND_METHOD_UNSUPPORTED`).

1. Implement real `SupabaseExpenseAdapter.update()`:
   ```typescript
   async update(id: string, data: Partial<Expense>) {
     const { data: updated, error } = await supabase
       .from("expenses")
       .update({ amount: data.amount, category: data.category, description: data.description })
       .eq("id", id)
       .eq("center_id", centerId)
       .select()
       .single();
     // map + return
   }
   ```
2. Add "Edit" button to `ExpensesPage.tsx` row
3. Inline edit form matching create form pattern

**QA:**
- [ ] Edit expense amount → persists on reload
- [ ] Edit expense category → persists on reload

---

## PERFORMANCE — BUNDLE CODE-SPLIT (Week 4)

**Effort:** 2 days  
**Current:** 1,325 kB single JS chunk — slow on mobile

Convert all page imports in `src/routes.tsx` to `React.lazy()`:

```typescript
// Before
import DashboardPage from "./pages/DashboardPage";

// After
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
```

Wrap all routes in `<Suspense fallback={<LoadingSpinner />}>`.

**Expected result:** Initial chunk < 400 kB. Each page loads on first navigation.

**QA:**
- [ ] First load < 3s on 4G mobile (Chrome DevTools throttle)
- [ ] No flash of unstyled content
- [ ] All pages function correctly after split

---

## STUB CLEANUP (Week 4 — parallel)

| Stub | Location | Action |
|---|---|---|
| `sendReminder` returns silent `ok: true` | `useCases.ts` | Remove button or implement via Edge Function |
| `getActivityFeed` returns `[]` | `DashboardPage.tsx` | Add `activity_logs` table + adapter, or remove the feed |

---

## V1.1 RELEASE GATE

| Gate | Criteria |
|---|---|
| Phase 10B SQL applied | DBA confirmed |
| POS checkout QA passed | Real Supabase transaction verified |
| Receipt print QA passed | A4 + 80mm verified |
| Financial dashboard shows real data | QA verified |
| Sales report shows real data | QA verified |
| Customer history works | QA verified |
| Settings mutations work | QA verified (name, logo, export, backup/restore) |
| Expense edit works | QA verified |
| Bundle split complete | Initial chunk < 400 kB |
| `tsc --noEmit` clean | ✅ 0 errors |
| `vitest run` all pass | ✅ 74+ tests |
| `npm run build` success | ✅ PWA builds |

---

## IMPLEMENTATION ORDER (do not parallelize across dependencies)

```
1. Apply Phase 10B SQL            ← gates all financial work
2. POS checkout QA                ← verify adapter works end-to-end
3. Receipt print UI               ← depends on checkout
4. Financial dashboard            ← depends on Phase 10B
5. Sales report                   ← depends on Phase 10B
6. Customer history               ← depends on Phase 10B
7. Settings.update + uploadLogo   ← independent, can start anytime
8. Settings.exportData + backup   ← depends on Settings.update
9. Expense.update adapter + UI    ← independent, can start anytime
10. Bundle code-split             ← last, no dependencies
11. Stub cleanup                  ← parallel with 10
```

---

## EFFORT SUMMARY

| Feature | Effort |
|---|---|
| Phase 10B activation + checkout QA | 1 week |
| Financial features (dashboard, reports, history) | 1 week |
| Settings mutations | 1 week |
| Expense edit | 1 day |
| Bundle code-split + stub cleanup | 1 week |
| **Total** | **~4–5 weeks** |
