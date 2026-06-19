# Product Decisions

- **Single Center / Single Branch Only**: The application architecture explicitly services simple localized environments. Multi-center hierarchical organizational structures must not be implemented.
- **No SaaS Scope**: Do not introduce subscription logic, tenant membership onboarding, or comprehensive generic platform SaaS capabilities into the app context.
- **Tenant Context Freeze**: The `tenantContext` module, if present in legacy components, must rigidly constrain to identifying single-branch session credentials. Under no context must it expand to support logical multi-tenancy.
- **Mock Center ID Constraints**: Injecting or evaluating mock deterministic Center ID UUIDs is allowed only inside legacy Preview local inspection/tests. It is not valid product, demo, fallback, sales, or release-verification behavior.
- **Supabase as Source of Truth**: Remote Supabase integrations operate as the single source point of functional correctness.
- **Truth in Financials**: Rendered statistical metrics (Financials, KPIs, reporting aggregates) must natively extrapolate directly from successfully transacted Supabase records. Mocking, fabricating, or artificially defaulting these numbers in the actual UI layer is strictly prohibited for v1.0 readiness.
- **Visible Failures**: Invoking unsupported or incomplete API methods within adapter layers MUST precipitate deliberate, safely translated UX failures indicating connection faults, rather than resolving silently leading to data illusions. 
- **Evidence-Backed Readiness**: No product validation claims of "Production Ready", "Testing Passed", or "Completed Implementation" are valid decoupled from genuine database runtime environments checks and strictly enforced pipeline suites (`npm run build`, `vitest`).
