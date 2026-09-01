# دليل تسليم LenaBeauty لعميل جديد

> هذا الدليل للمطور. دليل المالك منفصل في آخر الملف.

---

## الجزء الأول — خطوات المطور (لكل عميل جديد)

### الخطوة 1 — إنشاء Supabase Project منفصل

1. افتح Supabase → **New Project**.
2. اسم المشروع: `lenabeauty-[اسم-العميل]`.
3. اختر Region مناسبًا للعميل.
4. احفظ كلمة مرور قاعدة البيانات في مدير أسرار آمن.
5. انتظر اكتمال إنشاء المشروع.

### الخطوة 2 — تطبيق مخطط قاعدة البيانات (المسار الرسمي)

**لا تستخدم قائمة filenames منسوخة داخل وثيقة كحد للنشر.** المصدر الوحيد هو مجلد:

```text
supabase/migrations/
```

نفّذ **كل ملفات `.sql` الموجودة فعليًا بالمجلد بترتيب filename تصاعديًا**. `20260628000002_admin_bootstrap.sql` هو الاستثناء الوحيد: bootstrap يدوي يحتاج UUID مستخدم Auth حقيقي ويُنفذ بعد إنشاء المستخدم في الخطوة التالية.

يفضل استخدام Supabase CLI / workflow المحكوم بدل النسخ اليدوي؛ الهدف هو أن تكون migration history المحلية والبعيدة متطابقة. إذا استُخدم SQL Editor في مشروع جديد، اكتشف الملفات من المجلد وقت التنفيذ ولا تعتمد على عدد أو “آخر ملف” مكتوب هنا.

> ⚠️ **لا تستخدم** SQL قديمًا من `docs/` أو `docs/archive/` كمسار نشر. الملفات هناك تاريخية/مرجعية فقط.

اعتبارًا من 2026-09-01 كان الـaudit يكتشف 41 migration: 40 automated + manual bootstrap واحد. هذا **snapshot فقط** وليس رقمًا يجب تثبيته. السلسلة الحالية تشمل في نهايتها عقود Visit/Recipes:

```text
20260901100838_visit_lifecycle_recipes.sql
20260901101133_visit_recipe_index_hardening.sql
20260901102643_recipe_write_boundary_hardening.sql
20260901102758_recipe_consumption_aggregation_hardening.sql
```

بعد التطبيق تحقق على الأقل من وجود المجموعات التالية:

- identity/tenant: `centers`, `center_memberships`, `center_settings`
- operations: `customers`, `employees`, `services`, `appointments`, `products`, `expenses`
- sales: `invoices`, `invoice_items`, `payments`, `checkout_idempotency`
- entitlements: `customer_entitlements`, `entitlement_ledger`, package/gift-card tables
- visit/recipes: `service_recipes`, `service_recipe_items`, `inventory_consumptions`
- workforce: `attendance_records`, `payroll_runs`

ولا يكفي وجود الجداول؛ يجب أن يمر `preflight:supabase` وmigration/RPC/audit contracts.

### الخطوة 3 — إنشاء مستخدم Admin وربطه بالمركز المُهيّأ

1. في **Authentication → Users → Add user** أنشئ حساب المالك ببريد حقيقي وكلمة مرور قوية.
2. انسخ UUID المستخدم الجديد.
3. افتح `supabase/migrations/20260628000002_admin_bootstrap.sql`، واستبدل `v_admin_uid` بالـUUID الحقيقي ثم شغّله مرة واحدة في المشروع الجديد.
4. تحقق أن العضوية والدور الفعليين محفوظان في `center_memberships` وأن التطبيق يقرأ authorization من المصدر الخادمي.

> مركز seed الافتراضي في السلسلة هو `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`؛ إذا استخدمت هذا bootstrap يجب أن يطابق `VITE_CENTER_ID`.

### الخطوة 4 — Vercel Deployment

```bash
git clone https://github.com/mohamedmasoud3030-tech/lenabeauty- lenabeauty-[client]
cd lenabeauty-[client]
```

أضف Environment Variables إلى deployment:

| Variable | القيمة |
|---|---|
| `VITE_DATA_BACKEND` | `supabase` |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key فقط |
| `VITE_BRANCH_MODE` | `single` |
| `VITE_CENTER_ID` | center UUID الصحيح |
| `VITE_ENVIRONMENT` | `production` عند إطلاق Production حقيقي |

لا تضع service-role أو DB password في أي `VITE_*` variable.

```bash
npx vercel --prod
```

أو اربط الـrepo بـVercel Dashboard. أضف custom domain عند الحاجة.

### الخطوة 5 — التحقق النهائي قبل التسليم

شغّل على النسخة/البيئة المقصودة:

```bash
npm run audit:gate
npm run db:types:check
npm run ci:migrations
npm run ci:rpc-check
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=low
npm run preflight:supabase
```

وعند توفر اتصال DB server-side شغّل كل rollback-safe SQL acceptance:

```bash
for test_file in supabase/tests/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --file "$test_file"
done
```

#### Browser acceptance

- [ ] افتح الرابط في متصفح عادي وتأكد أن الإعداد الناقص يفشل بوضوح بدل fallback صامت.
- [ ] تسجيل الدخول بحساب Admin ورفض مستخدم بلا membership/role صحيح.
- [ ] أضف عميلًا وخدمة ومنتجًا تجريبيًا وتأكد من persistence بعد reload.
- [ ] أنشئ موعدًا ومرره عبر Visit stages حتى `READY_FOR_CHECKOUT`.
- [ ] تأكد أن الموعد ينتقل إلى `/pos?appointment=<id>` ولا يوجد زر منفصل يعلّمه `COMPLETED` خارج checkout.
- [ ] تأكد أن POS يحمل customer/employee/service الحقيقي ويرسل `appointmentId`.
- [ ] نفّذ checkout وتحقق من invoice/payment وربط appointment وإغلاق الزيارة.
- [ ] أنشئ Service Recipe وتحقق أن الكتابة تتم عبر الـRPC، وأن direct client table writes غير مسموحة.
- [ ] تحقق من recipe consumption والمخزون؛ وجود نفس الخدمة في أكثر من invoice line يجب أن يستهلك مجموع الكمية مرة واحدة، وإعادة المحاولة لا تخصم مرتين.
- [ ] تحقق من Beauty Passport وWallet/entitlements وRetention/Action Center ببيانات حقيقية، ولا تعتبر empty state دليلًا على نجاح end-to-end.
- [ ] تحقق من gift cards/packages/entitlement ledger.
- [ ] تحقق من Attendance/Advances/Payroll حسب صلاحيات الدور.
- [ ] تحقق من invoice print preview وDashboard/Reports.
- [ ] تحقق من RTL على desktop + mobile.
- [ ] اختبر network failure / bad credentials / rejected write، ولا يجب أن يظهر نجاح وهمي.

> **مهم:** Settings يقدم operational JSON export فقط. لا تعتبر Restore/Auto-Backup متطلب قبول؛ واجهة restore الجزئية/غير الذرية غير متاحة عمدًا.

---

## الجزء الثاني — دليل تثبيت التطبيق (للمالك)

> **أعطِ هذا الجزء للعميل مع رابطه**

---

# دليل استخدام LenaBeauty على جوالك وكمبيوترك

مرحباً! هذا الدليل يشرح كيف تضيف تطبيق إدارة صالونك على جوالك وكمبيوترك بسهولة.

## على جوال iPhone (iOS)

1. افتح **Safari**.
2. افتح رابط الصالون.
3. سجّل الدخول.
4. اضغط **المشاركة** ⬆️.
5. اختر **إضافة إلى الشاشة الرئيسية**.
6. اضغط **إضافة**.

سيظهر LenaBeauty كأيقونة على الشاشة الرئيسية.

## على جوال Android

1. افتح **Chrome**.
2. افتح رابط الصالون وسجّل الدخول.
3. استخدم رسالة **إضافة إلى الشاشة الرئيسية** إن ظهرت، أو قائمة Chrome → **إضافة إلى الشاشة الرئيسية / تثبيت التطبيق**.

## على الكمبيوتر (Windows / Mac)

من Chrome أو Edge افتح الرابط، سجّل الدخول، ثم استخدم زر تثبيت التطبيق في شريط العنوان إن كان متاحًا. ويمكن استخدام الموقع مباشرة بدون تثبيت.

## نصائح مهمة

**البيانات السحابية:**  
البيانات التشغيلية تُحفظ في Supabase؛ الوصول إليها يعتمد على الإنترنت وصلاحية الحساب.

**تصدير البيانات:**  
من الإعدادات يمكن تنزيل **تصدير JSON تشغيلي جزئي** للاحتفاظ بنسخة مرجعية. لا يُوصف هذا بأنه backup كامل لقاعدة البيانات، ولا توجد Restore تلقائية داخل التطبيق حاليًا.

**التحديثات:**  
نسخة الـPWA قد تعرض تنبيه تحديث عند وجود إصدار جديد بدل إعادة تحميل جلسة مفتوحة قسرًا.

**المستخدمون:**  
إضافة حسابات Auth جديدة عملية إدارية/خادمية؛ سجل الموظف داخل التطبيق ليس بديلًا عن حساب Auth.

## بيانات دخولك

| | |
|--|--|
| **الرابط** | `https://[رابط-صالونك].vercel.app` |
| **الإيميل** | `[إيميل المالك]` |
| **كلمة المرور المؤقتة** | `[كلمة المرور المؤقتة]` |

غيّر كلمة المرور بعد أول دخول وفق سياسة الحساب المعتمدة.

**للدعم والمساعدة:** تواصل مع جهة الدعم المتفق عليها.
