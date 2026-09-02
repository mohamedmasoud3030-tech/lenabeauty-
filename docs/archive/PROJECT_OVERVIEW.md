# PROJECT_OVERVIEW — LenaBeauty

**تاريخ الاكتشاف:** 2026-08-17
**النطاق:** حالة المستودع الحالية على `arena/01a00f9e-lenabeauty` عند commit `2d96110`.
**قاعدة القراءة:** الكود التنفيذي، المسارات، الاختبارات، migrations، ونتائج التشغيل مقدّمة على الادعاءات القديمة في الوثائق.

## 1. طريقة تصنيف المعلومات

- **متحقق:** ظهر مباشرة في الكود الحالي أو أمر تنفيذي ناجح.
- **استنتاج معقول:** مدعوم بأكثر من قرينة، لكنه لم يُختبر في البيئة المستضافة.
- **مجهول:** يحتاج بيانات دخول، hosted Supabase، جهاز فعلي، أو قرار منتج.
- **تناقض:** ملفان موثوقان ظاهريًا يصفان واقعين مختلفين؛ يُذكر السلوك التنفيذي الحالي.

## 2. ما هو المنتج فعليًا؟

LenaBeauty هو تطبيق Web/PWA لإدارة مركز تجميل أو صالون، موجّه حاليًا إلى تشغيل موظفي مركز واحد أو عدة فروع مرتبطة بعضويات المستخدم. التطبيق عربي أولًا ويدعم الإنجليزية و`RTL/LTR`.

### حدود الإصدار الحالي المتحقق منها

- التطبيق الحالي **staff-only**: المسار العام الوحيد المفيد هو `/login`.
- `/book`, `/portal` وLanding موجودة كملفات، لكنها غير مسجلة في `src/routes.tsx`.
- public booking/client portal RPCs موجودة في migrations، لكن الـcanonical grant contract يسحب صلاحية تنفيذها من أدوار العميل.
- لا يوجد fake/preview data adapter في مسار التشغيل.
- التشغيل اليومي يعتمد على hosted Supabase؛ لا يوجد وضع بيانات Web يعمل بدون الشبكة.
- Production data environment منفصل غير مثبت من هذا checkout. Production build الحالي يملك fallback مقصودًا إلى Demo/Staging حسب `src/config/env.ts`.

## 3. المستخدمون والأدوار

الأدوار المعرفة في `src/domain/entities/Session.ts`:

| الدور | السلوك الفعلي في routes | ملاحظات الصلاحية |
|---|---|---|
| `ADMIN` | كل المسارات التشغيلية والإدارية | الوحيد الذي يسمح له `RequireAdmin` بدخول admin routes |
| `MANAGER` | نفس operational routes الخاصة بـ`STAFF` | لا توجد مزايا UI إضافية حاليًا |
| `STAFF` | Dashboard, POS, Appointments, Customers, Services, Inventory, Gift Cards, Packages | لا يدخل admin routes |
| Anonymous | Login فقط | أي مسار آخر يعود إلى Login؛ public RPCs disabled |

### تنبيه مهم عن مصدر الصلاحية

- Auth session يقبل role مبدئيًا من server-owned `app_metadata` ولا يثق في `user_metadata`.
- بعد membership bootstrap تصبح `center_memberships.role` للمركز النشط مصدر UI role، بما يطابق DB authorization؛ ويعاد التحقق عند Auth state changes.
- `can()` يعرّف permissions تفصيلية، لكنه **غير مستخدم في كود الواجهة خارج الاختبارات**.
- admin Settings/financial/workforce boundaries محكومة server-side في canonical migrations؛ hosted application ما زال غير متحقق.

## 4. الرحلات الأساسية

### 4.1 المصادقة وبدء الجلسة

1. يفتح المستخدم `/login`.
2. `SupabaseAuthAdapter.login()` يستعمل email/password مع Supabase Auth.
3. `mapAuthSession()` يقبل `ADMIN | MANAGER | STAFF` من `app_metadata.role` كـbootstrap فقط.
4. `AppContext` يجلب memberships مع role ويستخدم role المركز النشط للواجهة.
5. في `single` branch mode يجب أن تطابق العضوية `VITE_CENTER_ID`.
6. في `multi` branch mode يُختار مركز من memberships ويُحفظ في `localStorage`؛ reload يعيد role reconciliation.
7. Auth state/token changes تعيد session وmembership verification.

الموجود: login, session restore, logout, invalid-session cleanup.
غير الموجود: signup UI, password reset UI, invitation UI، وإدارة Auth users صحيحة من داخل التطبيق.

### 4.2 التشغيل اليومي

- Dashboard: مؤشرات العملاء، مواعيد اليوم، low stock، الإيراد، P&L، activity مشتق من بيانات حالية.
- Appointments: عرض day/week، حجز، تعديل، complete/cancel/no-show، overlap protection في DB.
- Customers: CRUD، search، history، notes، loyalty.
- Services/Inventory: catalog CRUD، active/inactive، prices، stock، reorder level.
- POS: services/products/packages/gift-card sale، discounts، loyalty، entitlements، payment method، receipt/print.

### 4.3 الرحلة المالية

1. UI يبني `CheckoutPayload`.
2. `SupabaseInvoiceAdapter.checkout()` ينشئ request UUID ثابتًا لإعادة المحاولة.
3. يستدعي `process_checkout_idempotent_v1`.
4. الـDB يستدعي داخليًا `process_checkout_v1` داخل transaction واحدة.
5. invoice, invoice items, payment, stock, customer totals, gift cards/packages/entitlements/ledger تُحفظ أو تُرجع كلها معًا.
6. direct client writes على financial tables مسحوبة حسب canonical contract.

### 4.4 الإدارة

- Employees CRUD.
- Reports: sales, appointments, inventory, financial entitlements.
- Settings: center profile، truthful partial JSON export، branding، notifications، payment metadata. تم احتواء User Management وRestore/Auto-Backup غير الآمنين وإزالتهما من UI.
- Attendance, advances, payroll, staff analytics.
- Customer experience, forecasting, accounting journal، وAI lead intake.

معظم هذه المسارات الإدارية مخفية من Sidebar التجريبي، لكنها قابلة للوصول المباشر للإدارة وموجودة في Global Search.

## 5. مخزون المسارات الكامل

### 5.1 Public / unauthenticated

| المسار | الشاشة الحالية | الحالة |
|---|---|---|
| `/` | redirect إلى `/login` | فعّال |
| `/login` | Login | فعّال |
| أي public path غير معروف | redirect إلى `/login` | لا توجد 404 page |
| `/book` | لا route | ملف `BookingPage.tsx` غير موصول |
| `/portal` | لا route | ملف `ClientPortalPage.tsx` غير موصول |
| Landing | لا route | `LandingPage.tsx` غير موصول |

### 5.2 Authenticated operational

| المسار | الشاشة | الدور | الملاحة |
|---|---|---|---|
| `/dashboard` | Dashboard | كل مستخدم مصادق | Sidebar + mobile nav |
| `/pos` | POS/checkout/receipt | كل مستخدم مصادق | Sidebar + mobile nav |
| `/appointments` | Calendar + appointment workflow | كل مستخدم مصادق | Sidebar + mobile nav |
| `/customers` | Customer CRM/history | كل مستخدم مصادق | Sidebar + mobile nav |
| `/services` | Service catalog | كل مستخدم مصادق | Sidebar + More |
| `/inventory` | Products/inventory | كل مستخدم مصادق | Sidebar + More |
| `/gift-cards` | Sale/list/ledger | كل مستخدم مصادق | Sidebar شرطيًا حسب وجود data + More |
| `/packages` | Package creation/entitlements | كل مستخدم مصادق | Sidebar شرطيًا حسب وجود data |

### 5.3 Admin routes

| المسار | الشاشة | الظهور المعتاد |
|---|---|---|
| `/employees` | Employees CRUD/deactivation | Sidebar |
| `/reports` | Reports & drill-down | Sidebar |
| `/settings` | Settings sections | Sidebar |
| `/expenses` | Expense records/edit | Sidebar |
| `/customer-experience` | Reviews/service files | مخفي |
| `/forecasting` | Inventory/financial forecast | مخفي |
| `/attendance` | Attendance records/edit | Sidebar |
| `/advances` | Employee advances/status | Sidebar |
| `/payroll` | Payroll runs/print | Sidebar |
| `/staff-analytics` | Staff metrics/charts | Sidebar |
| `/accounting` | Journal entries | مخفي |
| `/advanced-automation` | AI booking leads/Tauri status | مخفي |

### 5.4 Legacy aliases

- `/branding` → `/settings?tab=branding`
- `/notifications` → `/settings?tab=notifications`
- `/payment-gateway` → `/settings?tab=payments`

### 5.5 Settings sections

- `center`: center profile, currency, VAT, contact data، ورابط إلى Branding لإدارة الشعار.
- `backup`: partial operational JSON export فقط؛ Restore وAuto-Backup غير معروضين حتى يوجد recovery implementation كامل وatomic.
- لا يوجد Auth user-management section حاليًا؛ employee records تبقى في `/employees`.
- `branding`: bilingual identity/colors/logo/footer.
- `notifications`: persisted templates/settings + local/manual wa.me sender.
- `payments`: provider metadata, Sandbox/Live flag, deposit rules, URLs؛ لا يوجد live charge backend.

## 6. مخزون الميزات وحالتها

| المجال | UI | Supabase adapter/schema | الحالة الواقعية |
|---|---:|---:|---|
| Auth/session/membership | نعم | نعم | repository-tested؛ hosted acceptance مجهول |
| Customers | نعم | نعم | مكتمل بنيويًا |
| Appointments | نعم | نعم + DB constraints | مكتمل بنيويًا |
| Services/categories | نعم | نعم | مكتمل بنيويًا |
| Products/inventory | نعم | نعم | مكتمل بنيويًا |
| Employees | نعم | نعم | staff records، وليست Auth accounts |
| Expenses | نعم | نعم | admin route مخفي من nav |
| POS/invoices/payments | نعم | atomic RPC | قوي بنيويًا؛ live QA غير منفذ هنا |
| Gift cards/packages | نعم | entitlement ledger | موجود |
| Receipt/print/share | نعم | browser + optional Tauri queue | موجود؛ طابعة فعلية غير مختبرة هنا |
| Dashboard/reports | نعم | ADMIN-governed reporting RPCs | VAT/prepaid-aware محليًا؛ hosted acceptance معلّق |
| Attendance/advances/payroll | نعم | ADMIN RLS + transactional payroll RPC | partial-failure boundary أُصلحت؛ commission policy ما زالت معلّقة |
| Settings/branding | نعم | نعم + private Storage/base64 | import وsigned legacy logo resolution أُصلحا محليًا |
| Operational JSON export | نعم | جزئي | معلن بوضوح أنه ليس DB backup؛ Restore معطل |
| Notifications | نعم | settings فقط | WhatsApp manual/unverified؛ SMS/automation معطلة بصدق |
| Payment gateway | نعم | metadata فقط | لا live payment sessions أو webhook |
| Forecasting/accounting/AI leads | نعم | tables/RPCs | قواعد بسيطة؛ لا AI provider أو accounting integration خارجي |
| Public booking/client portal | ملفات فقط | RPCs disabled | خارج الإصدار الحالي عمدًا |
| Multi-branch | CenterSwitcher + local choice | membership-scoped | موجود في الكود؛ live QA مجهول |
| Desktop/Tauri | shell/helpers | JSON snapshot فقط | foundation، وليس SQLite/offline product |

## 7. التنقل والتجربة والواجهة

- `HashRouter` هو Router الفعلي.
- Desktop Sidebar + mobile bottom navigation + Global Search.
- Arabic/English عبر `i18next`; `document.lang/dir` يتغيران.
- Theme light/dark في React Context و`localStorage`.
- لا Redux/Zustand؛ الحالة local React state + Contexts + singleton `useCases`.
- Tailwind CSS v4 وdesign tokens في `src/index.css`.
- shared states: `ScreenState`, `ListState`, `PageLoader`.
- shared overlays: `Modal`, `ConfirmDialog`, `Toast`, `ErrorBoundary`.
- responsive breakpoints واستخدام mobile card variants في صفحات رئيسية.
- أساسيات accessibility موجودة: landmarks, skip link, focus-visible, shared dialog focus traps/restore, live regions, reduced motion. كل page-local fixed overlays انتقلت إلى shared `Modal`؛ visual/mobile keyboard acceptance ما زالت غير مرصودة لغياب browser executable.

## 8. ما ليس جزءًا من المنتج التنفيذي الحالي

- لا custom Node/Express backend.
- لا API routes داخل Vercel.
- لا Edge Functions في المستودع.
- لا cron/scheduled jobs.
- لا server queue؛ “queue” الوحيدة هي ملفات print محلية في Tauri.
- لا email provider.
- لا analytics/telemetry provider.
- لا OpenAI/LLM integration؛ AI leads اسم لجدول intake فقط.
- لا Google Maps.
- لا Stripe/Thawani/PayTabs live SDK أو webhook.
- لا automated WhatsApp Business API.
- لا E2E browser test suite في المستودع.
