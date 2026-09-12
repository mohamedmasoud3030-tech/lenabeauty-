# دليل النسخ الاحتياطي والاستعادة — لارا بيوتي

**لمن هذا الملف:** من يشغّل النظام (أنت أو من ينوب عنك). اقرأه قبل أن تحتاجه، لأن أول قراءة له لن تكون في وقت مناسب.

**المشروع:** `tuzzvqsnbtzvkffmazyf` (`https://tuzzvqsnbtzvkffmazyf.supabase.co`) — أقرب منطقة: `ap-south-1`.

> **حالة هذا الدليل:** مكتوب ومُراجَع مقابل بنية المشروع الفعلية (أسماء الجداول، الحاويات، الدوال)، لكن **أوامره لم تُنفّذ بعد على المشروع الحي**. أول تنفيذ هو البند الأخير في قائمة «ما يجب عمله» — لا تعتبره مُجرَّبًا قبل ذلك.

---

## ١. ما يوفّره Supabase تلقائيًا — وما لا يوفّره

| الخطة | نسخ القاعدة تلقائيًا | مدة الاحتفاظ |
| --- | --- | --- |
| Free | **لا شيء** | — |
| Pro | نسخة يومية | ٧ أيام |
| Team | نسخة يومية | ١٤ يومًا |
| Enterprise | نسخة يومية | حتى ٣٠ يومًا |
| PITR (إضافة مدفوعة على أي خطة) | استرجاع بالثانية | حسب المدة المشتراة |

ثلاث نقائص لا يغطيها أي سطر في الجدول أعلاه، وكلها تخصّ هذا المشروع:

1. **ملفات التخزين لا تُنسَخ أبدًا** — نسخة القاعدة تحفظ أسماء الملفات ووصفها فقط. شعارات الصالون المرفوعة تقع في حاوية `center-assets`، ولذلك لها نسخة منفصلة (البند ٤).
2. **الخطة المجانية تعني صفر نسخ** — لا يوجد ما تستعيد منه إطلاقًا. إن كان المشروع على Free، فالبند ٣ ليس «تحسينًا» بل هو الحماية الوحيدة الموجودة.
3. **النسخ اليومية تتراجع بعد أسبوع** — قسْ على ذلك: خطأ مكتشف بعد عشرة أيام لا علاج له من نسخ Supabase، بل من نسخة خارجية.

---

## ٢. ما يجب حمايته في هذا المشروع بالتحديد

| ما هو | لماذا يهمّ | إن فُقد |
| --- | --- | --- |
| `public.customers` | بيانات العميلات: الاسم والهاتف | لا استرجاع — وهي أساس كل شيء |
| `customers.portal_access_token` + `portal_access_enabled` | **بوابة العميلة كلها تعتمد عليهما**؛ لا كلمات مرور ولا حسابات للعميلات | كل عميلة تفقد الوصول لمواعيدها، ويجب إصدار رموز جديدة يدويًا لكل واحدة |
| `public.appointments` + `public.services` | جدول المواعيد والخدمات وأسعارها | فقدان الحجوزات القادمة |
| `public.invoices` + `invoice_items` + `payments` | المال: ما دُفع وما بقي | فروق مالية لا يمكن إثباتها |
| `public.employees` (الحقول المالية) + `payroll_line_items` + `employee_advances` | الرواتب والسلف | خلافات مع الفريق |
| `public.products` (`stock_quantity`, `reorder_level`) | المخزون وحدّ إعادة الطلب | لا يمكن معرفة الرصيد الحقيقي |
| حاوية `center-assets` | شعار الصالون وأصول الواجهة | يعود الاسم والشعار الافتراضي |
| `auth.users` | حسابات الموظفين (عدد قليل) | تُعاد يدويًا من قائمة الأسماء — **لا تُشتقّ من النسخة** |
| `public.public_request_throttle` | عدّادات تحديد المعدل | **لا يهمّ** — تُقرأ من الصفر بعد الاستعادة |

**الخبر الجيد:** كل ما يخصّ العميلات والمال يقع في مخطط `public`، ويعود كاملًا مع النسخة. أما حسابات الموظفين فمصدرها `auth` وتُعاد بالدعوة من جديد (دقائق لعدد قليل من الأشخاص).

---

## ٣. النسخة اليومية المعتمدة (القاعدة + المخططات)

احفظ رابط الاتصال في مدير كلمات المرور، لا في المستودع:

```bash
# لا تُكتب كلمة المرور في أي ملف أو أمر محفوظ — تُصدَّر من مدير كلمات المرور في الجلسة فقط.
export PGHOST='aws-0-ap-south-1.pooler.supabase.com'
export PGUSER='postgres.tuzzvqsnbtzvkffmazyf'
export PGDATABASE='postgres'
export PGPORT='5432'
export PGPASSWORD='…'   # ← الصق كلمة مرور القاعدة هنا في الجلسة فقط

export BACKUP_DIR="$HOME/larabeauty-backups/$(date +%F)"
mkdir -p "$BACKUP_DIR"
```

### الخيار المعتمد: Supabase CLI (يفهم المخططات المُدارة)

```bash
supabase link --project-ref tuzzvqsnbtzvkffmazyf -p "$PGPASSWORD"
supabase db dump -f "$BACKUP_DIR/roles.sql" --role-only
supabase db dump -f "$BACKUP_DIR/schema.sql"
supabase db dump -f "$BACKUP_DIR/data.sql" --data-only --use-copy
```

**ثلاثة ملفات، لا ملف واحد** — وهذا مقصود: نسخة CLI الافتراضية تحمل المخطط بلا بيانات ولا أدوار، فحذف أي ملف من الثلاثة يجعل النسخة ناقصة بصمت.

### البديل: `pg_dump` مباشرةً (إن تعذّر الربط)

```bash
pg_dump --schema=public --schema=app_private --no-owner --no-privileges \
  --format=custom -f "$BACKUP_DIR/public.dump"
pg_dump --schema=public --schema=app_private --no-owner --no-privileges \
  --data-only --use-copy -f "$BACKUP_DIR/public-data.sql"
```

### ثم: التشفير والإخراج خارج المشروع

```bash
# مفتاح عام age (يُحفظ مفتاحه الخاص في مكانين منفصلين)
tar -C "$BACKUP_DIR/.." -czf - "$(basename "$BACKUP_DIR")" \
  | age -r "$(cat ~/.age/larabeauty.pub)" > "$BACKUP_DIR.tar.gz.age"

# نسختان في مكانين مختلفين — ولا واحدة منهما داخل مشروع Supabase نفسه
rclone copy "$BACKUP_DIR.tar.gz.age" remote1:larabeauty-backups/
rclone copy "$BACKUP_DIR.tar.gz.age" remote2:larabeauty-backups/
```

إن لم يتوفر `age`، البديل `gpg -c` بكلمة مرور قوية محفوظة في مدير كلمات المرور.

---

## ٤. نسخة التخزين (`center-assets`) — منفصلة إلزاميًا

```bash
# الأسلم: من لوحة Supabase → Storage → center-assets → تنزيل المجلد
# أو عبر CLI (تجريبي):
supabase storage cp -r ss:///center-assets "$BACKUP_DIR/center-assets"
# أو عبر نقطة S3 المتوافقة بمفاتيح تُنشأ من اللوحة:
rclone sync :s3,provider=Other,endpoint=https://tuzzvqsnbtzvkffmazyf.storage.supabase.co/storage/v1/s3,access_key_id=<KEY>,secret_access_key=<SECRET>:center-assets "$BACKUP_DIR/center-assets"
```

الملفات قليلة الحجم (شعارات)، فالنسخة اليدوية الشهرية كافية ما لم يتغير الشعار أسبوعيًا.

---

## ٥. القاعدة الذهبية: نسخة قبل كل تغيير على القاعدة

قبل تطبيق أي migration — بما فيها **ملفَّا الترحيل غير المطبَّقين حاليًا على المشروع الحي** (`20260912100000_commission_engine.sql` و`20260912110000_public_booking_release.sql`) — نفّذ البند ٣ كاملًا أولًا. تغيير المخطط بلا نسخة هو الطريقة الوحيدة لتحويل خطأ دقائق إلى فقدان بيانات.

في هذا المشروع بالذات: `#/book` معطّل حيًّا حتى يُطبَّق ملف الإصدار، وتطبيقه يعني تعديل المنح على القاعدة الحيّة — نسخة أولًا، ثم التطبيق.

---

## ٦. تمرّدُ الاستعادة (Restore drill)

النسخة التي لم تُستعَد مرّة واحدة ليست نسخة مجرَّبة. أنشئ مشروع Supabase مؤقتًا (نفس المنطقة `ap-south-1`)، ثم:

```bash
# ثم أشِر المتغيّرات إلى مشروع الاستعادة (لا رابط مكتوب أبدًا)
# استبدل متغيّرات الاتصال بمشروع الاستعادة (نفس أسماء PGHOST/PGUSER/PGPASSWORD)
export PGHOST="$TARGET_HOST" PGUSER="$TARGET_USER" PGPASSWORD="$TARGET_PASSWORD"
psql -d "$PGDATABASE" -f roles.sql
psql -d "$PGDATABASE" -f schema.sql
psql -d "$PGDATABASE" -f data.sql
```

ثم شغّل هذه الفحوص — كل واحد منها يقابل عطلًا حقيقيًا محتملًا:

```sql
-- ١) لا يوجد جدول في public بلا RLS مُفعّل. يجب أن تكون النتيجة صفر صفوف.
SELECT c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- ٢) الأرقام الحرجة تطابق المصدر (قارنها بعدّها على المشروع الأصلي).
SELECT
  (SELECT count(*) FROM public.centers)          AS centers,
  (SELECT count(*) FROM public.customers)        AS customers,
  (SELECT count(*) FROM public.appointments)     AS appointments,
  (SELECT count(*) FROM public.services)         AS services,
  (SELECT count(*) FROM public.invoices)         AS invoices,
  (SELECT count(*) FROM public.payments)         AS payments,
  (SELECT count(*) FROM public.products)         AS products;

-- ٣) بوابة العميلة تعمل: كل عميلة مُفعَّلة لها رمز وصول.
SELECT count(*) FROM public.customers
WHERE portal_access_enabled = TRUE AND COALESCE(portal_access_token, '') = '';  -- يجب أن يكون صفرًا

-- ٤) الدوال العامة موجودة، وتسعٌ منها ممنوحة لـ anon (لا أقلّ ولا أكثر).
SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_may_call
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'public\_%'
ORDER BY 1;
```

**ثم التحقّق من التطبيق نفسه** (هذا هو الفحص الذي يهمّ الصالون فعلًا):

1. تسجيل دخول الموظفة على `https://larabeauty.vercel.app/#/login` (المشروع المؤقت عبر متغيرات Vercel).
2. فتح `#/book` كزائر والتأكد من ظهور الخدمات والأخصائيات.
3. حجز موعد تجريبي، ثم فتح `#/portal` برقم الهاتف ورمز البوابة.
4. فاتورة تجريبية: إنشاؤها ثم طباعتها.
5. لوحة المبالغ: التأكد من ظهور الإيراد والعمولات.
6. فتح إعدادات الصالون: الاسم والشعار المرفوعان كما كانا.

سجّل النتيجة في سجلّ النسخ أدناه (تاريخ أول استعادة ناجحة). إن فشل أي بند، فالنسخة ناقصة — أعد بناءها.

---

## ٧. الأرقام المستهدفة (أهداف، لا واقع مقاس)

| المؤشر | الهدف | الوضع اليوم |
| --- | --- | --- |
| RPO (أقصى ما يمكن فقدانه) | ٢٤ ساعة | **غير مُفعّل** — لا نسخة آلية |
| RTO (زمن العودة) | ≤ ٤ ساعات | غير مقاس — يحتاج تمرينًا واحدًا |
| الاحتفاظ | ٣٠ يومًا خارجيًا | غير مُفعّل |

بعد أول تمرين استعادة، استبدل كلمة «غير مقاس» بالرقم الحقيقي. الأرقام غير المقاسة لا يُبنى عليها قرار.

---

## ٨. سجلّ النسخ

| التاريخ | الملف/المكان | الحجم | مشفّرة؟ | تمّ التحقق من الاستعادة؟ |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

---

## ٩. ما يجب عمله الآن — بالترتيب

1. **إن كان المشروع على Free:** إمّا ترقية إلى Pro (ويشمل نسخًا يومية ٧ أيام)، أو اعتماد البند ٣ يدويًا من اليوم الأول.
2. تشغيل البند ٣ مرّة واحدة يدويًا، والتأكد أن الملفات الثلاثة موجودة وبأحجام منطقية (لا ملفات صفرية).
3. نسخة `center-assets` (البند ٤).
4. **نسخة الآن — قبل تطبيق ملفَّي الترحيل غير المطبَّقين.**
5. تمرين استعادة على مشروع مؤقت، وتسجيل الأرقام الحقيقية في البندين ٧ و٨.

## ١٠. مسؤوليات صريحة

- **من يشغّل النسخة:** يتولّى التنفيذ اليومي/الأسبوعي حسب الخطة.
- **من يحمل المفاتيح:** مفتاح فكّ التشفير ومفتاح S3 في مدير كلمات مرور؛ لا نسخة منهما في المستودع.
- **من يستعيد:** أي شخص من الاثنين يجب أن يستطيع تنفيذ البند ٦ دون سؤال أحد — هذا هو معنى دليل مكتوب.
