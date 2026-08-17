# ARCHITECTURE — LenaBeauty

**تاريخ التحقق:** 2026-08-17
هذه الوثيقة تصف الكود التنفيذي الحالي، ولا تصف خطة مستقبلية على أنها منجزة.

## 1. شكل المستودع

هذا repository واحد، وليس monorepo فعليًا رغم وجود `pnpm-workspace.yaml`.

```text
src/                         React application
  pages/                     route-level pages
  ui/layout/                 app shell/navigation
  shared/                    reusable UI, hooks, formatting, logger
  domain/                    entities, validation, repository ports
  application/               DTOs and error mapping
  app/composition/           use-case facade / lazy repository bundle
  infrastructure/supabase/   Supabase adapters, mappers, generated DB types
  infrastructure/services/   branding, printing, WhatsApp-link helpers
  desktop/                   Tauri bridge/helper layer
  infrastructure/tauri/      unfinished alternative adapter factory
src-tauri/                   Rust/Tauri shell
supabase/
  migrations/                canonical DDL/security/business rules
  seeds/                     gated Demo/Staging data only
  tests/                     SQL acceptance scripts
  rollbacks/                 selected rollback runbooks
scripts/                     migration/RPC/type/audit/preflight tools
.github/workflows/           one Demo migration workflow
public/                      PWA icons/brand mark
vercel.json                  Web deployment/headers/SPA rewrite
```

## 2. التقنية الفعلية

- Runtime/build: Node.js + Vite 6.
- UI: React 19, React Router 7 (`HashRouter`).
- Language: TypeScript strict mode، مع `skipLibCheck: true` و`allowJs: true`.
- Styling: Tailwind CSS v4 + CSS tokens.
- Data/Auth/Storage: Supabase client.
- Charts: Recharts.
- Localization: i18next/react-i18next.
- Motion: Motion.
- PWA: vite-plugin-pwa/Workbox.
- Tests: Vitest + jsdom + Testing Library + PGlite.
- Optional desktop shell: Tauri v2/Rust.

`npm@10.9.8` هو package manager التشغيلي المثبت في `package.json`؛ README وVercel وGitHub Actions تستخدم `npm ci`. `pnpm-lock.yaml` التاريخي محفوظ ولم يُحذف ضمن recovery، لكنه ليس deployment input.

## 3. Data flow

```text
React Page/Component
        |
        v
useCases (src/app/composition/useCases.ts)
        |
        v
Repository Port (src/domain/ports/repositories.ts)
        |
        v
Supabase Adapter (src/infrastructure/supabase/repositories.ts)
        |
        +--> Supabase Auth
        +--> PostgREST table reads/CRUD
        +--> PostgreSQL SECURITY DEFINER RPCs
        +--> Supabase Storage (center-assets)
```

- `useCases` ينشئ repository bundle lazily.
- `createRepositoryBundle()` يدعم Supabase فقط في التشغيل الفعلي.
- Domain layer يحمل interfaces وvalidation primitives، لكنه ليس فصلًا نظيفًا كاملًا؛ بعض DTOs تستورد domain entities وبعض adapters ما زالت تستخدم `any` في الأسطح المعقدة.
- لا caching/query library؛ كل صفحة تدير loading/data/error عبر React state.
- لا server application layer مستقل بين المتصفح وSupabase.

## 4. Frontend application shell

ترتيب providers في `src/App.tsx`:

1. `ErrorBoundary`
2. `ThemeProvider`
3. `NetworkStatus`
4. `PwaUpdatePrompt`
5. `AppProvider` للجلسة/المستخدم
6. `AuthProvider`
7. `ToastProvider`
8. `ConfirmProvider`
9. `HashRouter`
10. `AppRoutes`

### الحالة المحلية

- session/user: `AppContext`.
- auth actions: `AuthProvider` facade.
- language/theme/active center: `localStorage` + Context أو singleton.
- forms/lists/modals: local `useState` داخل الصفحات.
- portal session file غير الموصول يخزن phone/token في `localStorage`; لأنه خارج routes الحالية لا يدخل الإصدار staff-only.

### Validation

`src/domain/validation.ts` يقدم parsers وقواعد موحدة للنص، الرقم، النسبة، الهاتف، البريد والتاريخ. استخدامه واضح في Services, Inventory, Employees, Packages, Accounting وCenter Settings، لكنه ليس مستخدمًا في كل النماذج.

Repository adapters تعيد validation على حدود البيانات في CRUD الرئيسي. PostgreSQL يضيف constraints وقواعد مالية وتشغيلية نهائية.

### Localization وRTL

- لغتان: `ar`, `en`.
- default/fallback: Arabic.
- direction يوضع على `<html>` عند startup ويتغير مع اللغة.
- خطا Inter/Cairo من Google Fonts مع system fallback.
- workforce pages (`Attendance`, `Advances`, `Payroll`, `Staff Analytics`) نقلت visible copy إلى i18n وأصبحت discoverable للإدارة. ما زالت بعض legacy styles تستخدم ألوانًا صلبة؛ visual browser review غير متاح.

### Accessibility

الأساس المشترك يتضمن:

- skip link وmain landmark.
- focus-visible عام.
- `Modal` و`ConfirmDialog` focus trap/restore؛ لا توجد page-local `fixed inset-0` dialog overlays خارج shared layer.
- accessible `GlobalSearch` combobox/dialog.
- `Tabs` semantics/keyboard/RTL arrows.
- Toast/network live regions.
- `prefers-reduced-motion`.

هذا لا يثبت WCAG compliance لكل صفحة؛ لا توجد browser/screen-reader E2E suite.

## 5. Backend وخدمات الخادم

### ما يوجد

Supabase هو backend الوحيد للـWeb:

- Auth email/password/session refresh.
- Postgres/PostgREST.
- private `center-assets` Storage bucket للشعار؛ canonical contract يقيد writes إلى ADMIN/center path وJPEG/PNG/WebP بحد 2 MiB (hosted application pending).
- PostgreSQL RPCs للعمليات ذات الثقة الأعلى.

### ما لا يوجد

- لا Express/Nest/Next API.
- لا Vercel Functions.
- لا Supabase Edge Functions في repository.
- لا jobs/cron/workers.
- لا webhook receiver.
- لا message queue.

هذا مهم: payment gateway وautomated notifications لا يمكن أن يصبحا live من الإعدادات الحالية وحدها، لأنهما يحتاجان server secrets/webhook endpoint غير موجودين.

## 6. Database

### Canonical chain

- `supabase/migrations/` يحتوي **36 migration** بترتيب filename.
- **35** منها automated replay.
- `20260628000002_admin_bootstrap.sql` operator/manual migration لأنه يحتاج Auth user UUID حقيقيًا.
- PGlite replay الحالي: 0 replay failures، 0 idempotency failures، fingerprint متطابق بعد الإعادة.

### Schema inventory من replay

- 34 public tables.
- 364 columns.
- 382 constraints.
- 78 foreign keys.
- 100 indexes.
- 23 triggers.
- 59 functions عبر public/app_private، وتشمل ADMIN wrappers وDashboard/Payroll transaction RPCs.
- 46 RLS policies بعد تجميع سياسات admin المتكررة.
- 34/34 tables لها RLS enabled في canonical replay.
- لا views.
- `appointment_status`: `SCHEDULED | COMPLETED | CANCELLED | NO_SHOW`.

### مجموعات الجداول

**Identity/tenant**
- `profiles`, `centers`, `center_memberships`, `center_settings`.

**Operations**
- `customers`, `employees`, `service_categories`, `services`, `products`, `appointments`, `expenses`.

**Sales/financial**
- `invoices`, `invoice_items`, `payments`, `checkout_idempotency`.

**Prepaid entitlements**
- `gift_cards`, `gift_card_transactions`, `service_packages`, `service_package_items`, `customer_entitlements`, `package_entitlement_units`, `entitlement_ledger`.

**Customer experience/config**
- `customer_reviews`, `service_files`, `service_file_images`, `customer_notification_timeline`, `notification_settings`, `payment_gateway_settings`.

**Staff/management**
- `attendance_records`, `employee_advances`, `payroll_runs`, `payroll_line_items`, `accounting_journal_entries`, `ai_booking_leads`.

### Tenant boundary

- معظم الصفوف تحمل `center_id`.
- `requireConfiguredCenterId()` يفرض center في adapter.
- كل query تقريبًا يضيف `center_id` filter.
- RLS يستعمل `user_center_ids()` أو `is_center_member()`.
- production hardening أضاف center-scoped FKs لبعض العلاقات الحساسة.
- checkout يتحقق من center membership ويستمد catalog/financial values من DB.

### Role boundary

- payroll/attendance/advances وadmin Settings/Accounting/Customer Experience/AI/entitlement lifecycle تطبق `has_center_role(..., ['ADMIN'])` في canonical DB.
- sensitive public RPCs أصبحت ADMIN wrappers؛ implementations القديمة owner-only بلا client grants.
- employee writes وcompensation reads أصبحت عبر governed RPCs؛ operational roles تحصل على identity fields فقط.
- Dashboard financial capability وP&L/revenue تأتي من server-governed RPCs. hosted application لهذه migrations ما زال غير متحقق.
- action-level policy لـcustomer/service/product CRUD ما زالت تحتاج owner confirmation؛ `can()` غير مستعمل في runtime UI.

### Financial rules

مصدر الحقيقة هو PostgreSQL، لا UI:

- `process_checkout_idempotent_v1` هو client entry point.
- `process_checkout_v1` internal وغير ممنوح للعميل.
- OMR بثلاث خانات عشرية وPostgreSQL numeric.
- stock decrement، invoice/payment/line، customer aggregates، entitlement entries في transaction واحدة.
- paid financial rows client-readable لكن direct writes مسحوبة.
- entitlements ledger append-only ويقود balance trigger.
- appointment duration snapshot + exclusion constraint يمنع overlap المتزامن.
- terminal appointment states غير قابلة للتعديل/الحذف.

### Seeds

- initial migration ينشئ center وcenter_settings ثابتين مطلوبين للbootstrap.
- catalog demo موجود خارج migrations في `supabase/seeds/`.
- seed يتوقف إذا لم تكن الجلسة مصنفة Demo/Staging ولم يعط center ID.
- لا customer/invoice/payment demo seeds داخل canonical migrations.

### Deletion behavior

قاعدة البيانات ما زالت تحتوي hard-delete semantics غير موحدة:

- حذف customer يحاول حذف appointments/invoices عبر cascade؛ payments/entitlements قد تمنع بعض الحذف بـRESTRICT.
- حذف employee يمسح attendance/advances/payroll lines عبر cascade، ويجعل appointment/invoice employee nullable.
- service/product deletion يبقي invoice item snapshot references nullable، لكن علاقات أخرى قد تمنع الحذف.
- financial/entitlement tables تستخدم RESTRICT أكثر في migrations المتأخرة.

تم احتواء الخطر في UI: لا تعرض صفحات customer/expense/attendance/advance hard delete، وemployee/service/product تستعمل activation state. لا تزال سياسة retention/anonymization النهائية تحتاج قرار owner قبل أي migration أو cleanup.

## 7. Authentication وauthorization

### Session trust

- Supabase يدير access/refresh token في المتصفح.
- `app_metadata.role` يُستخدم فقط لقبول Auth session مبدئيًا؛ role الفعلي للواجهة يأتي من `center_memberships.role` للمركز النشط، وهو نفس مصدر DB authorization.
- invalid/missing Auth role أو membership role يفشل مغلقًا ويُمسح local session القديم.
- membership query يجب أن تنجح قبل عرض التطبيق، ويعاد التحقق عند Auth token/user state changes.
- local `center_id` لا يمنح صلاحية؛ RLS membership هو الحد الخلفي.

### Account lifecycle

- إنشاء أول admin يتم يدويًا في Supabase ثم admin bootstrap migration.
- لا signup/reset/invite/deactivate Auth account UI.
- لا توجد Auth account-management UI حاليًا. تم إزالة legacy Settings tab التي كانت توصل “User Management” خطأً بجدول `employees`; provisioning ما زال operator/server responsibility.
- hosted password policies غير مثبتة محليًا. Workflow يحاول تفعيل password-change reauthentication فقط إذا توفرت deployment credentials.

## 8. Integrations

### Supabase

Integration أساسي وضروري. Browser publishable key public بطبيعته؛ privileged keys غير موجودة في tracked files بحسب secrets tests وقراءة الإعداد.

### Storage

- bucket: `center-assets`.
- object path يبدأ بـcenter ID.
- storage RLS يطابق path center مع membership.
- لا image processing pipeline أو cleanup job.

### WhatsApp/SMS

- `whatsappService` يفتح `wa.me` manual deep link.
- logs/stats داخل memory للجلسة فقط.
- لا delivery receipt حقيقي.
- SMS branch لا ينفذ provider call.
- لا Business API secrets أو backend.

### Payments

- يحفظ provider metadata/deposit rules فقط.
- provider options: Manual, Thawani, PayTabs, Stripe.
- لا SDK/session/webhook/charge implementation.
- POS الحالي يسجل cash/card/transfer كطرق داخلية، وليس live card processing.

### Printing

- browser `window.print()` وshare/clipboard fallback.
- QR code على invoice layout.
- Tauri helper يكتب sanitized HTML job إلى local print queue directory؛ لا يفتح native printer dialog بنفسه.

### Branding

- Supabase center settings authoritative، مع localStorage fallback/cache في Branding page/service.

### AI/analytics/maps/email

غير موجودة كخدمات خارجية.

## 9. PWA

### Build output المتحقق

- manifest صالح ويخدم كـ`application/manifest+json` في production preview.
- service worker يولد بنجاح.
- build الحالي يولد Workbox precache؛ chart engine الكبير مستبعد من install precache ويُحمّل عند فتح Reports online.
- runtime cache: Google Fonts وimages فقط.
- navigation fallback إلى `index.html`.
- `registerType: prompt` يعرض update banner ويطلب موافقة المستخدم قبل reload بدل استبدال chunks تحت POS session مفتوحة.

### Offline behavior

- UI shell/assets يمكن أن تفتح من cache بعد أول تحميل.
- Supabase data وCRUD لا تعمل offline.
- `NetworkStatus` يوضح الانقطاع؛ لا outbox/sync queue للـWeb، لذلك CRUD يبقى online-only بوضوح.
- يوجد update prompt مضبوط؛ لا يوجد install-promotion UI.

### Router contract

Manifest وshortcuts تستعمل الآن `/#/dashboard` و`/#/pos` بما يطابق `HashRouter`، ويوجد static regression لهذا العقد.

## 10. Tauri desktop

### الموجود

- Tauri v2 config/Rust shell.
- plugins المسجلة: shell, dialog, fs, process, updater؛ unhandled deep-link dependency/config أزيلا.
- Desktop CSP يقيّد scripts/objects/frames ويسمح فقط باتصالات Supabase المطلوبة.
- commands للصحة، export/import JSON snapshot، file selection، وHTML print queue.
- JS invoke bridge واختبارات source/bridge.

### غير الموجود

- لا SQLite engine؛ الملف اسمه `.sqlite.json` ويحتوي JSON.
- `createTauriAdapters()` فارغ مع TODO.
- `createRepositoryBundle()` لا يدعم Tauri backend.
- لا Supabase sync.
- updater disabled ولا signing/package acceptance.
- Rust toolchain غير موجود في بيئة الاكتشاف، لذلك `cargo check` لم يعمل.

النتيجة: Desktop foundation فقط، وليس offline desktop product.

## 11. Build/deployment/CI

### Vercel

- `npm ci` → `npm run build` → `dist`.
- SPA rewrite لكل path إلى `index.html`.
- HSTS, nosniff, DENY framing, referrer policy, permissions policy وCSP.
- CSP يسمح inline style ويقيد script إلى self.

### GitHub Actions

Workflow واحد: `Apply Demo Supabase migrations`.

Static job يشغل audit/type/migration/RPC/tests/build/npm audit/diff checks. Live job:

- لا يعمل إلا إذا وجدت مجموعة كاملة من GitHub secrets.
- يتأكد من explicit Demo project ref.
- يطبق migrations ويفحص history/preflight.
- لا يشغل SQL files تحت `supabase/tests/` مباشرة.

آخر run مقروء كان static-success، لكن live migration job **skipped** بسبب غياب واحد أو أكثر من credential inputs. لذلك نجاح workflow لا يثبت hosted schema update.

### Monitoring/logging

- `logger` يكتب console فقط.
- `ErrorBoundary` ينشئ report ID محليًا ويسجل fingerprint/component stack في console.
- لا Sentry/Datadog/remote log ingestion.
- لا uptime checks أو database backup monitoring في repository.

## 12. Backup وrollback

- selected migrations المتأخرة لها rollback runbooks.
- لا rollback automation.
- Settings export يغطي subset فقط من 34 tables ويظهر الآن باسم operational JSON export، لا backup.
- legacy restore adapter ما زال جزئيًا وغير atomic، لذلك أزيل Restore من UI ولم يعد Auto-Backup معروضًا.
- disaster recovery يعتمد على managed database backups/runbook غير متحقق hosted.
- hosted Supabase backup/PITR policy مجهولة من هذا repository.
