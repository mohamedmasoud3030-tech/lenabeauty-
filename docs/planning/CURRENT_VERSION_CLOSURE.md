# CURRENT VERSION CLOSURE — v1.0

v1.0 is the first customer-deployable Supabase PWA.

Product position:

- hosted single-customer, single-center Supabase PWA.
- not multi-customer SaaS.
- not Windows Desktop EXE.

Release gate:

- Supabase configuration is required.
- login works with real auth.
- implemented CRUD is tested in browser.
- Preview Mode is not a valid product, demo, fallback, sales, or release-verification path.
- missing or invalid env shows a blocking setup error.
- unsupported backend features show explicit unsupported messaging.

Expense.update note:

The domain port and Supabase adapter contract already exist. The real update implementation and edit UI are v1.1 work unless completed and tested earlier.

Deferred to v1.1:

- checkout finalization.
- invoice/payment persistence.
- full financial reports.
- settings mutations where unsupported.
- expense edit UI.
- receipt print layout.
- performance/code splitting.
