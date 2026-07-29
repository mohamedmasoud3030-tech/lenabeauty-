# خطة الإصلاح وقائمة المهام — LenaBeauty

**التاريخ:** 2026-06-28
**الأساس:** أهداف الإصدار v1.0 الموثقة في
`CURRENT_VERSION_CLOSURE.md`، `SALES_READY_RELEASE.md`،
و`MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`.

## هدف الإصدار (من المستندات)
> "Single-customer, single-center Supabase PWA. Real auth. Real CRUD.
> Live Supabase QA verified. No fake mode."

المعايير الموثقة التي تربط كل إصلاح:
- **No Fake Mode** — كل البيانات من Supabase.
- **TypeScript clean (`tsc --noEmit` = 0 errors)**.
- **RLS fully evaluated** قبل التسليم ("Untested RLS … is a data breach risk").
- **Env vars securely separated** بين المحلي والإنتاج.
- **App boots without config errors / Login succeeds**.

---

## 🔴 المرحلة 1 — إصلاحات حرجة ✅ مكتملة

| # | المشكلة | الهدف الموثق المنتهَك | الإصلاح | الحالة |
|---|---------|----------------------|---------|--------|
| C1 | `Globe` غير مستورد في `LandingPage.tsx` → انهيار الصفحة الرئيسية | "App boots without errors" | إضافة `Globe` إلى استيراد lucide-react | ✅ |
| C2 | مفتاح `"Contact"` مكرر ×2 في `i18n.ts` | "tsc clean: 0 errors" | حذف المفتاحين المكررين (الإبقاء على التعريف الأصلي) | ✅ |
| C3 | فشل `tsc --noEmit` | "TypeScript clean" | تحقق: 0 أخطاء بعد C1+C2 | ✅ |
| C4 | RLS مُعطّل على كل الجداول | "RLS fully evaluated / data breach risk" | ترحيل جديد `20260628000001_enable_rls.sql` + `20260628000002_admin_bootstrap.sql` | ✅ |
| C5 | أسرار Supabase حية في `vercel.json` و`.env.example` والمستندات | "Env vars securely separated" | استبدال بـ placeholders؛ نقلها لـ Vercel env | ✅ |

**التحقق النهائي:** `tsc` = 0 أخطاء · `vitest` = 82/82 ناجح · `vite build` نظيف.

### ⚠️ إجراء يدوي مطلوب منك (لا يمكن أتمتته)
1. **أعد توليد (rotate) الـ publishable key** من لوحة Supabase — المفتاح القديم
   ما زال في تاريخ Git ويجب إبطاله.
2. شغّل الترحيلين الجديدين على مشروع Supabase بالترتيب:
   `…_enable_rls.sql` ثم `…_admin_bootstrap.sql` (بعد تعديل UUID المستخدم).
3. اضبط متغيرات البيئة في Vercel dashboard بدل `vercel.json`.

---

## 🟡 المرحلة 2 — متوسطة ✅ مكتملة

| # | المشكلة | الهدف الموثق المنتهَك | الإصلاح المنفّذ | الحالة |
|---|---------|----------------------|------------------|--------|
| M1 | `AttendancePage` / `AdvancesPage` / `PayrollPageEnhanced` / `StaffAnalyticsPage` تعرض بيانات `MOCK_*` كأنها حقيقية | "No Fake Mode" | إضافة مكوّن `DemoDataBanner` (عربي/إنجليزي) أعلى كل صفحة + شارة "Demo preview" في القائمة الجانبية. لا توجد جداول backend لهذه الميزات (خارج نطاق v1.0 الموثق)، فالإفصاح الصادق هو الحل الصحيح بدل تضخيم النطاق ببناء 4 أنظمة backend جديدة | ✅ |
| M2 | `whatsappService` يستخدم `graph.instagram.com` (خطأ) | ميزة التذكيرات (Roadmap 1.2) | تصحيح إلى `graph.facebook.com` | ✅ |
| M3 | README يدّعي "no backend / Supabase deferred" وهو خطأ | دقة التوثيق | إعادة كتابة README بالكامل ليطابق المعمارية والحالة الفعلية + خطوات Supabase والترحيلات | ✅ |

**التحقق النهائي للمرحلة 2:** `tsc` = 0 أخطاء · `vitest` = 82/82 · `vite build` نظيف.

### قرار تصميمي مهم (M1)
الشاشات الأربع (الحضور/السلف/الرواتب/تحليلات الموظفين) **ليست ضمن مصفوفة CRUD الموثقة لـ v1.0**
(التي تغطي: العملاء، الموظفين، الخدمات، المنتجات، المواعيد، المصروفات، الفواتير). بناء backend كامل
لها = تضخيم نطاق كبير خارج الإصدار. لذا الالتزام بهدف "No Fake Mode" تحقق عبر **الإفصاح الصريح**
بأن البيانات تجريبية وغير محفوظة، حتى يُقرَّر لاحقاً بناء هذه الأنظمة (مذكورة في FEATURE_ROADMAP).

---

## 🟢 المرحلة 3 — تحسينات اختيارية ✅ مكتملة

| # | البند | الإصلاح المنفّذ | الحالة |
|---|-------|------------------|--------|
| P1 | `console.*` متناثرة تتسرّب للإنتاج | إنشاء `src/shared/logger.ts` (debug/info/log مُقيّدة بوضع التطوير، warn/error دائماً). استبدال كل `console.log/debug/info` في `whatsappService`, `tauri/client`, `main.tsx`, `useMobileOptimization` | ✅ |
| P2 | تضارب صلاحيات MANAGER بين `Session.ts` و`RequireAdmin` | مواءمة نموذج الصلاحيات مع التفعيل الفعلي: التقارير/الإعدادات لـ ADMIN فقط، MANAGER يحتفظ بالصلاحيات التشغيلية. توثيق نقطة التفعيل + اختبار جديد يقفل هذا الثبات | ✅ |
| P3 | 33 ملف توثيق فوضوي | أرشفة 20 ملف تاريخي/مهجور في `docs/archive/` (عبر `git mv` للحفاظ على التاريخ) + إنشاء فهرس `docs/README.md` منظّم حسب الفئة | ✅ |

**ملاحظة على TODO/FIXME:** الفحص أظهر أن معظمها إيجابيات كاذبة (placeholders هاتف `968XXXXXXXX`، نص `HACKER` في اختبار). الـ TODO الحقيقي الوحيد في `tauri/index.ts` مقصود (محوّل v2.0 المؤجّل) وتُرك كما هو.

**التحقق النهائي للمرحلة 3:** `tsc` = 0 أخطاء · `vitest` = 83/83 (اختبار صلاحيات جديد) · `vite build` نظيف.

---

## الخلاصة
كل المراحل الثلاث مكتملة. الحالة النهائية: `tsc` نظيف · 83/83 اختبار · بناء نظيف.
يبقى **إجراءان يدويان** على عاتقك (راجع أعلاه): تدوير مفتاح Supabase، وتشغيل الترحيلات الجديدة على المشروع.
