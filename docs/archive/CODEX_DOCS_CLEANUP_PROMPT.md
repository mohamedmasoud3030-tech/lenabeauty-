# CODEX DOCS CLEANUP PROMPT
**Branch:** docs-v1-v2-v3-source-of-truth  
**Purpose:** Instructions for the next implementation PR that resolves remaining v1.0 blockers.  
**Scope of THIS branch:** Documentation normalization only. No feature code changes.

---

## LOCKED DECISIONS — DO NOT CONTRADICT IN ANY DOCUMENT

| Decision | Status |
|---|---|
| Preview Mode is **completely removed** from source | ✅ Done — do not re-add |
| `VITE_DATA_BACKEND=preview` → `EnvironmentConfigurationError` | ✅ Done — do not revert |
| `BackendMode = "supabase"` only | ✅ Done |
| v1.0 = single-customer, single-center Supabase PWA | Planning phase |
| v1.1 = checkout, print, reports, settings mutations, expense edit, code-split | Code-ready, DB pending |
| v2.0 = Windows Desktop EXE (Tauri v2 + SQLite) — **document only, do not implement** | Future |
| `Expense.update` contract exists in port + adapter (returns `BACKEND_METHOD_UNSUPPORTED`). Edit UI is v1.1. | ✅ Verified |

---

## SEARCH COMMAND (run first before any change)

```bash
grep -rn "preview\|Preview\|PREVIEW\|demo mode\|fake\|Expense\.update missing\|multi-customer SaaS\|VITE_DATA_BACKEND=preview" docs/ src/ .env.example 2>/dev/null
```

**Expected results:**
- `src/`: zero hits for `preview|Preview|PREVIEW` (already removed)
- `docs/`: hits only in historical/certified files (CERTIFICATION.md, PHASE_10A.6*, etc.) — acceptable as historical record
- `.env.example`: must only show `VITE_DATA_BACKEND=supabase`

---

## SCHEMA FILE REFERENCE

The canonical schema files are:

| File | Purpose | State |
|---|---|---|
| `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` | v1.0 base tables + RLS | Final — apply to staging |
| `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` | invoices + checkout RPC | Final — apply for v1.1 |

All documentation references to schema setup must use these exact filenames.

---

## REQUIRED NEXT ACTIONS (for the IMPLEMENTATION PR — not this docs branch)

### 1. Write `docs/CUSTOMER_DEPLOYMENT_GUIDE.md`
This file does not yet exist. It must be written before v1.0 ships.

Required sections:
- Step 1: Create a Supabase project
- Step 2: Apply `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql`
- Step 3: Create first admin user
- Step 4: Create center row + membership (SQL snippet)
- Step 5: Deploy web app (Vercel env vars OR self-hosted)
- Step 6: First login walkthrough
- Step 7: Add staff users

---

### 2. Execute `docs/SUPABASE_LIVE_QA_RUNBOOK.md` against staging Supabase

This is not a code task — it's a QA session. Requires:
- A real Supabase project with base schema applied
- `.env.local` configured
- A human running `npm run preflight:supabase` then testing all CRUD in the browser

**After QA:** Sign off `docs/MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`.

---

### 3. Arabic RTL device testing

Test on a real Android device (Chrome) and real iOS device (Safari). Document results.

---

### 4. (v1.1 only) Implement Settings mutations

Currently all return `BACKEND_METHOD_UNSUPPORTED`. v1.1 requires:
- `SupabaseSettingsAdapter.update(data)` → UPDATE centers SET ...
- `SupabaseSettingsAdapter.uploadLogo(file)` → Supabase Storage
- `SupabaseSettingsAdapter.exportData()` → JSON blob
- `SupabaseSettingsAdapter.backup()` + `restore(data)`

---

### 5. (v1.1 only) Implement `SupabaseExpenseAdapter.update()` real SQL

Currently at `repositories.ts` line 666 — returns `BACKEND_METHOD_UNSUPPORTED`.

Replace with:
```typescript
async update(id: string, data: Partial<Expense>): Promise<Result<Expense, DomainError>> {
  const centerRes = getCenterIdFor("Expense.update");
  if (!centerRes.ok) return centerRes as any;
  
  const { data: updated, error } = await getSupabaseClient()
    .from("expenses")
    .update({ amount: data.amount, category: data.category, description: data.description })
    .eq("id", id)
    .eq("center_id", centerRes.data)
    .select()
    .single();
    
  if (error) return { ok: false, error: createQueryError("Expense.update", error) };
  return { ok: true, data: mapExpense(updated) };
}
```

---

### 6. (v1.1 only) Bundle code-split

Convert all page imports in `src/routes.tsx` to `React.lazy()`. Wrap all route segments in `<Suspense>`. Target: initial JS chunk < 400 kB.

---

## THINGS TO NOT DO

| Do NOT | Reason |
|---|---|
| Add `VITE_DATA_BACKEND=preview` back to `.env.example` | Preview Mode is removed |
| Say `Expense.update` is "missing from the domain port" | It exists — only the real SQL is missing |
| Describe v1.0 as "multi-customer SaaS" | v1.0 is single-customer |
| Implement Desktop EXE in this or any v1.x branch | v2.0 only — document, don't build |
| Touch remote Supabase production | Local and staging only |
| Apply `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` during v1.0 QA | Phase 10B is v1.1 |
| Mark live QA as passed without actually running it | No fake completions |

---

## PHASE MODEL REFERENCE (for all docs — do not contradict)

```
v1.0  Single-customer Supabase PWA
      ├─ Real auth (Supabase)
      ├─ Real CRUD: customers, appointments, services, employees, products, expenses
      ├─ Operational reports (appointments, inventory)
      ├─ Preview Mode: REMOVED ✅
      └─ Status: Code ready — QA and Supabase setup pending

v1.1  Financial Layer + Performance
      ├─ POS Checkout (Phase 10B SQL + existing adapter)
      ├─ Invoice print (80mm thermal + PDF)
      ├─ Financial dashboard (P&L, revenue chart)
      ├─ Sales reports
      ├─ Customer history
      ├─ Settings mutations (logo, update, export, backup/restore)
      ├─ Expense edit UI
      └─ Bundle code-split (performance)

v2.0  Windows Desktop EXE — FUTURE, NOT STARTED
      ├─ Tauri v2 packaging
      ├─ SQLite local database (replaces Supabase)
      ├─ Local auth (bcrypt, no JWT)
      ├─ Local migrations (auto-run on startup)
      ├─ Backup/restore (SQLite file copy)
      ├─ Arabic RTL in WebView2
      └─ Optional cloud sync (v2.1, not v2.0)
```
