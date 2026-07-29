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

### الخطوة 2 — تطبيق مخطط قاعدة البيانات

في **Supabase → SQL Editor**، شغّل هذا الملف بالكامل:

```
docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql
```

ثم شغّل:
```
docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql
```

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

### الخطوة 3 — إنشاء Center وAdmin User

في **SQL Editor**، شغّل:

```sql
-- 1. إنشاء المركز
INSERT INTO centers (id, name)
VALUES (gen_random_uuid(), 'اسم صالون العميل')
RETURNING id; -- احفظ هذا الـ UUID

-- 2. إعداد إعدادات المركز الافتراضية
INSERT INTO center_settings (center_id, name, currency)
VALUES ('[CENTER_ID من الخطوة السابقة]', 'اسم صالون العميل', 'OMR');
```

في **Authentication → Users → Invite User**:
- Email: `admin@[اسم-الصالون].com` أو أي إيميل
- بعد الإنشاء، في **SQL Editor**:

```sql
-- ربط المستخدم بالمركز وإعطاءه دور ADMIN
-- 1. Create a profile for the user (important: links auth.users to public tables)
INSERT INTO profiles (id, full_name)
VALUES ('[USER_ID من Auth]', 'المدير');

-- 2. Link profile to center
INSERT INTO center_memberships (profile_id, center_id)
VALUES ('[USER_ID من Auth]', '[CENTER_ID]');

-- تعيين الدور في user_metadata
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
WHERE id = '[USER_ID]';
```

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
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `anon` key من Supabase → Settings → API |
| `VITE_BRANCH_MODE` | `single` |
| `VITE_CENTER_ID` | UUID المركز من الخطوة 3 |

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

