# المراجعة الشاملة لتجربة LenaBeauty

**تاريخ المراجعة:** 17 أغسطس 2026  
**النطاق:** الواجهة، تجربة الاستخدام، المحتوى، الاستجابة، العربية و`RTL`، الوصولية، الحالات التشغيلية، والأجزاء المشتركة في التطبيق كله.  
**النسخة التي روجعت:** الفرع الحالي المبني من `2121bb8`، مع فحص الرابط العام `https://lenabeauty.vercel.app/#/login`.

---

## 1) ملخص بسيط لصاحبة المنتج

LenaBeauty هو نظام تشغيل مركز تجميل في عُمان، وليس مجرد صفحة عرض. أهم مستخدميه هم:

1. **صاحبة المركز / `ADMIN`**: ترى التشغيل، المبيعات، التقارير، الموظفين والإعدادات.
2. **موظفة الاستقبال أو التشغيل / `STAFF`**: تدير المواعيد والعملاء ونقطة البيع والكتالوج والمخزون.
3. **المديرة / `MANAGER`**: موجودة في نموذج الصلاحيات، لكن واجهتها الفعلية حاليًا تكاد تطابق `STAFF`.
4. **العميلة**: يوجد كود للحجز العام و`Client Portal`، لكنه غير موصول بمسارات التطبيق الحالية.

### الحكم العام

الأساس البصري جيد وله هوية واضحة، والمسارات اليومية الأساسية غنية ومبنية حول عمل الصالون فعلًا. توجد أيضًا نقاط جيدة في حالات القوائم، الحوارات المشتركة، تأكيد الحذف، أحجام لمس كثيرة، و`RTL` العام.

لكن لا يصح اعتبار المنتج كامل الوصولية أو كامل الجاهزية بعد. أهم المخاطر الحالية هي:

- حاجز مؤكد في شاشة الدخول لمستخدمي قارئ الشاشة ولوحة المفاتيح، مع تباين ضعيف جدًا لرسائل الخطأ.
- رحلة الحجز العام و`Client Portal` موجودتان في الكود لكن غير متاحتين عبر أي `route`.
- انتهاء الجلسة أو رفض الصلاحية يعيد المستخدم بلا شرح، ولا يعيده للمهمة السابقة بعد الدخول.
- البحث و`Mobile More` يعرضان روابط لا يملك `STAFF` صلاحيتها، ونتيجة Dashboard في البحث تذهب إلى `/` ثم إلى Login.
- تغطية الحالات والوصولية والتعريب ممتازة نسبيًا في الصفحات الأساسية، لكنها ضعيفة جدًا في وحدات الحضور والسلف والرواتب وتحليلات الموظفين والوحدات المؤجلة.
- وصف `PWA` أكبر من السلوك الفعلي: لا توجد واجهة تثبيت أو تحديث، وروابط manifest غير متوافقة مع `HashRouter`، ولا توجد عمليات بيانات حقيقية دون شبكة.

---

## 2) كيف تمت المراجعة وما حدود الدليل؟

### ما تم فعله فعليًا

- تشغيل `npm ci` ثم:
  - `npm run typecheck` — نجح.
  - `npm run test -- --reporter=dot` — **88 ملفًا و469 اختبارًا نجحت**.
  - `npm run build` — نجح، وحجم `precache` المعلن **1902.52 KiB**.
- قراءة `routes`, `route guards`, `Layout`, `Sidebar`, `i18n`, `PWA manifest`, الصفحات الـ27، والعناصر المشتركة.
- فحص الصفحة العامة المنشورة؛ الرابط العام يعرض Login العربية فعلًا.
- تشغيل فحص آلي مؤقت بـ`axe-core` على Login العربية وعلى primitives (`Tabs`, `Modal`, `Toast`) داخل `jsdom`.
- فحص تفاعل لوحة المفاتيح من اختبارات المكوّنات الموجودة: `Escape`, إغلاق الحوارات، `focus trap` وعودة التركيز في `Modal`.
- حساب التباين رياضيًا من الألوان الفعلية بدل التقدير البصري.
- فحص أنماط الحقول، الأزرار، الجداول، `aria`, النصوص العربية الصلبة، والخصائص الفيزيائية المخالفة لـ`RTL`.

### حدود مهمة — لا نخفيها

- لا توجد بيانات دخول Demo في المستودع، وهذا صحيح أمنيًا. لذلك لم يتم إجراء بيع أو تعديل حقيقي على قاعدة Demo المنشورة.
- تنزيل متصفح Chromium للاختبار الآلي فشل بسبب انقطاع شبكة التنزيل في البيئة. لذلك **لم أزعم** فحصًا بصريًا يدويًا على أجهزة فعلية أو `Lighthouse`.
- الصفحات المحمية فُحصت من الكود، واختبارات render والتفاعل الموجودة، وليس من جلسة إنتاج مصادقة.
- تم تعطيل قاعدة `color-contrast` في تشغيل `axe` لأن `jsdom` لا يحسب CSS كما يفعل المتصفح؛ وعُوّض ذلك بحسابات تباين مستقلة للألوان الحرجة.

### معنى نوع الدليل

- **مؤكد:** ظهر في مسار/كود/DOM/اختبار أو قياس مباشر.
- **مرجّح ويحتاج جهازًا:** توجد قرينة قوية في CSS أو الهيكل، لكن يلزم متصفح/هاتف فعلي للإقفال النهائي.
- **اقتراح:** تحسين غير حاجز، ويحتاج قرار المنتج.

---

## 3) نظام التصميم الحالي ونقاط القوة التي يجب الحفاظ عليها

### نقاط قوة مؤكدة

1. **هوية Lena واضحة:** violet/rose، شعار ثابت، أسطح هادئة، ووضعان Light/Dark. لا أوصي باستبدالها بتصميم عام.
2. **اتجاه عربي مركزي:** `document.lang` و`document.dir` يتغيران، وخط `Cairo` مقدم في العربية.
3. **Logical CSS موجود في الهيكل الأساسي:** استخدام `start/end`, `ms/me`, `border-e` في أجزاء مهمة.
4. **نمط مشترك جيد للحالات:** `ScreenState` و`ListState` يغطيان loading/empty/error في عدد كبير من القوائم الأساسية.
5. **`Modal` المشترك جيد نسبيًا:** `role="dialog"`, اسم ووصف، قفل scroll، `Escape`, `focus trap`، استعادة التركيز، وارتفاع مناسب للوحة مفاتيح الهاتف.
6. **تأكيد العمليات المدمرة:** يوجد `ConfirmDialog` مستخدم في حذف خدمات ومنتجات وموظفين ومصروفات وغيرها.
7. **Mobile basics جيدة:** `safe-area`, حقول 16px لمنع iOS zoom، إخفاء bottom navigation عند ظهور لوحة المفاتيح، وأهداف 44px في أجزاء أساسية.
8. **`prefers-reduced-motion` موجود** ويقصر الحركة عالميًا.
9. **الرحلة التجارية متماسكة:** POS يجمع service/product/package، العميل والموظفة، الخصم، الدفع والإيصال.
10. **الثقة في الدفع أفضل من واجهة تجريبية عامة:** يظهر أن gift card التزام مؤجل، وإعدادات payment gateway تحذر من الأسرار وتفرق Sandbox/Live.
11. **الطباعة مؤمنة نسبيًا:** توجد اختبارات escaping وتنسيق 80mm ومعاينة وإجراءات print/share/save.
12. **فصل الهاتف عن الجدول:** صفحات أساسية كثيرة تقدم cards للهاتف وجدولًا لسطح المكتب بدل ضغط الجدول فقط.

### أنماط التصميم الفعلية

- Tokens في `src/index.css`: `background`, `card`, `primary`, `muted`, `success`, `warning`, `destructive`, `border`, وطبقات z-index.
- عناصر مشتركة: `PageHeader`, `Modal`, `ConfirmDialog`, `ScreenState`, `ListState`, `Toast`, `PremiumCard`, `Badge`.
- مشكلة التغطية: بعض الوحدات المؤجلة تتجاوز هذه tokens وتستخدم `bg-white`, `text-gray-*`, `border-blue-*` ونصوصًا عربية صلبة؛ وهذا سبب عدم الاتساق، لا الهوية الأساسية نفسها.

---

## 4) مخزون التجربة الكامل

## 4.1 المسارات العامة الفعلية

| المسار | الشاشة/السلوك | الجمهور | الحالة الحالية |
|---|---|---|---|
| `/` | تحويل مباشر إلى `/login` | الجميع | فعّال، ولا توجد Landing عامة |
| `/login` | Login + لغة + Theme + أخطاء الإعداد/الدخول | الجميع | فعّال ومنشور |
| أي مسار عام غير معروف | تحويل إلى `/login` | الجميع | فعّال لكن بلا صفحة 404 مفهومة |
| `/book` | `BookingPage` | العميلة | **غير مسجل في routes**؛ يتحول إلى Login |
| `/portal` | `ClientPortalPage` | العميلة | **غير مسجل في routes**؛ يتحول إلى Login |
| Landing | `LandingPage` | عميلة/مشتري محتمل | الملف موجود فقط؛ غير مسجل |

## 4.2 المسارات التشغيلية المحمية

| المسار | المهمة الرئيسية | `ADMIN` | `MANAGER/STAFF` | الظهور في التنقل |
|---|---|---:|---:|---|
| `/dashboard` | ملخص اليوم، تنبيهات، إيراد، إجراءات سريعة | نعم | نعم | Sidebar + Bottom nav |
| `/appointments` | يوم/أسبوع، إنشاء/تعديل/حالات/no-show/reminder | نعم | نعم | Sidebar + Bottom nav |
| `/pos` | الكتالوج، السلة، العميل، الموظفة، الدفع، الإيصال | نعم | نعم | Sidebar + Bottom nav |
| `/customers` | قائمة/بحث/إضافة/تعديل/حذف/history/export | نعم | نعم | Sidebar + Bottom nav |
| `/services` | كتالوج/فئات/إضافة/تعديل/تعطيل/حذف | نعم | نعم | Sidebar + More |
| `/inventory` | منتجات/مخزون/low stock/إضافة/تعديل/تعطيل/حذف | نعم | نعم | Sidebar + More |
| `/gift-cards` | بيع بطاقة ورصيد/ledger | نعم | نعم | يظهر فقط إن أعادت القائمة بيانات موجودة؛ More يعرضه دائمًا |
| `/packages` | إنشاء باقة/entitlements/ledger | نعم | نعم | يظهر فقط إن وجدت بيانات؛ غير موجود في More |

## 4.3 مسارات `ADMIN`

| المسار | المحتوى | حالة الملاحة |
|---|---|---|
| `/employees` | CRUD الموظفات والراتب/العمولة | ظاهر للإدارة |
| `/reports` | تاريخ، KPIs، trend، مواعيد، مخزون، معاملات وتفاصيل | ظاهر للإدارة |
| `/settings` | ستة أقسام داخلية | ظاهر للإدارة |
| `/expenses` | CRUD المصروفات | route فعّال لكنه مخفي من Sidebar |
| `/customer-experience` | Reviews وservice files/before-after | route مؤجل مخفي |
| `/forecasting` | توقع المخزون والمال | route مؤجل مخفي |
| `/attendance` | سجلات الحضور وform | route مؤجل مخفي |
| `/advances` | السلف والموافقات | route مؤجل مخفي |
| `/payroll` | كشوف الرواتب والطباعة | route مؤجل مخفي |
| `/staff-analytics` | حضور وساعات وسلف ورواتب ورسوم | route مؤجل مخفي |
| `/accounting` | قيد journal وقائمة قيود | route مؤجل مخفي |
| `/advanced-automation` | AI leads وTauri status | route مؤجل مخفي |

## 4.4 أقسام Settings والروابط القديمة

| القسم | URL | المكونات/المهام |
|---|---|---|
| Center Profile | `/settings?tab=center` | بيانات المنشأة، الضريبة، العملة، الشعار |
| User Management | `/settings?tab=users` | إنشاء/تعديل/تفعيل/حذف مستخدم |
| Data & Backup | `/settings?tab=backup` | backup/export/auto-backup/restore |
| Branding | `/settings?tab=branding` | شعار، ألوان، بيانات عربية/إنجليزية، footer |
| Notifications | `/settings?tab=notifications` | WhatsApp/SMS/reminders/templates |
| Payment Gateway | `/settings?tab=payments` | provider, sandbox/live, deposit, URLs |
| `/branding` | redirect | إلى Branding |
| `/notifications` | redirect | إلى Notifications |
| `/payment-gateway` | redirect | إلى Payments |

## 4.5 عناصر التنقل والحوارات والقوائم

- Desktop Sidebar: مجموعات Daily Operations / Business / Management.
- Mobile Bottom nav: Home / Appointments / POS / Customers / More.
- Header: menu، center switcher، global search، notifications، user menu.
- Global Search: بحث صفحات + `Ctrl/Cmd+K` + الأسهم وEnter.
- Dialogs المشتركة: `Modal`, `ConfirmDialog`, `ReceiptPreviewModal`.
- Dialogs محلية منفصلة: Appointments، Customers، Expenses، Attendance، Advances؛ جودة الوصولية فيها غير موحدة.
- جداول: Customers, Services, Inventory, Employees, Expenses, Reports, Settings users، والوحدات المؤجلة.
- قوائم cards للهاتف موجودة لمعظم CRUD الأساسي، لكنها غير موجودة في الصفحات الصغيرة المؤجلة.

---

## 5) جرد الحالات المهمة

**الرموز:** ✅ موجودة بوضوح، ⚠️ موجودة جزئيًا أو تتحول إلى toast/فراغ، ❌ غير موجودة، — لا تنطبق.

| الشاشة | Loading/Skeleton | Empty | Success | Error + recovery | Disabled/duplicate | Offline | صلاحية/جلسة |
|---|---:|---:|---:|---:|---:|---:|---:|
| Login | ✅ زر signing | — | انتقال | ✅ رسالة، بلا recovery تقني | ✅ أثناء submit | banner فقط | خطأ session يندمج مع أخطاء login |
| Dashboard | ✅ | ✅ لعدة وحدات | — | ⚠️ toast ثم مساحات/قيم فارغة | refresh غير محكم دائمًا | banner فقط | redirect صامت |
| Appointments | ✅ | ✅ | ✅ toast | ✅ ScreenState/retry + toast | ✅ في الحفظ | banner فقط | redirect صامت |
| POS | ✅ | ✅ catalog/cart | ✅ receipt + toast | ✅ toast؛ receipt fallback | ✅ checkout loading | لا بيع دون backend | redirect صامت |
| Customers | ✅ | ✅ | ✅ | ✅ قائمة/توست | ✅ في create/save | لا CRUD | redirect صامت |
| Services | ✅ | ✅ | ✅ | ✅ ListState/retry | ✅ saving | لا CRUD | redirect صامت |
| Inventory | ✅ | ✅ | ✅ | ✅ ListState/retry | ✅ saving | لا CRUD | redirect صامت |
| Employees | ✅ | ✅ | ✅ | ✅ ListState/retry | ✅ saving | لا CRUD | redirect/deny صامت |
| Expenses | ✅ | ✅ | ✅ | ✅ ListState/retry | ⚠️ local modal submit | لا CRUD | deny صامت |
| Reports | ✅ | ✅ للأقسام | — | ✅/⚠️ حسب القسم | refresh موجود | cache shell فقط | deny صامت |
| Gift Cards | ✅ | ✅ | ✅ | ⚠️ toast ثم قد يبدو Empty | ✅ saving | لا عملية بيع | redirect صامت |
| Packages | ✅ | ✅ | ✅ | ⚠️ toast ثم قد يبدو Empty | ✅ saving | لا عملية | redirect صامت |
| Settings | ⚠️ | ✅ users | ✅ | ⚠️ toast بلا page error/retry | ✅ في معظم الحفظ | لا حفظ | deny صامت |
| Notification/Payments/Branding | ✅/⚠️ | — | ✅ | toast | ✅ saving | لا حفظ | deny صامت |
| Attendance/Advances/Payroll | ⚠️ spinner/text | ✅ | ✅ | toast غالبًا | ⚠️ غير موحد | لا CRUD | deny صامت |
| Staff Analytics | ⚠️ | ✅ | — | toast ثم فراغ | — | لا بيانات | deny صامت |
| Accounting/Automation/Forecasting | ❌/⚠️ | ❌ أو جدول فارغ | ✅ إن كان form | toast فقط | ❌ في بعض save | لا بيانات | deny صامت |
| Booking (غير موصول) | ⚠️ لا skeleton | ✅ services | ✅ confirmation | ✅ load/submit text بلا retry واضح | ✅ submitting | لا حجز | عام لو وُصل |
| Client Portal (غير موصول) | ✅ | ✅ | ✅ | text/toast حسب العملية | ⚠️ | لا بيانات | code login داخلي |

### حالات عامة

- **Offline:** `NetworkStatus` يعرض شريطًا فقط. Service worker يخزن shell/fonts/images؛ README يؤكد عدم وجود operating mode دون backend.
- **Expired session:** `RequireAuth` يحول إلى Login. لا رسالة “انتهت الجلسة”، ولا حفظ للمسودة.
- **Permission denied:** `RequireAdmin` يحول إلى Dashboard بلا تفسير ولا 403 state.
- **404:** لا توجد شاشة Not Found؛ كل شيء يتحول إلى Login أو Dashboard.
- **PWA install/update:** لا يوجد prompt داخل الواجهة. `autoUpdate` صامت.

---

## 6) النتائج حسب الأولوية

> النتائج التالية تسجل **خط الأساس وقت المراجعة** قبل تنفيذ أول milestone. حالة ما أُصلح فعلًا موثقة في القسم 13 حتى لا تختلط المشكلة الأصلية بالنتيجة الحالية.

## Critical

### C1 — حاجز مؤكد في Login للوصول وفهم الخطأ

- **الدليل:** فحص `axe-core` أعاد `button-name` بدرجة **critical** لزر إظهار كلمة المرور. الزر `tabIndex={-1}`، بلا `aria-label`، ولا يمكن لمستخدم لوحة المفاتيح الوصول إليه. حقلا username/password يعتمدان على placeholder ولا يملكان labels ثابتة.
- **دليل التباين:** لون خطأ Login في Light mode يساوي تقريبًا **1.58:1**، بينما المطلوب للنص العادي `4.5:1`. زر الدخول الأبيض فوق gradient يتراوح تقريبًا بين **2.15:1 و3.19:1**.
- **الأثر:** مستخدم قارئ الشاشة لا يعرف وظيفة زر العين، ومستخدم لوحة المفاتيح لا يستطيع استخدامه، ورسالة سبب فشل الدخول قد تكون شبه غير مقروءة.
- **إعادة الإنتاج:** افتح `/login` في Light mode؛ انتقل بـTab أو افحص accessible name؛ ثم أدخل بيانات خاطئة.
- **الإصلاح:** labels حقيقية مرتبطة بـ`id`, `autocomplete="username/current-password"`, زر عين 44px باسم وحالة `aria-pressed`, `role="alert"`, وألوان amber/red تحقق AA مع الحفاظ على طابع Login الذهبي.
- **النوع:** أساس مشترك/Authentication.

## High

### H1 — الحجز العام وClient Portal غير متاحين رغم وجودهما كمنتج

- **مؤكد:** `BookingPage`, `ClientPortalPage`, `LandingPage` موجودة، وLanding تحاول فتح `/book` و`/portal`، لكن `routes.tsx` لا يسجلها. أي رابط يتحول إلى Login.
- **الأثر:** رحلة عميلة كاملة لا يمكن إكمالها، وروابط تسويقية داخل Landing ستكون مكسورة إذا فُعلت الصفحة.
- **الإصلاح:** قرار منتج أولًا. إن كانت جاهزة: routes عامة واضحة مع اختبار RLS وrate limit. إن كانت مؤجلة: لا تُسوّق ولا توضع في manifest/docs حتى اعتمادها.
- **النوع:** Route-specific + قرار منتج.

### H2 — انتهاء الجلسة ورفض الصلاحية صامتان، والعودة للمهمة مفقودة

- **مؤكد:** guards تحفظ `state.from` لكن Login يتجاهلها وينتقل دائمًا إلى `/dashboard`. غير ADMIN يحول إلى Dashboard بلا رسالة.
- **الأثر:** قد تضيع مهمة أو سياق، ويظن المستخدم أن الرابط أو الزر معطل.
- **الإصلاح:** سبب تحويل مترجم، العودة الآمنة إلى `from` بعد الدخول، و`PermissionDenied` مع زر رجوع. لا تحفظ بيانات حساسة في URL.
- **النوع:** أساس routing/auth.

### H3 — الملاحة تعرض روابط خاطئة حسب الصلاحية

- **مؤكد:** `Mobile More` يعرض Reports/Employees/Settings لكل الأدوار. `GlobalSearch` يعرض كل admin/deferred routes بلا فلترة. Dashboard في البحث يذهب إلى `/`، وهذا route يحول إلى Login.
- **الأثر:** نقرات تنتهي بتحويل مفاجئ، تسريب شكل وظائف إدارية، وفقد ثقة.
- **الإصلاح:** مصدر واحد لعناصر التنقل مع `requiredRole/permission` يستخدمه Sidebar وBottom nav وSearch. تصحيح Dashboard إلى `/dashboard`.
- **النوع:** Design-system/navigation foundation.

### H4 — حقول كثيرة ليست مرتبطة بتسميات برمجية

- **مؤكد:** عشرات `<label>` بلا `htmlFor`، وحقول بلا `id/aria-labelledby` في Appointments, Customers, Employees, Inventory, Expenses والوحدات المؤجلة. Accounting/Automation/Gift Cards تعتمد كثيرًا على placeholders فقط.
- **الأثر:** قارئ الشاشة قد يعلن “edit text” دون اسم، وتختفي التعليمات بعد الكتابة.
- **الإصلاح:** بناء `FormField` مشترك يدير `id`, label, hint, error, `aria-describedby`, `aria-invalid`; ثم ترحيل النماذج بالترتيب: Login → POS/Appointments → Customers → Settings → الباقي.
- **النوع:** Design-system foundation.

### H5 — الحوارات المحلية لا تحقق مستوى `Modal` المشترك

- **مؤكد:** Appointments/Customers/Expenses/Attendance/Advances تنشئ overlays محلية بدل `Modal`. بعضها بلا `role="dialog"`, accessible title, focus trap أو استعادة التركيز. `ConfirmDialog` نفسه لا يطبق trap/restore كاملًا.
- **الأثر:** يمكن أن ينتقل Tab خلف الحوار، ويضيع موضع المستخدم عند الإغلاق.
- **الإصلاح:** استخدام `Modal` الموجود بدل overlays المحلية، وتحسين `ConfirmDialog` بنفس focus utility.
- **النوع:** Design-system foundation ثم route migration.

### H6 — English/RTL localization غير كاملة في وحدات الموظفين المؤجلة

- **مؤكد:** `Attendance`, `Advances`, `StaffAnalytics` تحتوي مئات المحارف العربية الصلبة؛ Payroll يستخدم شروطًا ثنائية محلية بدل `i18n`. توجد `text-right`, `border-l`, وألوان fixed كثيرة.
- **الأثر:** English mode يعرض مزيج لغتين، وLTR/RTL لا ينعكس بالكامل. Dark mode قد يعرض نصًا منخفض التباين.
- **الإصلاح:** نقل النصوص إلى `i18n`, استخدام logical properties, status keys، وtokens الحالية. لا ترقي هذه الوحدات إلى الملاحة قبل اكتمال ذلك.
- **النوع:** Route family remediation.

### H7 — PWA deep links والتثبيت/التحديث لا تطابق Router

- **مؤكد:** التطبيق يستخدم `HashRouter`، لكن manifest يحتوي `start_url: '/dashboard'` وshortcuts مثل `/pos` بدل `/#/dashboard` و`/#/pos`. لا يوجد `beforeinstallprompt` UI ولا update notice. `orientation: 'portrait'` يمنع حرية الاتجاه عند التشغيل كتطبيق.
- **الأثر:** shortcut قد يفتح Login بدل المهمة، والتحديث الصامت قد يبدل نسخة التطبيق أثناء العمل، وتجربة tablet landscape مقيدة.
- **الإصلاح:** URLs متوافقة مع hash، `orientation: any` ما لم يوجد سبب تجاري، install prompt غير مزعج، وإشعار update بعد إكمال المهمة.
- **النوع:** PWA foundation.

### H8 — التمييز بين خطأ التحميل والبيانات الفارغة غير ثابت

- **مؤكد:** Gift Cards/Packages وبعض Settings والوحدات الصغيرة تعرض toast فقط عند load failure؛ بعدها قد تظهر قائمة فارغة. Accounting/Automation/Forecasting لا تملك ScreenState متكاملًا.
- **الأثر:** المستخدم قد يعتقد أنه لا توجد بيانات بينما الشبكة أو الصلاحية هي السبب.
- **الإصلاح:** `ListState/ScreenState` الموجودان مع retry وerror code مفهوم، وعدم استبدال البيانات القديمة بفراغ أثناء refresh.
- **النوع:** reusable state pattern + route patches.

## Medium

### M1 — لا يوجد `Skip link` أو focus style موحد أو عنوان صفحة ديناميكي

- **مؤكد:** `axe` أبلغ عن محتوى خارج landmarks في Login. Layout لديه `<main>` جيد لكن بلا skip target. كثير من العناصر تستخدم `outline-none` وحلقات focus غير موحدة. `<title>` ثابت “Lena Beauty”.
- **الأثر:** تنقل keyboard طويل، وصعوبة معرفة الصفحة في screen reader/browser history.
- **الإصلاح:** skip link، `id="main-content"`, `:focus-visible` موحد، وتحديث `document.title` حسب route/language.

### M2 — `GlobalSearch` ليس Dialog/Combobox كاملًا

- **مؤكد:** overlay بلا `role="dialog"`, `aria-modal`, label ثابت أو focus trap/restore. النتائج لا تستخدم `listbox/option` ولا `aria-activedescendant`.
- **الأثر:** قارئ الشاشة لا يفهم فتح البحث ولا العنصر المحدد بالأسهم.
- **الإصلاح:** إعادة استخدام `Modal` أو command-dialog accessible، مع role مناسب وإرجاع focus.

### M3 — Tabs والإعدادات لا تستخدم semantics ولوحة مفاتيح tabs

- **مؤكد:** `Tabs` مجرد buttons بلا `tablist/tab/tabpanel`, ولا Arrow navigation. Settings تكرر نمطًا منفصلًا، وتضع `<main>` داخل `<main>` الخاص بالـLayout.
- **الأثر:** screen reader لا يفهم العلاقة، وتعدد main landmarks غير صحيح.
- **الإصلاح:** تحسين `Tabs` المشترك واستخدامه في Settings أو تطبيق نفس contract؛ استبدال main الداخلي بـsection.

### M4 — Toast وNetwork status لا يعلنان التغيير

- **مؤكد:** Toast لا يملك `role=status/alert` أو `aria-live`; زر إغلاقه إنجليزي صلب. Network banner بلا live region.
- **الأثر:** مستخدم قارئ الشاشة قد لا يعرف نجاح الدفع أو فشل الحفظ أو انقطاع الشبكة.
- **الإصلاح:** error=`alert/assertive`، success/info=`status/polite`، زر إغلاق مترجم، وإيقاف المؤقت عند hover/focus أو توفير سجل.

### M5 — التباين الأساسي للـPrimary قريب لكنه دون AA للنص الصغير

- **مؤكد:** `--primary` الفاتح مقابل الأبيض ≈ **4.31:1**، أقل من 4.5:1 للنص العادي. التطبيق يستخدم primary مع `text-xs` و`text-[10px]` في مواضع.
- **الأثر:** أزرار/شارات صغيرة قد تفشل AA.
- **الإصلاح:** تغميق درجة primary الفاتحة قليلًا للنص/الأزرار، أو استخدام foreground داكن عندما لا يتحقق 4.5. لا تغير الهوية.

### M6 — أحجام نص 9–10px كثيرة

- **مؤكد:** Header/cards/status metadata تستخدم `text-[9px]` و`text-[10px]` بكثرة.
- **الأثر:** قراءة صعبة على الهاتف وzoom، خصوصًا العربية ذات تفاصيل أكثر.
- **الإصلاح:** حد عملي 12px للمعلومات المهمة، مع إبقاء uppercase metadata الثانوية فقط أكبر عند العربية وبدون letter spacing مبالغ.

### M7 — أهداف لمس صغيرة في Login وبعض icon buttons

- **مؤكد:** language/theme controls 36px تقريبًا، زر العين أصغر، وبعض أزرار الجداول تعتمد padding صغيرًا.
- **الأثر:** أخطاء لمس على الهاتف.
- **الإصلاح:** `touch-target` 44×44 لكل icon button؛ لا يلزم تكبير الأيقونة نفسها.

### M8 — اتجاهات فيزيائية لا تزال موجودة

- **مؤكد:** `border-l`, `text-right`, timeline `left-4`, calendar `border-r`, GlobalSearch `ml-auto`, badge `-right-1`, ومواضع fixed في صفحات متعددة.
- **الأثر:** بعض الزخارف أو المحاذاة لا تنعكس في RTL/LTR.
- **الإصلاح:** `border-s`, `text-start/end`, `start/end`, `ms-auto`، مع استثناءات موثقة للأرقام والطباعة.

### M9 — تنسيق التاريخ/العملة غير مركزي في الصفحات المؤجلة

- **مؤكد:** Accounting يستخدم `toLocaleDateString()` بلا locale محدد، وصفحات أخرى تستخدم `toFixed` و`OMR` أو `$` داخل print للرواتب.
- **الأثر:** أرقام/تواريخ مختلطة، وPayroll print يعرض رمز `$` رغم سياق OMR.
- **الإصلاح:** استخدام `shared/dateTime` و`shared/money` و`Intl` مع `ar-OM/en-OM` و`dir=ltr` للمقاطع الرقمية عند الحاجة.

### M10 — لا توجد حماية موحدة من الضغط المكرر

- **مؤكد:** النماذج الأساسية الرئيسية تضبط saving/loading غالبًا، لكن Accounting وAutomation وبعض modals المحلية لا تعطل زر الحفظ، وExpenses لا يملك busy موحدًا للـsubmit.
- **الأثر:** إدخالات مكررة محتملة على شبكة بطيئة؛ checkout نفسه أقوى بسبب idempotency backend.
- **الإصلاح:** `AsyncButton` مشترك مع pending label، disabled و`aria-busy`، مع idempotency للعمليات المالية.

### M11 — الرسوم ليست لها بدائل وصفية كافية

- **مؤكد:** Recharts يقدم visualization، لكن لا توجد table/text summary ملازمة لكل chart في Reports/Staff Analytics. Dashboard أفضل لأنه يعرض أرقامًا منفصلة.
- **الأثر:** قارئ الشاشة لا يحصل على الاتجاه والتوزيع.
- **الإصلاح:** caption موجز + summary/list قابل للقراءة، وعدم الاعتماد على اللون وحده.

### M12 — الإشعار الأحمر في Header ليس مبنيًا على حالة حقيقية

- **مؤكد:** نقطة notification تظهر دائمًا بلا count أو unread state.
- **الأثر:** إشارة كاذبة تقلل الثقة.
- **الإصلاح:** إخفاؤها إن لم توجد unread data، أو عرض count وaccessible label حقيقي.

### M13 — تحذير controlled/uncontrolled مؤكد في Branding

- **مؤكد:** المجموعة الكاملة تنجح، لكنها تطبع تحذير React بأن حقلًا في اختبار `branding-persistence` يتحول من controlled إلى uncontrolled. اختبارات Reports تطبع أيضًا تحذيرات `act(...)`.
- **الأثر:** الأول قد يعني أن قيمة حقل تظهر أو تختفي بصورة غير متوقعة عند فشل fallback؛ والثاني يقلل ثقة اختبار الحالة النهائية المعروضة، ولو أنه لا يثبت عيبًا للمستخدم وحده.
- **الإصلاح:** تطبيع كل `value` إلى string/boolean ثابت (`?? ""`) وإكمال انتظار تحديثات Reports داخل الاختبار قبل assertion.

## Low / اقتراحات

### L1 — لا توجد 404 مفهومة

بدل التحويل الصامت، صفحة صغيرة تشرح أن الرابط غير موجود وتحافظ على Login/Dashboard حسب الجلسة.

### L2 — Breadcrumbs ليست ضرورية الآن، لكن Settings وReports تستفيدان منها

هذا **اقتراح**؛ لا حاجة لإضافتها لكل الصفحات. عنوان الصفحة واسم subsection يكفيان غالبًا.

### L3 — بعض الحركة زخرفية أكثر من اللازم

`reduced-motion` يحمي المستخدمين، لذا ليست أولوية. يمكن تقليل stagger في Sidebar والـhover scale على شاشات العمل السريع فقط.

### L4 — الخط من Google يزيد اعتماد أول تشغيل على الشبكة

يوجد system fallback، لذلك الأثر محدود. يمكن self-host لاحقًا لتحسين الثبات والخصوصية.

---

## 7) مراجعة الرحلات الحرجة

### 7.1 الدخول والعودة للعمل

**الحالي:** Login → دائمًا Dashboard.  
**المشكلة:** لا عودة إلى الرابط المطلوب، لا session-expired copy، وحقول login غير مكتملة الوصولية.  
**المطلوب:** دخول → التحقق من membership → العودة إلى route المسموح → إعلان نجاح/سبب فشل واضح. لا تعرض تفاصيل Supabase التقنية للموظفة.

### 7.2 عميلة جديدة → موعد

**القوة:** Appointments يسمح بإنشاء عميلة inline، واختيار خدمة/موظفة/وقت، ويدعم الحالات النهائية/no-show.  
**المخاطر:** dialog محلي، labels غير مرتبطة، التحقق يظهر غالبًا toast بدل error عند الحقل، ولا يوجد guard لمسودة عند كل طرق الإغلاق.  
**الإصلاح:** `Modal + FormField`; أول حقل خطأ يأخذ focus؛ overlap error يشرح الوقت البديل.

### 7.3 عميلة → POS → دفع → إيصال

**القوة:** رحلة موحدة، دعم starts-from، gift card/package، التحقق من الخصم والطريقة، receipt fallback، وcheckout backend idempotency.  
**المخاطر:** بعض feedback يعتمد على Toast غير معلن، وcart controls تحتاج اسم/حجم شامل، وفشل refresh بعد الدفع يظهر كخطأ قد يوحي بفشل الدفع رغم نجاحه.
**الإصلاح:** رسالة حالة مستقرة: “تم الدفع؛ تعذر تحديث الكتالوج” مع زر retry، live region، وعدم إعادة زر الدفع.

### 7.4 إدارة الكتالوج والمخزون

**القوة:** disable بدل حذف تاريخي، empty/error states، desktop/mobile views، وتأكيد حذف.  
**المخاطر:** labels/field errors غير موحدة، والجداول تحتاج `scope` وcaption مخفي.  
**الإصلاح:** FormField + DataTable semantics مع إبقاء التصميم.

### 7.5 التقارير والإدارة

**القوة:** Date range وtransaction drill-down، وتقييد routes للإدارة.  
**المخاطر:** search/mobile menu لا يحترمان التقييد؛ charts بلا بديل؛ الصفحات الإدارية المؤجلة متفاوتة بشدة.  
**الإصلاح:** permissions source واحد، summaries نصية، وعدم إظهار deferred modules في البحث قبل اعتمادها.

### 7.6 Backup/Restore والثقة

**القوة:** restore يقدم تحذيرًا، والأسرار لا تُطلب في Git.  
**المخاطر:** يحتاج توضيح آخر backup/date/file، وإعلان progress، ومنع مغادرة الصفحة أثناء restore.  
**الإصلاح:** status stepper بسيط، confirm يذكر اسم الملف/الوقت، ونتيجة قابلة للنسخ للدعم.

---

## 8) إصلاحات النظام المشترك مقابل إصلاحات الصفحات

## أولًا: إصلاحات مشتركة قابلة لإعادة الاستخدام

1. `FormField`, `FieldError`, و`AsyncButton`.
2. accessible `Tabs` و`CommandDialog/GlobalSearch`.
3. `Modal/ConfirmDialog` focus contract واحد.
4. Navigation registry واحد مع permissions وvisibility.
5. Router feedback: expired-session, permission-denied, 404, return-to.
6. `Toast/NetworkStatus` live announcements.
7. `DataTable` semantics + mobile card fallback contract.
8. `Intl` helpers للتاريخ/العملة/الأرقام و`bidi isolation`.
9. focus-visible، skip link، page titles، landmarks.
10. PWA install/update/deep-link contract.

## ثانيًا: إصلاحات خاصة بالصفحات

- Login: labels/contrast/password toggle/autocomplete.
- Appointments/Customers/Expenses: ترحيل overlays المحلية.
- POS: تثبيت حالة نجاح الدفع وفشل refresh.
- Gift Cards/Packages: فصل error عن empty.
- Settings: إزالة main المتداخل وتطبيق tab semantics.
- Attendance/Advances/Payroll/Staff Analytics: i18n + tokens + RTL + states كاملة.
- Accounting/Automation/Forecasting: states، labels، responsive table، منع duplicate submit.
- Booking/Portal/Landing: قرار إطلاق ومسارات عامة واختبار أمني قبل التفعيل.

---

## 9) مصفوفة الاختبار المطلوبة

| المحور | الحالات | ما يجب التحقق منه | وضع هذه المراجعة |
|---|---|---|---|
| العرض | 320×568, 360×800, 390×844, 430×932 | reflow، keyboard، bottom nav، 44px | static + tests فقط؛ جهاز فعلي مطلوب |
| Tablet | 768×1024 و1024×768 | portrait/landscape، الجدول، sidebar | لم يُغلق بصريًا |
| Desktop | 1280×720, 1440×900, 1920×1080 | density، max widths، dialogs | build/static؛ جلسة مصادقة مطلوبة |
| Zoom | 200% و400% | لا فقد وظائف/نص/scroll ثنائي | غير منفذ بمتصفح فعلي |
| اللغة | Arabic/English | لا raw keys أو نص مختلط | اختبارات core نجحت؛ deferred تفشل بالمراجعة |
| الاتجاه | RTL/LTR | logical spacing، arrows، dates، mixed phone/currency | document dir مؤكد؛ مخالفات مذكورة |
| Keyboard | Tab/Shift+Tab/Enter/Space/Escape/arrows | focus visible، trap، restore، tabs/search | Modal tests موجودة؛ Login barrier مؤكد |
| Screen reader | NVDA/Chrome, VoiceOver/Safari | names، landmarks، announcements، table headers | axe DOM فقط؛ اختبار فعلي مطلوب |
| Contrast | Light/Dark/high contrast | 4.5:1 text، 3:1 UI/large | Login failures مؤكدة بالحساب |
| Motion | reduce/no preference | لا حركة ضرورية، لا فقد context | CSS reduced motion مؤكد |
| Network | offline, 2G, timeout, reconnect | stale data، retry، عدم تكرار الدفع | banner موجود؛ operating offline غير موجود |
| Session | expired أثناء form/checkout | حفظ مسودة، رسالة، return-to | redirect صامت مؤكد |
| Permissions | ADMIN/MANAGER/STAFF | nav/search/route/action/backend | route guard موجود؛ nav drift مؤكد |
| PWA | install/update/shortcut/standalone | hash deep links، update safety، orientation | manifest mismatch مؤكد |
| Print | 80mm + A4، عربي/إنجليزي | wrap، bidi، totals، logo | automated layout tests؛ طابعة فعلية مطلوبة |

### سيناريوهات قبول يدوية بعد كل milestone

1. ابدأ من آخر عنصر في Header، اضغط Tab عبر الصفحة، ولا يجب أن يختفي focus.
2. افتح كل dialog، حاول Tab للخلف والأمام، Escape، ثم تحقق من عودة focus للزر نفسه.
3. غيّر اللغة أثناء dialog ومع وجود بيانات عربية/أرقام هاتف وOMR.
4. افتح لوحة مفاتيح الهاتف في آخر حقل؛ يجب أن يبقى زر الحفظ مرئيًا ولا يغطيه bottom nav.
5. اقطع الشبكة قبل الحفظ، أثناء الحفظ، وبعد نجاح checkout.
6. انتهت الجلسة أثناء تعديل غير محفوظ؛ يجب ألا يظهر نجاح كاذب وألا تضيع المسودة بلا تحذير.
7. جرّب STAFF على كل عنصر Sidebar/More/Search؛ لا يظهر admin item.

---

## 10) خطة المعالجة المرحلية

### Milestone 1 — أساس الوصول والدخول والتنقل الآمن (آمن وعالي القيمة)

- إصلاح Login semantics/contrast/password control.
- skip link + focus-visible + main target + page title.
- live announcements للـToast والشبكة.
- تحسين ConfirmDialog focus.
- فلترة عناصر mobile/search حسب الدور وتصحيح Dashboard path.
- اختبارات keyboard/RTL/axe للمكوّنات المعدلة.

**معيار الخروج:** لا `axe critical` في Login، كل عنصر Login يصل إليه keyboard، contrast AA محسوب، STAFF لا يرى admin links في shell/search، والـdiff محدود بالأساس المشترك.

### Milestone 2 — Form foundation والحوارات

- `FormField/AsyncButton` ثم Login/Appointments/Customers/POS/Settings.
- ترحيل local overlays إلى `Modal`.
- inline errors + focus first invalid + duplicate prevention.

### Milestone 3 — Session/permission/error states

- return-to، expired-session، permission-denied، 404.
- error ≠ empty في كل route، retry/stale-data.
- تثبيت رسائل النجاح المالي.

### Milestone 4 — Localization/RTL/design debt

- Attendance/Advances/Payroll/Staff Analytics أولًا.
- إزالة physical CSS، hard-coded light colors، وتوحيد date/money.
- رفع النصوص المهمة من 9–10px.

### Milestone 5 — PWA وpoor network

- hash-safe manifest، install/update UI، `orientation:any`.
- تعريف صريح لما يعمل offline، queue فقط إن كان آمنًا وغير مالي.
- اختبارات timeout/reconnect/update أثناء POS.

### Milestone 6 — قرار وإطلاق رحلات العميلة

- قرار واضح للحجز وPortal وLanding.
- قبل التفعيل: RLS، rate limiting، privacy copy، lockout، public error states، mobile/VoiceOver.
- بعد الموافقة فقط: routes العامة والتسويق.

### Milestone 7 — قبول فعلي

- ADMIN/STAFF/MANAGER ببيانات Staging.
- أجهزة فعلية + screen readers + 80mm printer.
- حفظ screenshots/results وأرقام Lighthouse/axe الحقيقية. لا تُنقل ادعاءات التقرير القديم غير القابلة للإثبات.

---

## 11) ما لا أوصي به

- لا إعادة تصميم شاملة.
- لا تغيير الهوية البنفسجية/الوردية أو استبدال `Cairo`.
- لا إضافة animations جديدة قبل إصلاح focus/states.
- لا إظهار الوحدات المؤجلة في Sidebar لمجرد أن route موجود.
- لا ادعاء “offline app” أو “WCAG compliant” قبل اختبار Staging والأجهزة الفعلية.
- لا تفعيل Booking/Portal علنًا من دون مراجعة صلاحيات وخصوصية مستقلة.

---

## 12) نتيجة الأولوية

أفضل عائد الآن ليس صفحة جميلة جديدة؛ بل جعل **الدخول والتنقل ورسائل الحالة** قابلة للفهم والعمل لكل المستخدمين، ثم توحيد النماذج والحوارات. هذا يحافظ على هوية LenaBeauty ويصلح أساسًا يتكرر في كل صفحة بدل عشرات ترقيعات منفصلة.

---

## 13) سجل تنفيذ Milestone 1 في هذه الدفعة

تم تنفيذ الجزء الآمن عالي القيمة فقط، ولم تبدأ ترقيعات الصفحات الواسعة:

- **Login:** labels مرتبطة، `autocomplete`, `required`, `aria-invalid/describedby`, زر إظهار كلمة المرور قابل للوحة المفاتيح وله اسم وحالة، أهداف 44px، landmark رئيسي، ورسالة خطأ معلنة.
- **Contrast في Login:** أصبح أضعف طرف في gradient زر الدخول ≈ **4.92:1** بدل 2.15:1، ورسالة الخطأ الفاتحة ≈ **6.80:1** بدل 1.58:1. هذه حسابات ألوان؛ يلزم تأكيد المتصفح مع أي opacity نهائية مستقبلًا.
- **Shell:** `Skip link`, target للمحتوى، focus-visible موحد، landmarks مسماة، عناوين browser ديناميكية، وأسماء/حالات لأزرار اللغة والثيم والقوائم.
- **Navigation permissions:** STAFF/MANAGER لا يريان admin destinations في `Mobile More`, user menu أو `GlobalSearch`. صحح Search مسار Dashboard من `/` إلى `/dashboard`.
- **GlobalSearch:** أصبح dialog/combobox مسمى، يحبس التركيز، يعيده للمشغّل، ويدعم الأسهم وEnter وEscape دون كسر أزرار الحوار.
- **Feedback:** Toast وnetwork offline/online يعلنان الحالات؛ زر إغلاق Toast مترجم و44px.
- **ConfirmDialog:** focus trap، استعادة التركيز، قفل الخلفية، Escape، والبدء على Cancel الآمن بدل تأكيد الحذف.
- **Tabs:** `tablist/tab/tabpanel`, roving tabindex، Home/End، وأسهم معكوسة منطقيًا في RTL.
- **Settings:** إزالة `<main>` المتداخل، تسمية section navigation، وإعطاء Auto-Backup switch اسمًا وحالة.
- أزيلت نقطة notification الدائمة غير المبنية على unread data.

### تحقق ما بعد التنفيذ

- `npm run typecheck` — نجح.
- المجموعة الكاملة: **90 test files / 476 tests passed**.
- `npm run build` — نجح؛ `precache` = **1910.08 KiB**.
- `axe-core` بعد التنفيذ:
  - Login العربية: **0 violations** مع تعطيل قاعدة contrast غير الموثوقة في `jsdom`.
  - Search + Tabs داخل landmark: **0 violations** بالإعداد نفسه.
- اختبارات render/keyboard الجديدة أكدت:
  - تنقل Tabs في LTR وRTL.
  - حبس/استعادة focus في Confirm وSearch.
  - إعلان Toast.
  - إخفاء admin search results عن STAFF.
  - Dashboard search يفتح `/dashboard`.
- شُغّل Vite بنجاح على `0.0.0.0:5173`، والـLive Preview متاح لفحص Login الحالي.

### ما لم أدّعِه

لم أعتبر milestone ناجحًا بصريًا على أجهزة فعلية؛ تنزيل Chromium فشل في بيئة المراجعة، ولا توجد بيانات دخول Demo هنا. لذلك تبقى مصفوفة الهاتف الفعلي، zoom، قارئات الشاشة، الصفحات المصادقة والطابعة ضمن قبول لاحق. كما بقيت H1/H2/H4 لبقية النماذج/H5 للحوارات المحلية/H6/H7/H8 وبقية النتائج مفتوحة.
