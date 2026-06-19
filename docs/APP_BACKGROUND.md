# App Background

## Product Identity
This is a single service-center / single-branch SPA (Single Page Application) management app tailored for basic configurations such as Salons or Service Clinics.

## Main Modules
- Login
- Dashboard
- Customers
- Appointments
- Services
- POS / Invoices
- Inventory / Products
- Expenses
- Employees
- Reports
- Settings

## Product Runtime
v1.0 production readiness is defined only by Supabase mode with real authentication, real CRUD persistence, and browser QA against a configured Supabase project.

### Supabase Mode
- **Purpose**: The real persistence mode backing the operational application logic.
- **Requirements**: Requires validated configuration credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and a legitimate `VITE_CENTER_ID` parameter passed correctly to boot successfully.
- **Release rule**: `VITE_DATA_BACKEND=supabase` is the only valid v1.0 product, sales, demo, or release-verification path.

### Preview Code Path
- **Status**: Legacy local inspection/test code path only.
- **Limitations**: Injects a deterministic mock center ID (`00000000-0000-4000-8000-000000000001`) and returns empty models or read-only errors.
- **Release rule**: Preview Mode is not a valid setup, fallback, demo, sales, or product-readiness path.

## Internationalization and Layout
- **Languages**: The interface translates across Arabic and English mapping states dynamically through `i18n.ts`.
- **Layouts**: RTL (Right-to-Left) and LTR (Left-to-Right) UI flipping capabilities natively maintained.

## Known Completed Stabilization
- Supabase mode configuration errors surface as visible blocking setup errors.
- Misconfigurations produce direct, gracefully localized, visible errors upon initialization instead of crashing silently in console trace errors.
- Stable testing logic (`src/__tests__/initialization.test.tsx`) prevents contextual regressions within the loader framework limits.
- Established ongoing refactoring replacing static dimension variables (`ml-`, `pr-`) with standard logical classes natively compatible with Tailwind configurations (`ms-`, `pe-`).
