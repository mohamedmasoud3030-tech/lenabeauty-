# RBAC and Authorization Matrix

## Roles
- **ADMIN**: Has unrestricted access to all operations in the platform including System Configurations.
- **MANAGER**: Has access to all reports, appointments, products, and employee schedules, but may not modify core system behaviors or view overarching system configurations.
- **STAFF**: Read-only restrictions for global data. Can only manipulate assignments targeting themselves explicitly. Cannot see financial reports or expenses lists.
- **PREVIEW**: Legacy local inspection/test role. All mutations fail at the structural adapter layer. It is not a valid v1.0 product, demo, fallback, sales, or release-verification role.

## Module Authorization Policy

| Module / Action   | Admin | Manager | Staff | Preview | Unauthenticated |
| ----------------- | ----- | ------- | ----- | ------- | --------------- |
| **Auth**          |
| Login             | Read  | Read    | Read  | Read    | Read (only login) |
| **Dashboard**     |
| View Summaries    | Grant | Grant   | Deny  | Read-Only| Deny            |
| **Appointments**  |
| Read All          | Grant | Grant   | Own   | Read-Only| Deny            |
| Create New        | Grant | Grant   | Deny  | Deny    | Deny            |
| **Customers**     |
| Read All          | Grant | Grant   | Grant | Read-Only| Deny            |
| Create / Update   | Grant | Grant   | Deny  | Deny    | Deny            |
| **Inventory**     |
| View Stock        | Grant | Grant   | Grant | Read-Only| Deny            |
| Modify Stock      | Grant | Grant   | Deny  | Deny    | Deny            |
| **Expenses**      |
| Read All          | Grant | Deny    | Deny  | Read-Only| Deny            |
| Add Expense       | Grant | Deny    | Deny  | Deny    | Deny            |
| **Reports**       |
| Read All          | Grant | Grant   | Deny  | Read-Only| Deny            |
| **Settings**      |
| View / Configure  | Grant | Deny    | Deny  | Read-Only| Deny            |

## RLS Preparation
This matrix serves as the direct map for generating Supabase Row Level Security (RLS) policies targeting production data-safety. RLS/data isolation verification is required for Supabase safety and is not SaaS positioning. The preview session is managed exclusively in frontend-state and is never propagated as an authenticated JWT into backend requests.
