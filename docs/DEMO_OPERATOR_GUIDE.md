# Supabase Operator QA Guide

This guide is for v1.0 browser QA and customer-facing walkthrough preparation against real Supabase data.

Preview Mode is not a valid setup, fallback, demo, sales, or release-verification path.

## 1. Required Runtime

Use a configured Supabase environment:

- `VITE_DATA_BACKEND=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_CENTER_ID`
- `VITE_BRANCH_MODE=single`

## 2. Approved v1.0 Positioning

Present v1.0 as a hosted single-customer, single-center Supabase PWA for daily spa/service-center operations.

Do not present v1.0 as:

- multi-customer SaaS.
- complete POS/accounting.
- offline desktop software.
- Windows EXE.
- Preview/demo-mode product.

## 3. Browser QA Walkthrough Order

1. Login with a real Supabase user assigned to the configured center.
2. Verify Dashboard operational counts only.
3. Flip English/Arabic and confirm RTL/LTR layout behavior.
4. Verify Customers CRUD against Supabase.
5. Verify Services CRUD against Supabase.
6. Verify Appointments CRUD against Supabase.
7. Verify Products/Inventory CRUD against Supabase.
8. Verify Expenses list/create/delete against Supabase.
9. Verify Employees CRUD against Supabase.
10. Verify unsupported v1.1 features fail with explicit unsupported messaging.

## 4. Deferred v1.1 Demonstrations

Do not demonstrate these as available until implemented and browser-tested:

- Checkout.
- Receipt/invoice print.
- Sales/revenue/financial reports.
- Settings mutations.
- Expense edit UI and real Supabase update implementation.
- Customer history.

## 5. Future v2.0 Direction

Windows Desktop EXE is a v2.0 direction only and requires Tauri v2, SQLite, local auth, and local backup/export.
