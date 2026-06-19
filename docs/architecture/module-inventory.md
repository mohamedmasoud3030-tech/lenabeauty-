# Module Inventory

## Existing Modules

### Pages
- **AppointmentsPage**: Scheduling calendar and client booking views.
- **CustomersPage**: Client registry and historical data views.
- **DashboardPage**: Landing summary metrics and revenue charting.
- **EmployeesPage**: Staff lists, assignment rules, roles.
- **ExpensesPage**: Registry for financial outgoing transactions.
- **InventoryPage**: Product stock lists and management utilities.
- **LoginPage**: System entry point handling Supabase authentication and visible setup errors.
- **PosInvoicesPage**: Checkout screen generating historical record transactions.
- **ReportsPage**: Graphical data overviews per time constraints.
- **ServicesPage**: Configurable settings targeting specific products provided directly using manpower.
- **SettingsPage**: Platform-wide organizational system settings configurations.

### Security Layouts & Guards
- `route-guards.tsx`: Implements role detection (`RequireAuth`, `RequireAdmin`) for authenticated routing state.
- `AppRoutes`: Provides centralized hierarchy tracking layout scopes.

### Infrastructure Domains
- `infrastructure/preview`: Contains legacy read-only mock structures for local inspection/tests only. It is not a valid v1.0 demo, fallback, sales, or release-verification path.
- `domain/entities`: Defines typed properties surrounding physical features such as `Service`, `Customer`, `Employee`.
- `config/env`: Isolated loader reading Vite configuration attributes without cluttering downstream usage behaviors.

## Placeholder Behaviors
Supabase mapping remains entirely disconnected, deferring operational data mapping explicitly using `DomainErrors (INFRASTRUCTURE_ERROR, AUTH_NOT_CONFIGURED)`.
