# Pre-Supabase Integration Architecture & Readiness Blueprint

> Historical note: This plan predates the locked v1.0 decision to remove Preview Mode. Current implementation instructions are in `docs/NEXT_IMPLEMENTATION_REMOVE_PREVIEW_MODE.md`; v1.0 must boot only through Supabase and fail hard on missing or invalid configuration.

## Date: June 4, 2026

This document maps out the system architecture and provides a prescriptive plan for swapping the current in-memory Preview Infrastructure Adapters with fully integrated **Supabase Client Adapters** as part of a future deployment phase. 

---

## 1. Final Repository Inventory

The following table documents the frozen domains, their interfaces, operations, and current status:

| Domain Area | Operations | Repository Port (Interface) | Current Preview Adapter Implementation | coupling to In-Memory Assumptions / Runtime State change |
| :--- | :--- | :--- | :--- | :--- |
| **Session / Auth** | `login`, `logout`, `getSession` | `AuthRepository` | `PreviewAuthAdapter` | Returns hardcoded `preview` user and tokens. Safe but read-only. |
| **Customers** | `list`, `getById`, `create`, `update`, `delete`, `getHistory` | `CustomerRepository` | `PreviewCustomerAdapter` | No in-memory state; mutations fail with `PREVIEW_READ_ONLY`. Safe and isolated. |
| **Employees**| `list`, `create`, `update`, `delete` | `EmployeeRepository` | `PreviewEmployeeAdapter` | List returns `[]`. Safe and isolated. |
| **Services** | `list`, `create`, `update`, `delete` | `ServiceRepository` | `PreviewServiceAdapter` | List returns `[]`. Safe and isolated. |
| **Products** | `list`, `listFull`, `create`, `update`, `delete` | `ProductRepository` | `PreviewProductAdapter` | List returns `[]`. Safe and isolated. |
| **Appointments** | `list`, `create`, `update`, `delete` | `AppointmentRepository` | `PreviewAppointmentAdapter` | List returns `[]`. Safe and isolated. |
| **Invoices / POS**| `checkout`, `getForPrint` | `InvoiceRepository` | `PreviewInvoiceAdapter` | Checkout returns preview error codes safely. Safe and isolated. |
| **Expenses** | `list`, `create`, `delete` | `ExpenseRepository` | `PreviewExpenseAdapter` | List returns `[]`. Safe and isolated. |
| **Settings** | `get`, `update`, `uploadLogo`, `backup`, `exportData`, `restore` | `SettingsRepository` | `PreviewSettingsAdapter` | Returns standard config, backup mock-succeeds inside sandbox. Safe and isolated. |
| **Reports** | `getSales`, `getAppointments`, `getInventory` | `ReportRepository` | `PreviewReportAdapter` | Filters mock-return metrics. Safe and isolated. |

---

## 2. Entity-to-Table Planning Map

Before introducing tables into Supabase, the TypeScript models from `src/domain/entities/index.ts` must map cleanly onto physical Postgres relational tables:

```
               [customers]                   [employees]
              (id PK UUID)                  (id PK UUID)
                   |                             |
                   | 1                           | 1
                   |                             |
                   | M (customerId)              | M (employeeId)
                   +-------------+  +------------+
                                 |  |
                                 V  V
                            [appointments] <------+ 1
                             (id PK UUID)         | (serviceId)
                                                  |
                                                  | M
               [products]                     [services]
              (id PK UUID)                  (id PK UUID)
                   |                             |
                   | 1                           | 1
                   |                             |
                   | M (productId)               | M (serviceId)
                   +-------------+  +------------+
                                 |  |
                                 V  V
                            [invoice_items]
                             (id PK UUID)
                                  | M
                                  | (invoiceId)
                                  V
                              [invoices] (Total, Date)
                             (id PK UUID)
```

### Table Specifications:

1. **`customers`**
   - `id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
   - `name`: `VARCHAR(255)` (Not Null)
   - `phone`: `VARCHAR(50)` (Nullable)
   - `email`: `VARCHAR(255)` (Nullable)
   - `notes`: `TEXT` (Nullable)
   - `total_spent`: `NUMERIC(12, 2)` (Default: `0.00`)
   - `loyalty_points`: `INTEGER` (Default `0`)
   - `created_at`: `TIMESTAMPTZ` (Default: `now()`)
   - `updated_at`: `TIMESTAMPTZ` (Default: `now()`)

2. **`employees`**
   - `id`: `UUID` (Primary Key, Default: `gen_random_uuid()`)
   - `name`: `VARCHAR(255)` (Not Null)
   - `role`: `VARCHAR(100)` (Not Null, Stylist/Admin/etc.)
   - `phone`: `VARCHAR(50)` (Nullable)
   - `salary`: `NUMERIC(12, 2)` (Not Null, Base salary)
   - `commission_percentage`: `NUMERIC(5, 2)` (Not Null, Default: `0.00`)
   - `is_active`: `BOOLEAN` (Default: `true`)
   - `username`: `VARCHAR(200)` (Unique, Nullable - used for employee logging keys)
   - `created_at`: TIMESTAMPTZ (Default: `now()`)
   - `updated_at`: TIMESTAMPTZ (Default: `now()`)

3. **`services`**
   - `id`: `UUID` (Primary Key)
   - `name`: `VARCHAR(255)` (Not Null)
   - `category_id`: `VARCHAR(100)` (Not Null)
   - `price`: `NUMERIC(10, 2)` (Not Null)
   - `duration_minutes`: `INTEGER` (Not Null)
   - `is_active`: `BOOLEAN` (Default: `true`)
   - `created_at`: TIMESTAMPTZ (Default: `now()`)
   - `updated_at`: TIMESTAMPTZ (Default: `now()`)

4. **`appointments`**
   - `id`: `UUID` (Primary Key)
   - `customer_id`: `UUID` (Foreign Key -> `customers.id` ON DELETE CASCADE)
   - `employee_id`: `UUID` (Foreign Key -> `employees.id` ON DELETE SET NULL)
   - `service_id`: `UUID` (Foreign Key -> `services.id` ON DELETE SET NULL)
   - `date_time`: `TIMESTAMPTZ` (Not Null)
   - `status`: `VARCHAR(50)` (Not Null, SCHEDULED, COMPLETED, CANCELLED)
   - `notes`: `TEXT` (Nullable)
   - `created_at`: `TIMESTAMPTZ`
   - `updated_at`: `TIMESTAMPTZ`

5. **`products`**
   - `id`: `UUID` (Primary Key)
   - `name`: `VARCHAR(255)` (Not Null)
   - `barcode`: `VARCHAR(100)` (Nullable, Unique Index)
   - `stock_quantity`: `INTEGER` (Not Null, Default: `0`)
   - `price`: `NUMERIC(10, 2)` (Not Null)
   - `cost`: `NUMERIC(10,2)` (Not Null)

6. **`invoices`**
   - `id`: `UUID` (Primary Key)
   - `serial_number`: `SERIAL` (Auto-incrementing, human readable sequence)
   - `date`: `TIMESTAMPTZ` (Default: `now()`)
   - `total_amount`: `NUMERIC(15, 2)` (Not Null)
   - `discount`: `NUMERIC(10, 2)` (Default `0.00`)
   - `loyalty_points_used`: `INTEGER` (Default `0`)
   - `payment_method`: `VARCHAR(50)` (Not Null)
   - `customer_id`: `UUID` (Foreign Key -> `customers.id` ON DELETE CASCADE)

7. **`invoice_items`**
   - `id`: `UUID` (Primary Key)
   - `invoice_id`: `UUID` (Foreign Key -> `invoices.id` ON DELETE CASCADE)
   - `service_id`: `UUID` (Foreign Key -> `services.id` ON DELETE SET NULL)
   - `product_id`: `UUID` (Foreign Key -> `products.id` ON DELETE SET NULL)
   - `price`: `NUMERIC(10, 2)` (Not Null)
   - `quantity`: `INTEGER` (Not Null)

8. **`expenses`**
   - `id`: `UUID` (Primary Key)
   - `amount`: `NUMERIC(12, 2)` (Not Null)
   - `category`: `VARCHAR(150)` (Not Null)
   - `description`: `TEXT` (Nullable)
   - `date`: `TIMESTAMPTZ` 

9. **`center_settings`**
   - `id`: `VARCHAR(10)` (Primary Key, locked to `'1'`)
   - `name`: `VARCHAR(255)`
   - `currency`: `VARCHAR(10)`
   - `tax_rate`: `NUMERIC(5, 2)`
   - `logo_path`: `TEXT`
   - `address`: `TEXT`
   - `phone`: `VARCHAR(50)`
   - `cr`: `VARCHAR(100)` (Commercial identity)

---

## 3. Essential Database Queries

When writing the Supabase Service Adapters, they will use these primary query mechanisms:

### Read Queries:
```ts
// Loading Appointments with unified customer, employee, and service details
const { data, error } = await supabase
  .from('appointments')
  .select(`
    *,
    customer:customers(*),
    employee:employees(*),
    service:services(*)
  `)
  .gte('date_time', fromISO)
  .lte('date_time', toISO);

// Fetching Customer History (Parallel fetch)
const fetchHistory = async (id: string) => {
  const [appointments, invoices] = await Promise.all([
    supabase.from('appointments').select('*').eq('customer_id', id),
    supabase.from('invoices').select('*, items:invoice_items(*, service:services(name), product:products(name))').eq('customer_id', id)
  ]);
};
```

### Write/Transactional Operation (Checkout):
```ts
// Transaction simulation via single RPC procedure (recommended) or sequential inserts:
const checkoutInvoice = async (payload: CheckoutPayload) => {
  // 1. Insert invoice header records
  // 2. Insert transaction item arrays
  // 3. Decrement product inventories (stock_quantity = stock_quantity - quantity)
  // 4. Increment customer totals (total_spent = total_spent + earned_revenue, loyalty_points = loyalty_points + points)
};
```

---

## 4. Authentication, Permissions, & RLS Scenarios

Postgres Row Level Security (RLS) policies should enforce tenant isolation based on role:

1. **Managerial Settings RLS Restriction rule**:
   ```sql
   CREATE POLICY "Allow write block to Administrators/Managers only" ON "center_settings"
     FOR UPDATE
     USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('ADMIN', 'MANAGER')));
   ```
2. **Access Control (Permissions checking)**:
   - Administrators can perform read + write across all tables.
   - Staff/Stylists can read services, list products, create/update appointments, but are restricted from altering expenses, viewing aggregate profit-and-loss balances on dashboards, or altering base wages inside the `employees` domain.

---

## 5. Unresolved Business Metrics Clarifications

Before remote database tables are deployed, the business needs to clarify these items to avoid structural conflicts:
* **Tax Calculation Boundaries**: Does POS checkout total include or exclude tax? Should we store gross amounts, net tax amounts, or compute dynamically in Postgres triggers?
* **Loyalty Ratio Rule**: How many loyalty points are earned per local currency (OMR) spent? How do points map back to physical currency discounts during active POS sessions?
* **Auto-Increment Invoice Serial Number**: Should serial numbers reset every calendar year, or maintain a strict incremental sequence indefinitely?

---

## 6. Suggested Adapter Replacement Order

To ensure a smooth migration flow with minimal code displacement, it is advised to replace the Preview Mode adapters in this order:

1. **`SettingsAdapter` / `AuthAdapter`**: Establish foundational session tokens, retrieve active configuration variables first.
2. **`ServiceAdapter` / `ProductAdapter` (Static Config tables)**: Populate dropdown catalogs and validation items.
3. **`CustomerAdapter` / `EmployeeAdapter`**: Active reference profiles accessed by transactions.
4. **`AppointmentAdapter` / `InvoiceAdapter`**: Central POS transaction flows and calendar bookings.
5. **`ExpenseAdapter` / `ReportAdapter`**: Consolidates active transactional feeds to compile reports.

---

## 7. Risks and Blockers
* **Cold Starts on Severless Integrations**: Real-time POS checkout loops might face slight database cold-start delays if the serverless Postgres tier hibernates during low-traffic periods.
* **Storage quota limits for Logo Asset Uploads**: If managers upload massive raw PNG configurations for center logos, the DB storage quotas could get saturated quickly. Implementing client-side compression is recommended.
