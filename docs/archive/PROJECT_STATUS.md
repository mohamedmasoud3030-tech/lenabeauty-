# PROJECT_STATUS — LenaBeauty

> **Historical discovery snapshot.** هذا الملف يصف حالة البداية قبل stabilization. الحالة الحالية ودرجات `IMPLEMENTED / LOCAL PASS / HOSTED BLOCKED / OPEN` موجودة في `PROJECT_DEFECTS.md`; لا تستخدم قوائم العيوب القديمة أدناه كحالة إغلاق حالية.

**Discovery baseline:** 2026-08-17
**Branch:** `arena/01a00f9e-lenabeauty`
**Starting commit:** `2d96110`
**Starting Git state:** clean.
**Discovery changes:** الوثائق المطلوبة + regeneration متوقع لـ`docs/database-contract/artifacts/frontend-usage.json` من audit tool (file count 196 → 198 بعد إضافة test files الحالية).

## 1. ملخص الحالة

- **Repository buildable:** نعم.
- **TypeScript:** يمر.
- **Production Web build:** يمر.
- **Canonical DB replay:** يمر محليًا، deterministic وidempotent.
- **Unit/component/static contract suite:** تمر عند تشغيلها منفردة بالطريقة المعتادة: 90 files / 476 tests.
- **Hosted Supabase correctness:** غير مثبت من هذه البيئة.
- **Live business journey acceptance:** غير منفذ لعدم وجود account credentials وserver-only preflight inputs.
- **Production readiness:** لا يمكن اعتمادها بعد؛ توجد حدود صلاحيات وbackup/account-management تحتاج إغلاقًا.
- **Desktop product:** غير مكتمل.

## 2. أوامر baseline والنتائج الفعلية

| الأمر | النتيجة |
|---|---|
| `git status --short --branch` | clean عند البداية |
| `node --version` | `v22.22.3` |
| `npm --version` | `10.9.8` |
| `npm ci` | نجح، 516 packages |
| `npm audit --audit-level=moderate` | 0 vulnerabilities؛ ظهر deprecation warning لـtransitive `glob@11.1.0` |
| `npm run typecheck` | نجح |
| `npm run lint` | نجح، لكنه مجرد `tsc --noEmit` وليس linter مستقلًا |
| `npm run build` | نجح؛ 54 PWA precache entries ≈ 1910.10 KiB |
| `npm test -- --reporter=dot` منفردًا | 90 files / 476 tests passed |
| `npm run ci:migrations` | نجح؛ 31 canonical migrations |
| `npm run ci:rpc-check` | نجح؛ 20 frontend RPC references كلها معرفة في migrations |
| `npm run db:types:check` | نجح |
| `npm run audit:gate` أول مرة | فشل: generated `frontend-usage.json` stale (196 بدل 198 source files) |
| `npm run audit:gate` بعد regeneration | نجح |
| `npm run desktop:test` | 6 files / 12 tests passed |
| `npm run desktop:tauri:check` | لم يبدأ: `cargo: not found` |
| `npm run preflight:supabase` | فشل كما هو متوقع: runtime env وremote credentials غير موجودة |
| Dev server | بدأ على `0.0.0.0:5173` |
| Production preview | بدأ على `0.0.0.0:4173`; index/manifest/SW served 200 |
| Public URL read-only smoke | Login العربية ظهرت؛ لم يتم الدخول |

### ملاحظة اختبار الضغط

عند تشغيل full test suite بالتوازي مع build/type/desktop checks، فشل test واحد في `reports-page-states` بسبب timeout وبقيت الشاشة Loading. بعد ذلك:

- نفس الملف نجح 3/3 عند تشغيله منفردًا.
- full suite نجحت 476/476 عند تشغيلها منفردة.

الاستنتاج المعقول: test حساس لتوقيت/موارد jsdom وليس فشلًا وظيفيًا مثبتًا. تحذيرات `act(...)` في نفس الملف تؤكد ضعف synchronization في الاختبار ويجب إصلاحها.

## 3. ما هو متحقق كعامل داخل repository

### Build/contracts

- Vite production compilation كاملة.
- Lazy page chunks تعمل في build graph.
- PWA artifacts generated.
- `HashRouter` app shell ومسارات auth/admin موجودة.
- i18n dictionaries وcore translation tests موجودة.
- TypeScript strict app source يمر.
- npm dependency audit لا يبلغ عن vulnerability حاليًا.

### Database contract

- 31 migration files مكتشفة.
- manual admin bootstrap واحد excluded من automated replay بوضوح.
- 30 migrations replayed، 0 failures، 0 idempotency failures.
- 34 tables وكلها RLS enabled في replay.
- generated `database.types.ts` مطابق للinventory.
- frontend RPC names كلها موجودة في chain.
- public booking/portal RPCs موجودة لكنها بدون client grants في canonical contract.
- checkout idempotency، financial ledger، appointment overlap/state integrity لها tests وDDL متحقق محليًا.

### Frontend tests

تغطية موجودة لـ:

- auth/session initialization/guards.
- customers/services/inventory/employees forms.
- appointments status/mobile behavior.
- POS calculation and checkout UI flow بمocks.
- receipts/print sanitization.
- settings/branding/VAT/i18n.
- accessibility primitives.
- migration SQL and adapter mappings.
- Tauri source/bridge contracts.

هذه ليست hosted E2E proof.

## 4. حالات مؤكدة غير مكتملة أو معطلة

## 4.1 Critical/High

### S-01 — Settings “User Management” لا يدير users

**متحقق من الكود.**

- `SettingsPage.submitUser()` يستدعي `useCases.employees.create/update/delete`.
- Employee adapter يكتب `employees`, ولا ينشئ Supabase Auth account.
- create form يرسل `username/password` لكنه لا يرسل `name` المطلوب؛ Employee adapter سيرفضه بـvalidation.
- password وusername غير موجودين كحقول تشغيلية في employees table payload.

**الأثر:** زر “Create User Account” لا ينشئ حساب دخول، ورحلة account administration مضللة ومعطلة.

### S-02 — Admin route boundaries ليست كلها server-enforced

**الاختلاف مؤكد؛ exploitability في hosted environment غير متحقق بسبب غياب remote inspection.**

- `/employees`, `/expenses`, `/settings`, `/accounting`, `/advanced-automation`, customer experience وغيرها خلف `RequireAdmin`.
- canonical RLS لعدة جداول يستخدم center membership فقط، وليس `has_center_role(ADMIN)`.
- RPCs مثل accounting/settings/advanced مُنحت لـ`authenticated` وتتحقق من membership فقط.
- `can()` التفصيلي غير مستخدم في UI.
- payroll/attendance/advances هي الاستثناء الجيد: ADMIN enforced في DB.

**الخطر:** مستخدم STAFF قد يتجاوز الواجهة ويستدعي Data API/RPC مباشرة إذا كانت relation grants في hosted Supabase تسمح بذلك. يجب مقارنة remote grants ثم توحيد authorization matrix قبل production.

### S-03 — Backup/export/restore ليس backup كاملًا

**متحقق من code path.**

- DB فيها 34 tables؛ export يغطي 12 datasets فقط.
- لا يصدر invoice items, payments, gift cards, packages, entitlements/ledger, categories, reviews/files, notification/payment settings وغيرها.
- attendance/advances/payroll query errors لا تدخل قائمة responses المفحوصة، وقد تتحول إلى arrays فارغة بصمت.
- restore لا يعيد appointments رغم وجودها في payload، ولا يعيد invoices/financial data عمدًا.
- UI يسمي أول زر “Database Backup / SQL Format”، لكن `backup()` يعيد JSON string ويعرضها داخل Toast ولا ينزل SQL/file.
- Auto-Backup switch/interval لا يشغّل scheduler.
- restore warning يقول إنه سيحذف كل البيانات، لكن التنفيذ upsert ولا يحذف الموجود.

**الأثر:** لا يجوز اعتبار هذه الواجهة disaster-recovery backup أو round-trip كامل.

### S-04 — Hosted database state غير مثبت

- local preflight فشل لغياب env/credentials.
- آخر GitHub workflow المقروء نجح في static job لكن live migration job كان `skipped` لعدم اكتمال secret inputs.
- latest public deployment metadata المقروء قديم مقارنة بالـcheckout الحالي.

**الأثر:** لا نعرف هل hosted Demo يطابق 31 migrations أو أحدث commit.

### S-05 — Hard-delete lifecycle قد يمسح تاريخًا تشغيليًا

**متحقق من adapters/FKs.**

- Customers/employees/services/products/expenses تستخدم direct `.delete()`.
- لا `deleted_at`/archive model.
- employee deletion cascades attendance/advances/payroll lines.
- customer deletion cascades appointments/invoices، مع RESTRICT من بعض financial children؛ النتيجة قد تكون رفضًا أو حذف تاريخ غير محمي بحسب العلاقات الموجودة.

**الأثر:** سياسة retention/audit غير واضحة، وواجهة CRUD قد تعرض destructive action على records مرتبطة.

## 4.2 Medium

### S-06 — Notifications تعرض نجاحًا أقوى من الواقع

- WhatsApp يفتح `wa.me` manual tabs فقط.
- يسجل الرسالة `sent` و`delivered` فور فتح الرابط، بلا delivery receipt.
- stats في memory وتضيع عند reload.
- SMS branch لا يرسل شيئًا، ثم يعرض success “queued”.
- `Appointments.sendReminder` stub يرجع `{ok:true}` دائمًا؛ الصفحة تسمي النتيجة Simulated.

### S-07 — Payment Gateway إعدادات فقط

- provider metadata/deposit rules تُحفظ في Supabase.
- لا payment session creation, SDK, secret handling server, webhook، أو reconciliation.
- “Live” flag لا يجعل الدفع حيًا.

### S-08 — PWA shortcuts لا تطابق `HashRouter`

- runtime router يحتاج `/#/dashboard`.
- manifest الفعلي يخرج `/dashboard` و`/pos`.
- PWA start/shortcut قد يفتح root route ثم Login بدل المقصد.
- لا install/update UI؛ update يأخذ `skipWaiting/clientsClaim` تلقائيًا.

### S-09 — Tauri/SQLite/offline claims أكبر من التنفيذ

- Rust shell موجود.
- “DB” هو JSON file باسم `.sqlite.json`.
- Tauri repository adapters TODO وفارغة.
- runtime repository factory يرفض backend غير Supabase.
- cargo check غير متاح هنا.

### S-10 — Public feature code ميت عمدًا لكنه يرفع maintenance surface

- `LandingPage`, `BookingPage`, `ClientPortalPage` غير موصولة.
- public RPCs disabled عمدًا.
- tests/docs قديمة لا تزال تصف public booking كميزة منجزة.

ليست route bug في release الحالي؛ هي contradiction/dead code يجب تجميدها أو عزلها بوضوح.

### S-11 — Tests تمر مع warnings

- `reports-page-states`: React updates خارج `act(...)`.
- `branding-persistence`: controlled input يتحول إلى uncontrolled.
- expected initialization test يكتب error log متعمدًا.
- تحت ضغط متوازي ظهر timeout واحد غير قابل لإعادة الإنتاج منفردًا.

### S-12 — “lint” ليس lint

`npm run lint` يكرر `tsc --noEmit`. لا ESLint/Biome rule engine، رغم وجود comment `eslint-disable` في source. الأخطاء الأسلوبية/React hooks لا تغطيها gate الحالية.

### S-13 — Dual lockfiles

- official path يستخدم npm/package-lock.
- `pnpm-lock.yaml` يحتوي resolutions مختلفة.
- لا `packageManager` field يعلن policy.

### S-14 — Local Supabase grants غير self-contained بوضوح

- `supabase/config.toml` يوضح أن new local entities ليست auto-exposed افتراضيًا.
- migrations تمنح authenticated صراحة لبعض الجداول فقط وتعتمد جزئيًا على hosted Supabase default privileges للجداول الأساسية.
- PGlite inventory لا يظهر authenticated grants الأساسية.

**الحالة:** diagnostic open. لا يمكن الجزم بكسر hosted Demo، لكن clean local Supabase bootstrap يحتاج اختبار PostgREST فعلي وليس PGlite وحده.

## 4.3 Low/maintenance

### S-15 — وثائق متناقضة أو قديمة

أمثلة مؤكدة:

- `README.md` يقول attendance/advances/payroll Demo-only وغير Supabase-backed؛ الكود والمigrations الحالية تدعمها.
- `CURRENT_VERSION_CLOSURE.md` يذكر 18 migrations و245 tests؛ الفعلي 31 و476.
- `ROADMAP_STATUS.md` يقول public booking منجز route `/book`؛ route غير موجود وصلاحيات RPC مسحوبة.
- `ADR-008` يوصي بbootstrap SQL مؤرشف بدل canonical migrations.
- `NEXT_VERSION_PLAN.md` يطلب ميزات مطبقة بالفعل ويشير إلى ملفات مؤرشفة/مسارات قديمة.
- comments في audit scripts ما زالت تذكر 28 migrations/two idempotency gaps، بينما output الفعلي 30 automated و0 gaps.

### S-16 — Dead/duplicated code

- `src/types.ts` غير مستورد ويحتوي Rentrix types غير مرتبطة بالصالون.
- shared components/hooks غير مستخدمة: `DesktopOperationsCard`, `EmptyState`, `LoyaltyTierBadge`, `MobileBottomNav`, `useMobileOptimization` بحسب import scan الحالي.
- `Card.tsx` legacy component لا يظهر له import؛ `PremiumCard.tsx` نظام آخر منفصل.
- `infrastructure/tauri` alternative adapter factory غير مستخدم في production composition.

### S-17 — Monitoring محدود

ErrorBoundary report IDs وconsole logs فقط؛ لا remote error ingestion أو uptime/backup alerts.

## 5. أجزاء لم يتم التحقق منها بصدق

- login حقيقي لأي ADMIN/STAFF/MANAGER.
- hosted RLS/grants ومطابقتها للcanonical schema.
- cross-center isolation بمستخدمين حقيقيين.
- CRUD persistence بعد reload.
- checkout مالي حقيقي ضد hosted DB.
- backup/restore على بيانات حقيقية (ويجب عدم تجربته دون بيئة disposable وموافقة).
- storage upload/download permissions live.
- multi-branch live selection.
- offline behavior بعد service worker install في browser.
- iOS/Android install, update, orientation, keyboard.
- screen readers و200/400% zoom.
- 80mm printer/A4 hardware.
- Tauri compile/package/sign/update.
- hosted Auth leaked-password protection.
- Vercel environment values أو تطابق public deployment مع current branch.

## 6. تناقضات تحتاج قرار owner/product، لا تخمين تقني

1. هل `STAFF` مسموح له تعديل services/products/customers، أم view-only؟ الكود/RLS الحالي أوسع من `can()`/بعض docs.
2. هل Employees/Expenses/Center Settings/Accounting يجب أن تكون ADMIN-only على الخادم؟ routes تقول نعم، RLS/RPCs ليست كلها كذلك.
3. هل حذف customer/employee مقبول hard delete، أم يجب archive/anonymize؟
4. هل Data & Backup مطلوب كexport جزئي أم disaster recovery كامل؟ النص الحالي يوحي بالثاني والتنفيذ الأول.
5. هل public booking/portal مؤجلان نهائيًا لهذا الإصدار أم سيعاد تفعيلهما لاحقًا؟
6. هل Tauri مجرد prototype أم منتج تسليم؟

## 7. أعلى المخاطر الآن

1. **Authorization mismatch** بين UI وDB لبعض admin functions.
2. **False confidence in backup/user-management UI**.
3. **Hosted state unknown** لأن live workflow skipped وpreflight غير متاح.
4. **Documentation drift** يمكن أن يقود operator لتطبيق setup خاطئ.
5. **Hard-delete data lifecycle** غير معرف.

## 8. الحكم الحالي

**Repository contracts قوية نسبيًا، لكن المنتج لا يستحق وصف “production verified”.**
الـbuild والـlocal deterministic DB audit جيدان. قبل إصلاحات UI عامة، يجب إغلاق authorization/account/backup boundaries والتحقق من hosted Demo بطريقة read-only أولًا.
