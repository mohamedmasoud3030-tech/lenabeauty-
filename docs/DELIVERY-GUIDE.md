# دليل تسليم LenaBeauty لعميل جديد

> هذا الدليل للمطور (أنت). دليل المالك منفصل في آخر هذا الملف.

---

## الجزء الأول — خطوات المطور (لكل عميل جديد)

### الخطوة 1 — إنشاء Supabase Project منفصل

1. افتح [supabase.com](https://supabase.com) → **New Project**
2. اسم المشروع: `lenabeauty-[اسم-العميل]` (مثال: `lenabeauty-sara-salon`)
3. اختر Region الأقرب للعميل (عادةً Middle East / Frankfurt)
4. احفظ كلمة السر — لن تظهر مجدداً
5. انتظر دقيقتين لاكتمال الإنشاء

### الخطوة 2 — تطبيق مخطط قاعدة البيانات (المسار الرسمي)

في **Supabase → SQL Editor**، شغّل ملفات `supabase/migrations/` بالترتيب (كل ملف = استعلام منفصل):

```
20260623000001_initial_schema.sql
20260623000002_enable_rls_and_policies.sql
20260628000001_enable_rls.sql
20260628000002_admin_bootstrap.sql
20260628000003_checkout_rpc.sql
20260628000004_vat_support.sql
20260628000005_tier_discount.sql
20260628000006_public_booking.sql
20260628000007_gift_cards.sql
20260628000008_packages_bundles.sql
20260628000009_no_show_protection.sql
20260628000010_notifications_payment_gateway.sql
20260628000011_client_portal.sql
20260628000012_customer_experience_forecasting_accounting_advanced.sql
20260628000013_booking_reschedule_cancel.sql
20260628000014_client_portal_lockout.sql
20260628000015_attendance_advances_payroll.sql
20260628000016_validation_constraints.sql
20260809000001_delivery_security_hardening.sql
20260810000001_fix_invoice_items_packages.sql
20260810000002_operational_data_integrity.sql
20260810000003_appointment_overlap_integrity.sql
```

> ⚠️ **لا تستخدم** `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` أو `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` — تم أرشفتهما في `docs/archive/` وهما نسخ قديمة غير مكتملة.

تحقق: يجب أن تظهر الجداول التالية في **Table Editor**:
- `centers` ✓
- `center_memberships` ✓
- `center_settings` ✓
- `customers` ✓
- `employees` ✓
- `services` ✓
- `appointments` ✓
- `products` ✓
- `expenses` ✓
- `invoices` ✓
- `invoice_items` ✓
- `gift_cards` ✓
- `service_packages` ✓
- `attendance_records` ✓
- `payroll_runs` ✓

### الخطوة 3 — إنشاء مستخدم Admin وربطه بالمركز المُهيّأ

1. في **Authentication → Users → Add user**: أنشئ حساب المالك (البريد + كلمة مرور قوية)
2. انسخ UUID المستخدم الجديد
3. في **SQL Editor** افتح `supabase/migrations/20260628000002_admin_bootstrap.sql`، استبدل قيمة `v_admin_uid` بـ UUID المستخدم الجديد، ثم شغّله
4. هذا الملف يربط المستخدم بالمركز المُهيّأ (seed) ويضبط دور `ADMIN` تلقائياً

> المركز المُهيّأ (seed) في migrations هو: `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d` — يجب أن يطابق `VITE_CENTER_ID` في الخطوة التالية.

### الخطوة 4 — Vercel Deployment

```bash
# في مجلد المشروع المحلي
git clone https://github.com/mohamedmasoud3030-tech/lenabeauty- lenabeauty-[client]
cd lenabeauty-[client]
```

أو أضف Environment Variables لـ deployment جديد في Vercel:

| Variable | القيمة |
|----------|--------|
| `VITE_DATA_BACKEND` | `supabase` |
| `VITE_SUPABASE_URL` | من Supabase → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `publishable` key من Supabase → Settings → API |
| `VITE_BRANCH_MODE` | `single` |
| `VITE_CENTER_ID` | `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d` (مركز seed في migrations) |

```bash
# Deploy (لو أول مرة)
npx vercel --prod

# أو اربط الـ repo بـ Vercel Dashboard وشغّل deploy من هناك
```

الرابط سيكون: `https://lenabeauty-[client].vercel.app`

**اختياري:** أضف custom domain من Vercel → Domains.

### الخطوة 5 — التحقق النهائي

```bash
npm run preflight:supabase
```

يجب أن يمر بدون أخطاء. ثم:

- [ ] افتح الرابط في متصفح عادي
- [ ] تسجيل الدخول بحساب admin
- [ ] أضف عميل تجريبي
- [ ] أضف خدمة
- [ ] نفّذ فاتورة من POS
- [ ] تحقق أن البيانات تبقى بعد إغلاق المتصفح وإعادة الفتح

---

## الجزء الثاني — دليل تثبيت التطبيق (للمالك)

> **أعطِ هذا الجزء للعميل مع رابطه**

---

# دليل استخدام LenaBeauty على جوالك وكمبيوترك

مرحباً! هذا الدليل يشرح كيف تضيف تطبيق إدارة صالونك على جوالك وكمبيوترك بسهولة، تماماً مثل أي تطبيق.

---

## على جوال iPhone (iOS)

**الخطوات:**

1. افتح **Safari** (متصفح Apple — ليس Chrome أو غيره)
2. اكتب رابطك في شريط العنوان:  
   `https://[رابط-صالونك].vercel.app`
3. سجّل دخولك بالإيميل وكلمة المرور اللي أعطاك إياهم المطور
4. اضغط على أيقونة **المشاركة** ⬆️ (الصندوق مع السهم للأعلى) في أسفل الشاشة
5. اسحب للأسفل في القائمة → اضغط **"إضافة إلى الشاشة الرئيسية"**
6. اضغط **إضافة**

✅ الآن ستجد أيقونة LenaBeauty على شاشتك الرئيسية — افتحها مثل أي تطبيق.

---

## على جوال Android

**الخطوات:**

1. افتح **Chrome** على جوالك
2. اكتب رابطك:  
   `https://[رابط-صالونك].vercel.app`
3. سجّل دخولك
4. ستظهر رسالة تلقائية أسفل الشاشة: **"إضافة إلى الشاشة الرئيسية"** — اضغط عليها
5. إذا لم تظهر: اضغط على النقاط الثلاثة ⋮ في الأعلى → **"إضافة إلى الشاشة الرئيسية"**

✅ التطبيق الآن في قائمة تطبيقاتك.

---

## على الكمبيوتر (Windows / Mac)

**الطريقة الأولى — من المتصفح مباشرة (موصى بها):**

1. افتح **Chrome** أو **Edge**
2. اكتب رابطك في شريط العنوان
3. سجّل دخولك
4. اضغط على أيقونة التثبيت في شريط العنوان (📥 أو ⊕) على اليمين
5. اضغط **"تثبيت"**

سيُضاف التطبيق لقائمة البرامج ويمكن فتحه من الـ Desktop مثل أي برنامج.

**الطريقة الثانية — بدون تثبيت:**

اجعل الرابط في **المفضلة** (Bookmarks) وافتحه من هناك عند الحاجة.

---

## نصائح مهمة

**البيانات آمنة في السحابة:**  
كل ما تدخله (عملاء، مواعيد، فواتير) محفوظ على الإنترنت. لو فقدت جوالك، سجّل دخول من أي جهاز آخر وستجد كل بياناتك.

**النسخة الاحتياطية:**  
من **الإعدادات → البيانات والنسخ الاحتياطية** يمكنك تحميل نسخة من بياناتك على جهازك أسبوعياً (موصى به).

**التحديثات تلقائية:**  
لا تحتاج تحديث التطبيق يدوياً. أي تحسينات جديدة تصل إليك فور فتح التطبيق.

**المستخدمون:**  
لو أردت إضافة موظف/موظفة لاستخدام التطبيق، تواصل مع المطور لإنشاء حساب لهم.

---

## بيانات دخولك

| | |
|--|--|
| **الرابط** | `https://[رابط-صالونك].vercel.app` |
| **الإيميل** | `[إيميل المالك]` |
| **كلمة المرور** | `[كلمة المرور المؤقتة]` |

> 🔒 غيّر كلمة المرور من الإعدادات بعد أول دخول.

---

**للدعم والمساعدة:** تواصل مع [اسمك ورقم هاتفك]

