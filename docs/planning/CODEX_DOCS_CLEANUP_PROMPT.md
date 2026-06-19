# Codex Docs Cleanup Prompt

Documentation cleanup must preserve this product phase model:

- v1.0 = Supabase PWA, real auth, real CRUD, browser QA, no Preview Mode as a valid product/demo/fallback path.
- v1.1 = checkout, print, reports, settings mutations, expense edit, performance polish.
- v2.0 = Windows Desktop EXE using Tauri v2 + SQLite + local auth + local backup/export.

Documentation cleanup rules:
- Do not implement product features.
- Do not touch Supabase production, Vercel production, or cloud resources.
- Active docs must not describe Preview Mode as a valid setup, fallback, demo, or sales path.
- `.env.example` must recommend `VITE_DATA_BACKEND=supabase`.
- Do not say `Expense.update` is missing from the domain port. The domain port and Supabase adapter contract already exist; the real Supabase update implementation and edit UI are v1.1 work unless implemented and tested earlier.
- v1.0 is single-customer, single-center hosted Supabase PWA, not multi-customer SaaS.
- Keep RLS/data isolation verification as production data-safety, not SaaS positioning.
- Keep Windows EXE as v2.0 future direction only.
- Keep references to `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` when the file exists.

