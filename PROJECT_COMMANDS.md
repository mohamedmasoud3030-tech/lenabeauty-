# PROJECT_COMMANDS — LenaBeauty

**Verified on:** 2026-08-17
هذه الأوامر مأخوذة من repository وشُغلت حيث وُصف ذلك. لا يحتوي هذا الملف على أي secret values.

## 1. الأدوات والإصدارات

المتحقق في بيئة الاكتشاف:

```text
Node.js  v22.22.3
npm      10.9.8
Git      2.39.5
Rust     غير مثبت
Cargo    غير مثبت
```

المسار الرسمي المؤكد هو **npm** لأن Vercel وGitHub Actions يستخدمان `npm ci`. لا تستخدم pnpm دون قرار لتنظيف dual-lock policy.

## 2. الإعداد المحلي

```bash
npm ci
cp .env.example .env
```

ثم ضع القيم الصحيحة محليًا في `.env`؛ لا تضعها في Git أو chat.

المتغيرات المعرفة بالأسماء فقط:

```text
VITE_DATA_BACKEND
VITE_ENVIRONMENT
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_CENTER_ID
VITE_BRANCH_MODE
```

قواعد مهمة:

- Web backend الحالي: `supabase`.
- `VITE_ENVIRONMENT` اختياري في local/test، و`VITE_BRANCH_MODE` defaults إلى `single`.
- `VITE_CENTER_ID` مطلوب في `single` mode، واختياري في `multi` mode.
- local development بلا `.env` يعرض config error ولا يفتح data journeys.
- `VITE_*` قيم browser-visible؛ لا تضع service-role/database passwords فيها.
- `SUPABASE_SERVICE_ROLE_KEY` server-only ويستخدم مؤقتًا في preflight عند الحاجة؛ لا يُحفظ في Vercel browser vars أو repository.

## 3. Development runtime

```bash
npm run dev -- --host 0.0.0.0
```

المتحقق: Vite بدأ بنجاح على port 5173.

الوصول عبر HashRouter:

```text
/#/login
/#/dashboard
/#/pos
```

لا تعتمد `/dashboard` كـclient route مباشر داخل manifest؛ router الحالي hash-based.

## 4. Production build وpreview

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

المتحقق:

- build نجح.
- production preview بدأ على port 4173.
- `/`, `/manifest.webmanifest`, `/sw.js`, CSS asset أعادت HTTP 200.
- manifest Content-Type صحيح.

`npm run clean` موجود لكنه يحذف `dist`; لم يُستخدم في discovery لأنه destructive للbuild artifacts وغير لازم.

## 5. الجودة الأساسية

```bash
npm run typecheck
npm run lint
npm test
npm audit --audit-level=moderate
```

النتائج الحالية:

- typecheck: pass.
- lint: pass، لكنه يكرر typecheck فقط.
- test منفردًا: 90 files / 476 tests pass، مع React warnings موثقة في `PROJECT_STATUS.md`.
- npm audit: 0 vulnerabilities، مع deprecation warning لـtransitive glob.

لتشغيل test محدد:

```bash
npx vitest run src/__tests__/reports-page-states.test.tsx --reporter=dot
```

## 6. Database contract checks — آمنة محليًا

```bash
npm run ci:migrations
npm run ci:rpc-check
npm run db:types:check
```

المتحقق:

- 36 canonical migrations (35 automated + 1 manual bootstrap excluded from replay).
- 20 frontend RPC references كلها معرفة.
- generated DB types current.

### Audit tools

```bash
npm run audit:replay
npm run audit:scan
npm run audit:matrix
npm run audit:all
npm run audit:gate
```

تحذير مهم:

- هذه الأدوات لا تعدل DB remote.
- لكنها **تعيد كتابة** JSON files داخل `docs/database-contract/artifacts/`.
- `audit:gate` يفشل إذا كانت committed artifacts stale.
- في discovery فشل أول مرة لأن frontend file count تغير من 196 إلى 198، ثم pass بعد regeneration.
- راجع `git diff` بعد التشغيل ولا تتجاهل generated changes.

## 7. Supabase live preflight — يحتاج credentials واتصالًا

```bash
npm run preflight:supabase
```

بدون env صحيح يفشل؛ هذا ما حدث في discovery. مع env:

- يتحقق من أسماء migrations/schema contract.
- يتصل بـSupabase REST.
- publishable key يكفي لفحص table reachability.
- server-only key مطلوب لتأكيد center row بشكل أقوى.

لا تشغله على Production دون تحديد target وموافقة تشغيلية.

## 8. RLS isolation integration script

يوجد script غير مربوط بـpackage.json:

```bash
npx tsx scripts/verify-rls-isolation.ts
```

لكنه يحتاج test users/credentials ويمكن أن ينفذ عمليات destructive للاختبار. يحتوي safety gate يرفض remote target ما لم يضبط override صريح. **لم يُشغّل في discovery**. يجب تشغيله فقط على disposable/staging project وبموافقة.

## 9. Migration commands

Repository لا يثبت Supabase CLI كdependency. GitHub Actions تستخدم `supabase/setup-cli` ثم:

```bash
supabase link ...
supabase migration list --linked
supabase db push --linked --yes
```

هذه أوامر remote-changing. لا تُشغّل محليًا أو على Production في discovery. Manual admin bootstrap يحتاج UUID حقيقيًا ولا يجوز تشغيل placeholder.

Canonical source:

```text
supabase/migrations/*.sql   (filename order)
```

لا تستخدم SQL الموجود في `docs/archive/` كdeployment source.

## 10. Demo seed

الملف:

```text
supabase/seeds/20260810_lena_service_catalog_demo.sql
```

ليس ضمن migration chain ويحتاج explicit session gates. لا تشغله على Production. لم يُشغّل في discovery.

## 11. Desktop/Tauri

Web/JS desktop checks:

```bash
npm run desktop:test
npm run desktop:build:web
```

المتحقق: `desktop:test` نجح 12/12.

Rust check:

```bash
npm run desktop:tauri:check
```

النتيجة الحالية: `cargo: not found`.

Full desktop preflight:

```bash
npm run desktop:preflight
```

سيفشل في هذه البيئة عند cargo step. يحتاج Rust >=1.77 وTauri OS prerequisites. حتى بعد compile، Tauri data backend ما زال foundation/JSON وليس SQLite repository implementation.

## 12. CI workflow

Workflow:

```text
.github/workflows/demo-supabase-migrations.yml
```

Static gate sequence:

```bash
npm ci
npm run audit:gate
npm run db:types:check
npm run ci:migrations
npm run ci:rpc-check
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=low
git diff --check
```

Live job يعمل فقط إذا توفرت كل GitHub secrets المطلوبة. آخر run مقروء: static pass، live job skipped.

## 13. Deployment

Vercel يستخدم:

```text
installCommand: npm ci
buildCommand: npm run build
outputDirectory: dist
```

`vercel.json` يضيف SPA rewrite وsecurity headers. Public deployment أو تغيير Vercel env ليس جزءًا من discovery ولم يُنفذ.

## 14. Git safety بعد أي فحص

```bash
git status --short --branch
git diff --check
git diff --stat
git diff
```

لا تستخدم في هذا المشروع دون موافقة:

```text
git reset
git clean
supabase db reset
supabase db push إلى Production
أي restore/seed على بيانات حقيقية
```
