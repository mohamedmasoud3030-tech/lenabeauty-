# FULL_PROJECT_AUDIT — LenaBeauty

> **Historical pre-repair audit.** هذا التقرير يحفظ baseline evidence عند `2d96110`. راجع `PROJECT_DEFECTS.md` للحالة الحالية ونتائج التحقق بعد الإصلاح؛ بقاء finding هنا لا يعني أنه ما زال مفتوحًا.

**تاريخ التدقيق:** 2026-08-17
**النطاق:** المستودع كاملًا كما هو موجود على `arena/01a00f9e-lenabeauty` عند `HEAD 2d96110`.
**طريقة العمل:** قراءة مستقلة للكود، routes، migrations، generated schema inventory، configuration، tests، CI، runtime build، والوثائق الرسمية الحالية. لم تُعامل تقارير agents السابقة كمصدر حقيقة.

---

## 1. Executive summary

LenaBeauty تطبيق Web/PWA عربي أولًا لإدارة مركز تجميل. المنتج الحالي staff-only ويشمل appointments، customers، catalog، inventory، POS، invoices، gift cards/packages، reports، settings، attendance، advances، payroll وبعض الوحدات الإدارية. React يتصل مباشرة بـSupabase Auth/PostgREST/Postgres RPC/Storage؛ لا يوجد backend server خاص بالمشروع.

### Release verdict

## **NO-GO لاستخدام Production ببيانات عملاء أو رواتب أو أموال حقيقية.**

السبب ليس فشل البناء. البناء والاختبارات المحلية يمران، لكن التدقيق أثبت release blockers في:

1. صلاحيات مالية وإدارية غير متطابقة بين UI وDatabase؛ بعض RPCs الحساسة متاحة لكل `authenticated` center member.
2. Revenue/P&L classification غير صحيح: VAT وprepaid sales يدخلان في revenue، والـcommission configured لكنه لا يُحسب.
3. Payroll create/delete عمليات متعددة غير transactional ويمكن أن تترك run أو advances في حالة جزئية.
4. User Management لا يدير Auth users، وBackup/Restore ليس backup كاملًا ولا atomic.
5. hosted Supabase state غير مثبت؛ أحدث live Demo job كان `skipped`، والاتصال read-only من بيئة التدقيق فشل قبل TLS.

### الاستخدام المقبول حاليًا

- **Local/static engineering validation:** مقبول.
- **Demo ببيانات خيالية وADMIN واحد:** ممكن بشرط إعلان القيود وعدم اعتبار payroll، backup، notifications، payment gateway أو public booking جاهزة تجاريًا.
- **Pilot/Production ببيانات حقيقية:** غير مقبول قبل إغلاق Critical/High findings والتحقق live على Staging.

لم أجد privileged secret مؤكدًا داخل tracked source. Demo Supabase publishable browser configuration موجودة عمدًا؛ هذا ليس service-role secret. لا توجد نتيجة تسمح باعتبار المشروع “آمنًا” فقط لأن secrets scan وbuild يمران.

---

## 2. تصنيف التقرير

- **Confirmed defect:** السلوك أو الفجوة مثبتة مباشرة من executable code/migration أو command.
- **Probable risk:** المسار موجود، لكن أثره الكامل يحتاج hosted state أو حجم بيانات حقيقي.
- **Recommendation:** تحسين وقائي، وليس failure قائمًا بذاته.
- **Unknown:** لم يمكن التحقق منه دون credentials، remote access، browser/device أو قرار owner.

Severity:

- **Critical:** unauthorized data/money mutation، data loss، money error أو likely production outage.
- **High:** core journey broken، major permission/reliability/operations gap.
- **Medium:** material edge case، accessibility، performance أو maintainability issue.
- **Low:** limited-impact improvement.

---

## 3. Project-wide risk map

| المجال | مستوى الخطر | الحكم المختصر |
|---|---:|---|
| Product completeness | High | Staff core موجود، لكن account lifecycle وpublic flows وnotifications/payments/backup غير مكتملة |
| Financial correctness | Critical | Revenue/P&L وcommission/payroll ليست آمنة لاتخاذ قرار مالي |
| Authorization/security | Critical | Database لا يفرض ADMIN boundary لكل admin/money RPCs؛ STAFF financial visibility أوسع من policy المعلنة |
| Data lifecycle | High | hard delete وrestore جزئي وغير transactional؛ retention غير معرّف |
| Database integrity | Medium/High | checkout قوي؛ payroll/attendance وبعض role boundaries أضعف |
| Testing/CI | High | 476 test تمر، لكن لا E2E، وCI لا يعمل لمعظم frontend-only pushes |
| UX/accessibility | Medium | foundations جيدة، لكن local dialogs/hidden actions/i18n deferred pages غير متسقة |
| Performance | Medium | code splitting موجود، لكن queries بلا pagination وPWA precaches كل lazy chunks |
| PWA | Medium | install assets موجودة؛ manifest routes خاطئة ولا offline data/update UX |
| Operations | High | لا Production data project مثبت، live migration skipped، ولا monitoring/DR proof |
| Code health | Medium | monolithic adapters/pages، `any` كثير، dead modules، و`lint` ليس linter |

---

## 4. Product and route inventory audited

### Anonymous

| Route | الحالة المتحققة |
|---|---|
| `/` | redirect إلى `/login` |
| `/login` | route الوحيد القابل للاستخدام دون session |
| `/book` | لا route؛ `BookingPage.tsx` غير موصول |
| `/portal` | لا route؛ `ClientPortalPage.tsx` غير موصول |
| Landing | `LandingPage.tsx` غير موصول |
| Unknown route | redirect إلى Login؛ لا 404 screen |

### Authenticated operational — `ADMIN/MANAGER/STAFF`

`/dashboard`, `/pos`, `/services`, `/appointments`, `/customers`, `/gift-cards`, `/packages`, `/inventory`.

### `ADMIN` route guard

`/employees`, `/reports`, `/settings`, `/expenses`, `/customer-experience`, `/forecasting`, `/payroll`, `/attendance`, `/advances`, `/staff-analytics`, `/accounting`, `/advanced-automation`.

Legacy redirects: `/branding`, `/notifications`, `/payment-gateway` إلى Settings tabs.

### Navigation gaps

- `/payroll`, `/attendance`, `/advances`, `/staff-analytics` لا تظهر في Sidebar أو mobile More أو Global Search؛ الوصول الطبيعي لها غير موجود، رغم أن routes فعالة.
- Deferred admin modules الأخرى مخفية من Sidebar لكنها تظهر في Global Search.
- `MANAGER` يملك نفس routes التشغيلية لـ`STAFF`، خلافًا لـ`docs/architecture/authorization-matrix.md` التي تعده قادرًا على reports.
- `can()` في `src/domain/entities/Session.ts` غير مستعمل في runtime UI، لذلك لا يطبق action-level permissions.

---

## 5. Findings table

## 5.1 Critical

| ID | النوع | finding | الدليل الملموس | أثر المستخدم/العمل | المناطق | أصغر remediation آمن |
|---|---|---|---|---|---|---|
| CR-01 | Confirmed defect | Financial/admin RPC authorization أوسع من UI | `src/routes.tsx:48-68` يجعل Accounting/Settings/Advanced admin-only. لكن `supabase/migrations/20260810000006_security_grant_repair.sql:36-74` يمنح settings/accounting/AI/customer-experience RPCs إلى كل `authenticated`. `refund_entitlement_v1`, `void_entitlement_v1`, `expire_entitlement_v1` ممنوحة لكل authenticated في `20260811004000_financial_entitlements.sql:1401-1411` وتتحقق من membership فقط في lines 1226, 1295, 1350. actor يمكن أن يكون أي active employee من المركز. | STAFF center member يستطيع نظريًا bypass UI وتعديل entitlement liability/refund status أو إنشاء journal entry/settings باسم موظف آخر. هذا unauthorized money/data mutation حسب canonical schema. هل migrations نفسها live مجهول. | Auth, RLS, RPC, entitlements, accounting, settings | أولًا أضف role-contract tests. بعد موافقة owner، migration صغيرة تستعمل `has_center_role(..., ['ADMIN'])` داخل RPCs الحساسة وتسحب EXECUTE غير المطلوب. اختبر على disposable Staging قبل أي remote apply. |
| CR-02 | Confirmed defect | STAFF يمكنه الوصول إلى financial/salary summaries في design الحالي | `/dashboard` داخل `RequireAuth` العام في `src/routes.tsx:37-46`. `SupabaseDashboardAdapter.getSummary()` يقرأ invoices في `repositories.ts:1684-1713`; `getPnlMonth()` يقرأ invoices, expenses وemployee salary في `1729-1755`. `canViewRevenue` يصبح true عند نجاح query، وليس حسب role. RLS الأساسية لـinvoices/expenses/employees membership-scoped في generated `schema-inventory.json`. `docs/architecture/authorization-matrix.md` يقول STAFF لا يرى Dashboard summaries أو financial reports/expenses. | كشف revenue, expenses, salaries وprofit لمستخدم لا يفترض أن يراها؛ privacy وauthorization breach. | Dashboard, employees, expenses, invoices, RLS | لا تعتمد على client hiding. أنشئ DB RPC/view role-aware للملخص، وأعد no-financial summary لغير المسموح. أوقف queries المالية من STAFF UI كدفاع ثانٍ. |
| CR-03 | Confirmed defect | Revenue وP&L math تصنف VAT وprepaid sales كإيراد | `repositories.ts:1742-1754` يجمع `invoices.total_amount` كله كـrevenue/profit. هذا يشمل VAT وgift-card/package cash. `salesReportMapper.ts:109-125` يحسب `earnedRevenue = totalAmount - prepaidAmount + redeemedAmount` ولا يطرح `invoice.tax`. العقد الرسمي `docs/OPERATIONAL_DATA_CONTRACT.md:64-70` يحدد earned revenue = `total - tax + redemptions` مع فصل prepaid liability. Reports KPI/chart يسمي `totalAmount` Revenue في `ReportsPage.tsx:138-220, 283-339`. | profit وearned revenue أعلى من الواقع، وقد تُبنى عليها قرارات ضريبة وربح خاطئة. | Dashboard, Reports, accounting, invoices | اجعل query/mapper واحدًا canonical: cash، VAT liability، prepaid liability، earned revenue. أضف tests بأمثلة VAT + gift card + package + redemption قبل تعديل UI. |
| CR-04 | Confirmed defect | Payroll قد يعطي أجرًا خاطئًا ويترك partial state | `commission_percentage` قابل للإعداد، لكن البحث الكامل لا يجد أي calculation/update لـ`month_commission_total` سوى القراءة؛ `domain/payroll.ts:7-25` يحسب base minus advances فقط. `Payroll.createRun()` في `repositories.ts:3119-3205` ينشئ run ثم lines ثم يحدّث advances عبر REST calls منفصلة؛ خطأ update الأخير متجاهل. `deleteRun()` في `3211-3230` يعيد advances ثم يحذف run في خطوتين، وخطأ الخطوة الأولى متجاهل. | commission قد لا يُدفع أو لا يُخصم في P&L. Network/RLS failure قد يترك run بلا lines أو advances محسوبة بحالة خاطئة. هذا money error وpartial failure. | Payroll, advances, employees, P&L | لا تصلحها في client. بعد تحديد commission rule مع owner، أنشئ ADMIN-only transactional/idempotent payroll RPC يعيد أو يrollback run+lines+advance status معًا؛ أضف reconciliation test. |

## 5.2 High

| ID | النوع | finding | الدليل الملموس | أثر المستخدم/العمل | المناطق | أصغر remediation آمن |
|---|---|---|---|---|---|---|
| H-01 | Confirmed defect | Settings “User Management” لا ينشئ أو يعدل Auth accounts | `SettingsPage.tsx:86-92, 175-225` يستعمل `useCases.employees`. create يرسل `{username,password,role,isActive}` بلا `name`; `SupabaseEmployeeAdapter.create()` في `repositories.ts:460-493` يرفض missing name ويكتب employee fields فقط. password/username لا يصلان للDB. delete لا يستعمل `unwrap` في line 218، فيتجاهل `Result.ok=false`. | Create User core journey يفشل ولا يمنح login. Admin قد يظن أنه غيّر password/role بينما Auth لم يتغير. | Settings, Auth, employees | غيّر تسمية القسم مؤقتًا إلى Employee Records أو اخفه. تصميم account provisioning server-side منفصل عن employee CRUD؛ لا ترسل passwords من browser إلى table adapter. |
| H-02 | Confirmed defect | Backup/Restore ليس backup كاملًا ولا atomic وتوصيف UI خاطئ | export في `repositories.ts:1329-1377` يغطي 12 datasets من 34 tables ويهمل errors لأربع payroll responses في `responses` line 1349. restore `1476-1671` يعمل sequential upserts بلا transaction، لا يعيد appointments أو invoices/financial ledgers. validation في `dto/index.ts:249-253` يفحص فقط version string وdata object. UI يقول SQL Backup/delete/overwrite/Auto-Backup في `SettingsPage.tsx:237-318, 791-917`; `backup()` يعيد JSON داخل toast فقط، والـswitch لا يشغل scheduler. | فقد أو تشويه بيانات عند الاعتماد عليه كـDR؛ partial restore ممكن. الوصف يخلق false confidence. | Settings, all data, operations | أولًا غيّر copy إلى “partial JSON export” وعطّل Restore/Auto-Backup حتى يوجد contract. لاحقًا server-side versioned export/restore transaction على disposable environment مع manifest/checksum وround-trip test. |
| H-03 | Confirmed defect | Hard delete قد يمسح history أو يفشل حسب نوع العلاقات | Customer/Employee/Product/Service adapters تستعمل direct `.delete()`؛ مثال `repositories.ts:399-413, 543-555`. Canonical FKs: customer→appointments/invoices `CASCADE`; payments/checkout-idempotency/entitlements إلى invoice/customer `RESTRICT`; employee→attendance/advances/payroll lines `CASCADE`; ledger actor `RESTRICT`. لا يوجد `deleted_at`/archive model. | حذف customer بلا financial blockers يمسح appointments/history؛ مع blockers يفشل. حذف employee قد يمحو payroll/attendance أو يفشل. النتيجة غير متوقعة ولا تحقق audit retention. | Customers, employees, appointments, payroll, invoices | امنع hard delete في UI عندما توجد references، وأضف read-only impact check. اطلب قرار owner بين deactivate/archive/anonymize قبل migration. |
| H-04 | Confirmed defect | “No-show fee charged” لا ينشئ payment أو invoice | `20260628000009_no_show_protection.sql:45-65` يحسب قيمة ويكتب `appointments.no_show_fee_charged` فقط. لا INSERT في payments/invoices. `deposit_amount` نفسه قيمة manual وليست payment ledger. | النظام قد يعرض مبلغًا “charged” لم يُحصّل ماليًا، فتختلف السجلات عن cash. | Appointments, finance, reports | غيّر copy إلى “fee recorded/retained manually” أو اربطه بـtransactional payment/refund workflow. لا تعتبر field cash collection. |
| H-05 | Confirmed defect | CI لا يحمي معظم frontend changes ولا يشغل SQL acceptance tests | workflow الوحيد `.github/workflows/demo-supabase-migrations.yml` يعمل فقط `push` إلى main مع paths محددة lines 3-18؛ لا يشمل `src/pages/**`, routes, shared UI ولا `pull_request`. `supabase/tests/**` يشغل workflow عند التغيير، لكن لا توجد step تنفذ هذه SQL files. لا Playwright/Cypress/E2E config. | تغيير UI أو core journey قد يدخل main دون build/tests. وجود 476 tests يعطي ثقة أكبر من gate الفعلية. | CI, QA, releases | workflow مستقل لكل PR وكل `src/**`: npm ci, audit, types, tests, build, diff. أضف job صريح لتشغيل SQL tests على disposable local Supabase/Postgres. |
| H-06 | Confirmed defect / operations risk | Production build يمكن أن يسقط بصمت على Demo/Staging data | `src/config/env.ts:46-84` يجعل `useDemoFallbacks = import.meta.env.PROD` بغض النظر عن `VITE_ENVIRONMENT`. إذا بني deployment مع `VITE_ENVIRONMENT=production` وقيم URL/key/center ناقصة، تؤخذ Demo fallbacks. docs تقول Production must not reuse Demo. build الحالي بلا env نجح متصلًا fallback Staging عمدًا. | Misconfigured production URL قد يقرأ/يكتب Demo بدل أن يفشل مغلقًا؛ environment/data mixing. لا Production Supabase project مثبت حاليًا. | Env, Vercel, Supabase | إذا `VITE_ENVIRONMENT=production` فامنع كل fallback وfail build/runtime عند غياب explicit vars. احتفظ fallback فقط بـexplicit staging trial flag. أضف production-mode test حقيقي. |
| H-07 | Confirmed defect | يوجد مصدران للدور بلا reconciliation | UI role يأتي من Auth `app_metadata.role` في `mappers.ts:317-341`. DB ADMIN policies تأتي من `center_memberships.role` في `20260816000001...sql:68-84`. `getMyCenters()` في `repositories.ts:225-242` لا يجلب role ولا يقارن القيمتين. لا trigger/sync lifecycle مستمر بعد bootstrap. | downgrade أو تعديل أحد المصدرين يمكن أن يترك UI وDB مختلفين؛ user يرى admin controls ثم تفشل، أو member-only admin RPCs تعمل رغم UI role. | Auth, memberships, session | اجعل center membership role هو authorization source لكل center، أو أضف provisioning transaction وsession reconciliation يرفض mismatch. لا تحاول sync من browser. |
| H-08 | Unknown — release blocker | Hosted Demo schema/security acceptance غير مثبتة | أحدث GitHub run `32028433292` بتاريخ 2026-08-17: Static success، لكن `Live Demo migration and security gates` = skipped. read-only `preflight:supabase` باستخدام tracked browser config مر بكل static checks ثم فشل قبل TLS بـ`ECONNRESET`; لا remote table result. | لا يمكن تأكيد أن 31 migrations/RLS/grants الحالية موجودة live. | Supabase, deployment, security | أصلح CI secret availability عبر owner، ثم شغّل migration diff/preflight وtwo-user RLS tests على Demo/Staging. لا تطبق Production. |

## 5.3 Medium

| ID | النوع | finding | الدليل الملموس | أثر المستخدم/العمل | المناطق | أصغر remediation آمن |
|---|---|---|---|---|---|---|
| M-01 | Confirmed defect | Notifications تعرض connected/sent/delivered بينما التنفيذ manual أو no-op | `whatsappService.ts:197-229` يفتح `wa.me` ثم يسجل sent وdelivered فورًا؛ logs memory only. `isConfigured()` يعيد true دائمًا. `NotificationsSettingsPage.tsx:80-99` لا ينفذ شيئًا في SMS branch ثم يعرض queued success. bulk يفتح tabs متسلسلة وقد يمنع browser popups. `useCases.appointments.sendReminder` يعيد success دائمًا في `useCases.ts:36`. | المستخدم يعتقد أن رسالة وصلت وهي ربما لم تُرسل. لا delivery audit حقيقي. | Notifications, appointments, privacy | غيّر status/copy إلى “link opened — manual send unverified”، عطّل SMS/reminder automation، ولا تسجل delivered دون provider receipt. |
| M-02 | Confirmed defect | PWA manifest لا يطابق `HashRouter` ولا توجد offline/update journey | `vite.config.ts:45,67,74` يستخدم `/dashboard` و`/pos`; router في `App.tsx`/`routes.tsx` hash-based. Production manifest أكد نفس القيم. SW precaches shell ويستخدم `skipWaiting/clientsClaim`, لكن لا install/update UI، IndexedDB outbox أو background sync. | shortcut/start لا يذهب للمسار المقصود، وoffline يظهر shell فقط ثم data failures؛ immediate update قد يخلط open client مع chunks جديدة. | PWA, routing, mobile | صحح URLs إلى `/#/...` أو انتقل Router بعد قرار. أضف offline boundary واضح وupdate notification أو documented controlled reload. |
| M-03 | Confirmed defect | بعض core loading failures تظهر كempty أو spinner دائم | POS `loadData()` في `PosInvoicesPage.tsx:121-147` بلا catch/error state؛ initial `void loadData()` قد يترك catalog فارغًا مع unhandled rejection. Settings `load()` في `SettingsPage.tsx:86-99` يسجل console فقط، ثم `s=null` يعرض Loading forever في lines 320-327. Notifications load أيضًا بلا catch في lines 41-65. | انقطاع الشبكة يبدو “لا توجد بيانات” أو loading دائم، ولا retry واضح. | POS, Settings, Notifications | أضف `loadError` + `ScreenState` + retry، وافصل critical/optional requests حتى فشل employees لا يمنع center settings. |
| M-04 | Confirmed defect | Logo/branding workflows متعارضة وبعضها لا يعرض الملف | Storage bucket private. `uploadLogo()` يحفظ object path فقط (`repositories.ts:1307-1319`)، ولا يوجد `createSignedUrl/download/getPublicUrl`. UI يستعمل path مباشرة في `<img src>` (`SettingsPage.tsx:514-515`, `InvoicePrintLayout.tsx:41,77-83`) فينتج relative/غير قابل للعرض. Branding path آخر يحفظ base64. Import في `BrandingSettingsPage.tsx:230-240` ينفذ `setSettings(imported); handleSave()` في نفس tick، فيحفظ stale state؛ test suite أظهر controlled→uncontrolled warning. | شعار مرفوع قد يظهر مكسورًا، وimport يعلن success دون persist صحيح. | Settings, Storage, receipts, branding | اختر storage strategy واحدة. resolve signed URL عند القراءة أو store validated data URL؛ مرّر imported object مباشرة إلى save بعد schema validation. |
| M-05 | Confirmed risk | Queries/search غير bounded وبها stale-response/query-syntax risks | 40 موضع `.select('*')`; customer/services/employees/products/gift cards وغيرها بلا `.range/.limit`. Dashboard يعيد تحميل customers/services/appointments/products فوق summary؛ POS يطلق 6 requests. Customer search `repositories.ts:260-263` يدمج raw input داخل `.or(...)` بلا escaping. POS `searchCustomers()` وAppointments debounced search لا يستعملان request sequence/AbortController؛ response قديم يمكن أن يكتب بعد الجديد. | بطء وتكاليف requests أعلى مع نمو البيانات، نتائج بحث stale، ومدخل comma/parentheses قد يسبب PostgREST syntax error. | Performance, customers, dashboard, POS | pagination/limits server-side، select columns فقط، request-id أو AbortController للبحث، وescape/build filter safely. |
| M-06 | Confirmed defect | Accessibility غير متسقة خارج shared primitives | Shared `Modal` جيد، لكن custom overlays في Appointments, Customers, Expenses, Reports, Attendance, Advances بلا `role=dialog/aria-modal` أو focus trap موحد. Settings desktop edit/delete controls `opacity-0 group-hover` في lines 686-699 ولا `group-focus-within`; buttons icon-only بلا accessible label. Touch controls متعددة `h-9/h-10` أقل من 44px. | keyboard/screen-reader users قد لا يرون focus/action، وقد يخرج focus خلف dialog؛ touch error أعلى. | UX, accessibility, mobile | استبدل local overlays تدريجيًا بـshared `Modal`; أضف labels وfocus-visible/group-focus-within، وارفع touch targets. لا تعيد تصميم العلامة. |
| M-07 | Confirmed defect | English/RTL experience غير مكتملة وبعض modules غير قابلة للاكتشاف | Attendance/Advances/Payroll/StaffAnalytics تحوي مئات Arabic characters hard-coded؛ مثال `AttendancePage.tsx:20-31, 307-364` و`AdvancesPage.tsx:252-323`. أربع routes لا تظهر في navigation/search. صفحات كثيرة تستعمل 8–10px copy وhard-coded gray/blue خارج tokens. | English user يرى Arabic mixed UI؛ admin لا يجد modules إلا بكتابة URL؛ readability ضعيفة. | i18n, navigation, design system | نقل visible copy إلى i18n، إضافة section واضح أو إبقاء modules disabled، واستبدال hard-coded styles بـtokens دون redesign. |
| M-08 | Confirmed incomplete | Auth/account lifecycle غير مكتمل والجلسة قد تصبح stale | لا signup/reset-password/invite/deactivate Auth UI أو adapter. لا `onAuthStateChange` subscription. `getSession()` فقط عند init/refresh؛ membership/role revoked في tab آخر يترك shell user state حتى reload، رغم أن RLS يمنع data. Admin bootstrap manual placeholder في `20260628000002_admin_bootstrap.sql`. | password recovery وuser onboarding يحتاجان Supabase Dashboard/operator؛ revoked user يرى UI مكسورًا قبل أن تمنعه DB. | Auth, support, operations | server-side invite/reset flow أو documented operator flow؛ subscribe to auth changes وأعد membership verification. أبقِ first-admin bootstrap manual لكن اجعله runbook/gate واضحًا. |
| M-09 | Confirmed testing gap | Test count لا يساوي journey coverage | 90 files/476 tests تمر، لكن 32 files source/SQL-structure reads، 14 تستخدم mocks، 24 Testing Library renders، وواحد فقط PGlite. لا browser E2E/coverage threshold. SQL acceptance files الثلاثة غير منفذة في workflow. Test run يصدر `act(...)` warnings في reports وcontrolled/uncontrolled warning في branding. | regressions في real Auth/RLS/Storage/PWA/mobile يمكن أن تمر مع suite خضراء. | QA, CI | أضف 5 E2E journeys على Staging: login/roles، appointment overlap، checkout retry، deletion boundary، backup/export label. اجعل React warnings failures بعد تنظيفها. |
| M-10 | Confirmed incomplete/security risk | Tauri ليس SQLite/offline product وCSP معطل | `src-tauri/src/lib.rs:55-99` يستعمل `lenabeauty-desktop.sqlite.json`; health يعلن `sqlite_ready/offline_first=true` في lines 67-87. `createTauriAdapters()` TODO وفارغ؛ Web factory لا يدعم Tauri. `tauri.conf.json` يحتوي `csp:null`, updater disabled. cargo check فشل: `cargo: not found`. | Desktop claims مضللة؛ إذا وُزع shell دون CSP يزيد أثر أي XSS، ولا يوجد offline database/sync فعلي. | Desktop, security, operations | غيّر capability flags إلى false ووسم Prototype؛ لا توزع. قبل release: real repository backend، CSP، Rust CI، signed updater/package tests. |
| M-11 | Probable risk | Logo uploads بلا server-side MIME/size/quota/cleanup contract | Settings upload يقبل `image/*` في UI فقط؛ adapter `repositories.ts:1313-1316` لا يفحص MIME/size، ويصنع filename جديدًا بـ`Date.now()` مع `upsert:true`. bucket policy center-scoped جيدة، لكنه لا يحذف logo القديم. Branding base64 يسمح 2MB client-side فقط. | authenticated member يستطيع استهلاك Storage أو حفظ non-image؛ logos القديمة تتراكم وتزيد quota/cost. | Storage, quotas, privacy | bucket-level MIME/size restrictions، adapter validation، delete old object بعد successful replace، owner quota/retention policy. |
| M-12 | Confirmed gap | Auditability محدودة خارج financial entitlement ledger | لا centralized audit table لكل CRUD. Customers/employees/settings/products قابلة update/delete بلا actor/reason. `accounting_journal_entries` نفسها لها membership-scoped UPDATE/DELETE policies في inventory. Console logs ليست audit trail. | لا يمكن إثبات من غيّر customer/settings/stock أو استعادة sequence بعد incident. | Data governance, security, operations | حدد records التي تحتاج immutable audit، ثم trigger-based audit log أو append-only domain events مع actor، reason وtimestamp؛ لا تسجل passwords/PII الزائد. |
| M-13 | Confirmed defect | Attendance تسمح duplicate employee/day وساعات غير معقولة | schema في `20260628000015...sql:28-47` لا يملك UNIQUE `(center_id, employee_id, date)` ولا check check-out > check-in/max hours. UI `computeWorkHours()` يعيد 0 إذا checkout قبل checkin، ولا يدعم overnight. | duplicate records تضخم attendance analytics؛ إدخال وقت خاطئ يتحول 0 بدل validation. | Attendance, analytics, payroll future | unique constraint بعد data cleanup، validation واضحة للوقت، وقرار overnight shift. |
| M-14 | Confirmed incomplete | Payment gateway/public booking modules ليست live features | Payment page نفسها تعترف في `PaymentGatewaySettingsPage.tsx:125-140` أن live charge/webhook غير موجود؛ لا server/webhook/SDK. Booking/Portal/Landing files غير mounted، والـcanonical function ACL لا تمنح public RPCs للعملاء. | لا online deposit، public booking أو client portal رغم وجود screens/config labels؛ يجب ألا تدخل sales claims. | Product, integrations | أبقها disabled وسمِّ الإعدادات metadata only. تفعيل أي provider/public RPC يحتاج owner/legal/security review وserver-side secrets/rate limits. |
| M-15 | Recommendation / probable update risk | SW يحمّل كل lazy code ويحدث تلقائيًا بلا release UX | build: dist 2.2MB؛ Workbox precache 54 entries/1910.10 KiB، بما فيها chart chunk 354.8KB وكل admin page. `registerType:autoUpdate` + generated `skipWaiting/clientsClaim`. | install/update أثقل على low-end/mobile، وopen session قد يواجه mixed-version lazy chunk عند deployment. | PWA, performance | استبعد nonessential lazy chunks من precache أو قسّم shell strategy؛ أضف controlled update/reload UX وtest للـold-client deployment. |
| M-16 | Confirmed operations gap | لا monitoring/alerting أو DR proof | `src/shared/logger.ts` console-only؛ ErrorBoundary local report ID فقط. لا Sentry/remote logs/uptime checks. 7 rollback runbooks فقط مقابل 31 migrations، ولا rollback automation. hosted Supabase backup/PITR/quota policy غير موجودة في repo. | failures/data exhaustion قد تبقى بلا تنبيه؛ restore/RTO/RPO غير معروف. | Operations, support, cost | minimum telemetry + uptime + failed checkout alert دون PII؛ وثّق Supabase plan/quota/backup/RPO/RTO واختبر restore على disposable project. |

## 5.4 Low

| ID | النوع | finding | الدليل الملموس | الأثر | أصغر remediation |
|---|---|---|---|---|---|
| L-01 | Confirmed maintainability issue | `lint` ليس linter، dual lockfiles، dead/abandoned code | `package.json`: lint = `tsc --noEmit`; لا ESLint/Biome. `package-lock.json` و`pnpm-lock.yaml` كلاهما tracked بينما CI npm. Dead candidates بلا runtime imports تشمل `src/types.ts`, public pages, `DesktopOperationsCard`, `DemoDataBanner`, `EmptyState`, `LoyaltyTierBadge`, `MobileBottomNav`, `useMobileOptimization`, `infrastructure/tauri`. `repositories.ts` ≈149KB وعدة pages 44–58KB. | drift وصعوبة review، لكن ليس سببًا وحده لمنع release | أعلن npm policy، أضف linter تدريجيًا، ثم احذف/اعزل dead code بعد import/test proof. |
| L-02 | Confirmed dependency note | لا vulnerability حاليًا، لكن transitive deprecated package ومجموعة major upgrades | `npm audit`: 0. npm warning: `glob@11.1.0` عبر `vite-plugin-pwa → workbox-build`. `npm outdated` أظهر majors لـVite, TypeScript, i18next وغيرها. | maintenance future، لا failure حالي | لا تعمل broad upgrade الآن؛ حدّث dependency واحدة في PR مع build/PWA regression tests. |
| L-03 | Confirmed docs drift | الوثائق الرسمية متناقضة مع الكود | README يقول payroll Demo-only وغير Supabase-backed؛ migrations/adapters تدعمه. `CURRENT_VERSION_CLOSURE` أعداد قديمة. authorization matrix تعطي MANAGER reports وSTAFF read-only بينما routes الحالية ADMIN-only/operational CRUD. Roadmap يصف Tauri كSQLite. | operator/product decisions تعتمد على معلومات خاطئة | عيّن 4 canonical docs فقط، archive الباقي أو ضع banner “historical”، واجعل counts generated. |
| L-04 | Confirmed diagnostic robustness issue | Live preflight لا يمسك network rejection | `scripts/supabase-live-preflight.mjs:217-234` ينفذ `Promise.all(fetch)` بلا per-request catch. في التدقيق TLS reset نتج uncaught stack trace بدل FAIL summary. | تشخيص CI أقل وضوحًا؛ لا يغيّر المنتج | catch لكل table، سجل table+network code بلا URL/key، واستمر لجمع النتائج ثم exit nonzero. |

---

## 6. Positive controls verified

هذه نقاط جيدة لكنها لا تلغي findings:

- 34/34 canonical tables لها RLS enabled في PGlite inventory.
- Tenant queries تضيف `center_id` بشكل واسع، وcross-center FKs أضيفت للرواتب والعلاقات الحساسة.
- Auth role يُقرأ من server-owned `app_metadata` وليس `user_metadata`.
- invalid role أو membership bootstrap failure يفشلان مغلقًا إلى Login.
- checkout client entry هو `process_checkout_idempotent_v1`; legacy direct checkout غير ممنوح للclient في final canonical ACL.
- checkout DB transaction يقفل customer/catalog/entitlements ويستخدم conditional stock decrement؛ request UUID يمنع duplicate retry لنفس payload داخل adapter session.
- financial direct INSERT/UPDATE/DELETE على invoices/payments/entitlement ledger مسحوبة في canonical contract.
- entitlement ledger append-only من client perspective، وله balance trigger وقواعد over-redemption.
- appointment overlap له canonical exclusion constraint وduration snapshot/state trigger، لكن hosted execution لم يُتحقق.
- `SECURITY DEFINER` functions تخضع لـsearch_path audit gate.
- Web CSP يمنع inline scripts/eval، ويمنع framing/object embedding، مع HSTS/nosniff/referrer/permissions headers في `vercel.json`.
- print HTML يمر عبر sanitizer/escaping في paths المستخدمة.
- لا custom webhook/server SSRF surface حاليًا؛ URLs في Payment Settings تُحفظ فقط ولا تُfetch على server.
- CSRF التقليدي منخفض التطبيق هنا لأن Supabase يستعمل bearer Authorization من JS وليس ambient app cookies؛ XSS يبقى مهمًا لأن session client-side.
- لا analytics/third-party telemetry ترسل customer data حسب source الحالي.
- Service Worker لا runtime-cache Supabase API responses؛ authenticated business data ليست ضمن Workbox cache الحالي.
- PWA icons موجودة فعلًا بأبعاد 192×192 و512×512.

---

## 7. Baseline checks and exact results

### Git baseline

عند بداية هذا التدقيق كانت التغييرات الموجودة مسبقًا محفوظة ولم تُمسح:

```text
M  docs/database-contract/artifacts/frontend-usage.json   (196 → 198 files)
?? ARCHITECTURE.md
?? PROJECT_COMMANDS.md
?? PROJECT_OVERVIEW.md
?? PROJECT_STATUS.md
```

هذه تغييرات discovery سابقة في workspace، وليست findings fix من هذا التدقيق. تمت إضافة `FULL_PROJECT_AUDIT.md` فقط. لم أستخدم reset/clean أو migration/remote write.

### Commands

| command/check | النتيجة الفعلية |
|---|---|
| `node --version` | `v22.22.3` |
| `npm --version` | `10.9.8` |
| `npm ci` | PASS؛ 516 packages installed، 517 audited |
| `npm audit --audit-level=moderate` | PASS؛ 0 vulnerabilities؛ transitive glob deprecation warning |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS، لكنه يعيد typecheck فقط |
| `npm run build` | PASS؛ 2830 modules؛ dist 2.2MB |
| PWA build | PASS؛ 54 precache entries، 1910.10 KiB |
| `npm test -- --reporter=dot` | PASS؛ 90/90 files، 476/476 tests، 109.13s |
| test warnings | non-fatal: two reports `act(...)` warnings، one branding controlled/uncontrolled warning، expected initialization error log |
| `npm run ci:migrations` | PASS؛ 31 canonical migrations |
| `npm run ci:rpc-check` | PASS؛ 20 frontend RPC references found in migrations |
| `npm run db:types:check` | PASS |
| `npm run audit:gate` | PASS |
| PGlite replay inventory | 30 automated + 1 manual bootstrap; fingerprint identical; 0 replay/non-idempotency failures |
| `npm run desktop:test` | PASS؛ 6 files/12 tests |
| `npm run desktop:tauri:check` | FAIL diagnostic environment: `cargo: not found` |
| `npm outdated --long` | Major updates available؛ ليس test failure |
| local production preview | PASS startup on `0.0.0.0:4173` |
| HTTP smoke | `/`, manifest, SW, icon, CSS, `/dashboard`, `/pos` كلها HTTP 200؛ pathname routes تعيد SPA HTML |
| live Supabase preflight | static checks PASS؛ remote verification crashed على TLS `ECONNRESET`، لذلك remote result unknown |
| GitHub Actions inspection | latest run static PASS؛ live Demo migration/security job skipped |

### Database inventory

```text
31 migrations
34 tables
364 columns
380 constraints
78 foreign keys
99 indexes
23 triggers
41 functions
65 RLS policies
34 RLS-enabled tables
0 views
```

PGlite لا ينفذ `btree_gist` exclusion constraint فعليًا؛ replay يسجله كـcanonical-only surrogate. لذلك local replay ليس behavioral proof للـoverlap constraint على hosted PostgreSQL.

### Runtime verification limit

HTTP 200 يثبت serving/build artifacts فقط، وليس نجاح Login أو CRUD. لم يكن browser executable أو Auth credentials متاحًا. لم أدّع visual layout أو screen-reader/browser behavior لم أشاهده.

---

## 8. Security and privacy coverage

### لم يُثبت كعطل حالي

- لا tracked service-role/database password مؤكد؛ full tests تضمنت secrets scan ومرت.
- لا `eval/new Function` أو unescaped production script sink مؤكد.
- `dangerouslySetInnerHTML` في receipt مخصص لCSS مشتق من enum (`58mm/80mm`)، وليس customer HTML.
- print service يسمح HTML content لكنه يزيل scripts/event handlers/javascript URLs؛ call sites الحساسة تستعمل escaping/React markup.
- لا server-side URL fetch، لذلك SSRF غير applicable حاليًا.
- لا webhook endpoint، لذلك webhook signature verification غير applicable لكنه مطلوب قبل أي payment provider.
- لا custom cookies/CORS server config؛ Supabase CORS/Auth hosted configuration بقي Unknown.

### Privacy risks المتبقية

- STAFF financial/salary visibility حسب canonical design: CR-02.
- JSON exports/CSV تحتوي customer PII وتُنزل غير مشفرة بواسطة admin browser؛ يجب تحديد handling policy.
- WhatsApp development logger يسجل phone/message/link في console فقط عندما `import.meta.env.DEV`; لا server retention.
- Client Portal dead page يخزن phone/token في localStorage، لكنه غير routed وRPC grants disabled. يجب تغيير هذا قبل إعادة التفعيل.
- لا privacy retention/anonymization/consent model موثق للعملاء أو marketing messages.

---

## 9. Testing assessment

### ما تحميه suite جيدًا

- validation primitives وrepository boundary validation.
- auth role mapping وroute guard units.
- POS calculations وmocked checkout UI.
- migration text/contracts، PGlite replay، RPC existence، generated types.
- financial entitlement mapper/SQL invariants الأساسية.
- print sanitizer وshared accessibility primitives.
- i18n key coverage وdesktop bridge source contracts.

### ما لا تحميه

- real Auth users/role downgrade/mismatch.
- direct STAFF RPC abuse للfinancial/admin functions.
- hosted relation grants/RLS عبر PostgREST.
- real checkout network-loss retry and reconciliation.
- payroll partial failure/commission correctness.
- restore round-trip لجميع tables.
- SQL files تحت `supabase/tests/` في CI.
- browser focus, contrast, mobile keyboard, PWA install/update/offline.
- Vercel headers against current deployed commit.
- Tauri compile/package/signing.

لا يوجد coverage threshold، لذلك عدد 476 لا يثبت نسبة تغطية أو حماية journeys.

---

## 10. Performance assessment

### جيد

- route/page lazy loading وmanual vendor chunks.
- heavy charts في chunk مستقل.
- report/date queries الرئيسية center/date-scoped ولها عدة indexes.
- POS stock mutation في DB وليس read-then-write client فقط.
- lazy chart rendering وimage components موجودة.

### مخاطر مؤكدة/معقولة

- no pagination لأي catalog/customer/history/ledger list تقريبًا.
- `%term%` customer search بدون trigram/search index وبraw PostgREST filter construction.
- Dashboard يكرر customer/service/appointment/product fetch فوق summary requests، ولا query cache.
- 1.91MiB PWA precache يحمل admin/lazy code حتى للمستخدم الذي لن يفتحه.
- external Google Fonts تضيف network dependency أول مرة؛ system fallback موجود.
- لا performance budgets أو Lighthouse/browser CI.

لا توجد dataset حقيقية كبيرة لقياس p95، لذلك outage/performance scale تبقى probable لا confirmed.

---

## 11. Operations and deployment assessment

- Vercel config يبني بـ`npm ci` و`npm run build` ويخدم `dist` مع SPA rewrite/security headers.
- repository لا يحتوي Production Supabase project أو protected Production migration workflow.
- Demo workflow فقط، وlive job مشروط بمجموعة secrets كاملة؛ حاليًا skipped.
- manual admin bootstrap يجب أن يُنفذ out-of-band مع Auth UUID حقيقي؛ workflow يسجل migration history applied دون تشغيل placeholder SQL.
- لا automated rollback. 7 migrations متأخرة فقط لها rollback runbooks.
- لا central logs، error ingestion، uptime، failed-checkout alerts، quota alerts أو backup alerts.
- لا repository proof لـSupabase PITR/backups أو restore drill.
- recurring cost غير قابل للحساب: hosted Supabase/Vercel/provider plans غير متاحة من source. Payment/WhatsApp/SMS costs مستقبلية وتتطلب owner approval.
- GitHub Deployments API يعرض Production deployment record قديمًا بتاريخ 2026-08-13، وليس current checkout proof.

---

## 12. Prioritized remediation roadmap

## Milestone 0 — Contract lock and containment plan (آمن، لا migration)

1. Owner يقرر role matrix النهائي: ما الذي يراه/يعدله `ADMIN/MANAGER/STAFF`، خصوصًا finance, employee salary, refunds, settings.
2. أضف failing regression tests تثبت CR-01..CR-04 قبل أي behavior change.
3. أضف PR CI لكل `src/**` وشغّل build/tests/audit دون انتظار DB change.
4. غيّر release documentation إلى NO-GO، ووسم User Management/Backup/Payroll/Notifications كغير معتمدة.
5. ضع checklist للـStaging migration وrollback، دون تطبيق remote.

**Exit:** expected authorization/math/payroll behavior مكتوب ومختبر، ولا يوجد خلاف بين product وengineering على المعادلات أو الأدوار.

## Milestone 1 — Authorization and financial correctness (يحتاج owner + Staging migration approval)

1. ADMIN-enforce sensitive RPCs وrelation policies؛ revoke surplus EXECUTE.
2. اجعل Dashboard/Reports تعتمد server-governed financial report contract.
3. صحح VAT/prepaid/earned/P&L calculations مع reconciliation SQL tests.
4. حوّل payroll create/delete إلى transaction RPC وقرر commission formula.
5. اختبر ADMIN/STAFF direct API attempts وcross-center isolation بمستخدمين حقيقيين.

**Exit:** unauthorized calls fail 401/403/42501، والـfinancial fixtures تطابق نتائج متفق عليها حتى 0.001 OMR.

## Milestone 2 — Account/data lifecycle and recovery

1. افصل Auth account management عن employees.
2. قرر archive/anonymize/delete retention.
3. أوقف misleading backup UI أو نفذ versioned atomic restore كاملًا.
4. اختبر restore في disposable project وقس RPO/RTO.
5. أضف audit actor/reason للأحداث المطلوبة.

## Milestone 3 — Journey reliability and UX/accessibility

1. error/retry states لـPOS/Settings/Notifications.
2. shared Modal لكل dialogs وkeyboard/touch fixes.
3. إكمال i18n للـstaff modules وإصلاح navigation.
4. branding/logo contract واحد.
5. إصلاح notification wording وتعطيل no-op actions.

## Milestone 4 — Performance/PWA/real QA

1. pagination, bounded selects, cancellable search، indexes بعد `EXPLAIN` على Staging data.
2. manifest hash URLs وcontrolled update/offline states.
3. Playwright E2E للرحلات الخمس الحرجة.
4. mobile/RTL/screen-reader/printer/PWA device matrix.

## Milestone 5 — Operations/production readiness

1. separate Production Supabase project وprotected migration workflow.
2. monitoring/alerts/quota/backup/PITR/restore drill.
3. staging acceptance evidence وowner sign-off.
4. production rollout + rollback window فقط بعد موافقة صريحة.

---

## 13. Items requiring owner approval

لا ينبغي تنفيذ الآتي بقرار تقني منفرد:

1. Role matrix النهائي، وهل MANAGER يرى reports/financial data أم لا.
2. من يملك refund/void/expiry/accounting/settings actions.
3. Commission formula: مصدر sale attribution، النسبة قبل/بعد discount/VAT، التوقيت، refunds/no-shows.
4. VAT recognition للservices/packages/gift cards والـaccounting report labels.
5. Customer/employee retention: archive، anonymize، legal retention، أو hard delete.
6. Backup target وRPO/RTO وSupabase paid backup/PITR plan.
7. Provision Production Supabase/Vercel environment وأي paid plan.
8. تطبيق migrations على Demo/Production أو أي destructive cleanup.
9. تفعيل public booking/client portal وما يحتاجه من abuse/rate-limit/privacy controls.
10. WhatsApp Business/SMS/payment providers، تكلفتها، consent، secrets، webhooks وlegal terms.
11. هل Tauri منتج تسليم أم prototype يجب إبقاؤه غير موزع.
12. Monitoring provider وما يسمح بإرساله من PII.

---

## 14. Unverified areas

| المجال | لماذا لم يُتحقق |
|---|---|
| Hosted DB schema/grants/RLS | live GitHub job skipped؛ sandbox TLS إلى Supabase فشل `ECONNRESET` |
| Real ADMIN/STAFF/MANAGER login | لا credentials؛ لم أطلب أو أكشف secrets |
| Cross-center runtime isolation | يحتاج مستخدمين ومراكز test على disposable project |
| Real checkout/stock/idempotency | يحتاج hosted test data ومعاملة يمكن حذفها بأمان |
| Appointment exclusion constraint live | PGlite لا يدعم btree_gist؛ hosted DB غير متاح |
| Storage signed access/logo | لا authenticated session؛ الكود نفسه لا ينشئ signed URL |
| Public deployed commit | public TLS من sandbox فشل؛ deployment metadata قديم ولا يثبت current code |
| Browser visual/keyboard/contrast | لا browser executable؛ HTTP/jsdom لا يقيس layout أو contrast |
| PWA install/update/offline | يحتاج Chrome/Android/iOS session مع SW |
| Printer/share | يحتاج 58/80mm hardware وmobile share target |
| Tauri | Cargo/Rust غير مثبت؛ لا package/sign/update test |
| Auth password/MFA/leaked-password config | managed Supabase setting غير موجود محليًا؛ live credential job skipped |
| Managed backups/quotas/cost | حسابات provider/plans غير ظاهرة في repository |
| Production data quality | لا dataset أو approved read access |

---

## 15. Final conclusion

المشروع ليس “مكسورًا بالكامل”: Web build، local schema replay، tenant scaffolding، checkout transaction، validation وكمية جيدة من tests كلها أصول حقيقية. لكنه أيضًا ليس production-ready. أخطر العيوب ليست شكلية؛ هي صلاحيات مالية، معادلات revenue/payroll، recovery/data lifecycle، وغياب live acceptance.

**الخطوة الأولى الأكثر أمانًا ليست broad refactor.** هي Milestone 0: تثبيت role/financial/payroll contracts في tests وCI، تصحيح release claims، ثم تجهيز migration صغيرة قابلة للrollback لـStaging بعد موافقة owner. أي تحسين بصري عام قبل ذلك يؤجل المخاطر الفعلية بدل حلها.
