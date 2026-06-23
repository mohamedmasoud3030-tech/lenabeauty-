# تقرير تدقيق توافق قاعدة البيانات — Kanzy v1.1
**التاريخ:** 2026-06-23  
**المصدر:** قراءة كاملة لـ repositories.ts + mappers.ts مقابل Supabase project: ktmizdznbdwvalmmfvfc

---

## الجداول المطلوبة (11 جدول + bucket)

| الجدول | يستخدمه |
|---|---|
| `centers` | Auth (getMyCenters join) + seed |
| `center_memberships` | Auth.getMyCenters |
| `center_settings` | Settings CRUD + Invoice print |
| `customers` | Customer CRUD + history + reports |
| `employees` | Employee CRUD + Dashboard PnL |
| `services` | Service CRUD + invoice join |
| `products` | Product CRUD + inventory report + invoice join |
| `appointments` | Appointment CRUD + reports |
| `expenses` | Expense CRUD + Dashboard PnL |
| `invoices` | Invoice checkout + print + reports |
| `invoice_items` | Invoice print + sales report |
| `storage: center-assets` | Settings.uploadLogo |

---

## الأعمدة الحرجة لكل جدول

### customers
`id, name, category, phone, email, notes, total_spent, loyalty_points, last_visit, created_at, updated_at`

### employees  ⚠️ عمود خاص
`id, name, phone, role, salary, base_salary, commission_percentage, is_active, created_at, updated_at`  
**+ `month_commission_total`** — يُستخدم في Dashboard.getPnlMonth. إذا غاب → Dashboard PnL لا يعمل.

### services
`id, name, category_id (nullable), price, duration_minutes, is_active, created_at, updated_at`

### products
`id, name, barcode (nullable), price, cost, stock_quantity, created_at, updated_at`  
Dashboard يفلتر: `WHERE stock_quantity <= 5`

### appointments  ⚠️ ENUM حرج
`id, customer_id, employee_id (nullable), service_id (nullable), date_time, status, notes, created_at, updated_at`  
**status** يجب أن يكون PostgreSQL ENUM: `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`  
الكود يرفض أي قيمة خارج هذه الأربعة بـ mapping error.

### expenses
`id, amount, category, description (nullable), date, created_at`  
ملاحظة: `updated_at` غير موجود في mapper (لا يحتاجه).

### invoices
`id, customer_id, serial_number (nullable), date, total_amount, discount, loyalty_points_used, payment_method, created_at, updated_at`

### invoice_items
`id, invoice_id, service_id (nullable), product_id (nullable), price, quantity, created_at`  
Invoice print يعمل JOIN: `services(name)` و `products(name)`

### center_settings
`center_id (PK/FK), name, currency, tax_rate, logo_path, address, phone, cr, postal_code, created_at, updated_at`

### center_memberships
`user_id (FK→auth.users), center_id (FK→centers)`  
getMyCenters يعمل: `.select('center_id, centers(name)')`

---

## إعداد Auth.users Metadata  ⚠️ مهم جداً

عند إنشاء المستخدم في Supabase Auth، يجب إضافة `user_metadata`:

```json
{
  "role": "ADMIN",
  "name": "اسم المستخدم"
}
```

القيم المقبولة لـ `role`: `ADMIN` | `MANAGER` | `STAFF`  
إذا كان الـ role مفقود أو غير صحيح → الكود يُرجع `MISSING_OR_INVALID_ROLE` ولا يسمح بالدخول.

**خطوات إضافة المستخدم الأول:**
1. Supabase Dashboard → Authentication → Users → Add User
2. أدخل email + password
3. في `user_metadata` أضف: `{"role": "ADMIN", "name": "المدير"}`
4. أضف صف في `center_memberships`: `(user_id, '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d')`

---

## RPC المطلوب (مرحلة مستقبلية)

| RPC | يستخدمه |
|---|---|
| `process_checkout_v1` | Invoice.checkout (POS) |

الكود يتعامل مع غياب الـ RPC بشكل آمن (`PGRST202` → `BACKEND_METHOD_UNSUPPORTED`).

---

## الخطوات المطلوبة الآن

1. **Supabase → SQL Editor** → الصق محتوى `supabase/migrations/20260623000001_initial_schema.sql` واضغط Run
2. **Authentication → Users** → أضف أول مستخدم (admin) مع `user_metadata.role = "ADMIN"`
3. **أضف صف في center_memberships** ليربط المستخدم بالمركز
4. **Vercel → Settings → Environment Variables** → أضف المتغيرات الخمسة → Redeploy
