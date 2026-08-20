# Localization & Content System — LenaBeauty

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Implemented. Arabic-first (RTL) with English (LTR) secondary.

---

## 1. Supported Locale Policy

| Locale | Direction | Status | Notes |
|---|---|---|---|
| `ar` (Arabic) | RTL | Primary | Default; `ar-OM` for date/time where available |
| `en` (English) | LTR | Secondary | `en-US` for date/time |

- **Default language:** Arabic (`fallbackLng: 'ar'`).
- **Detection:** explicit language switch persists in `localStorage` (`spa-lang`);
  legacy key `lenabeauty_lang` migrated on read.
- **No auto-detection from browser:** staff-only app, the center's operator language
  is the user's choice. Auto-detection would surprise the team mid-shift.
- **RTL:** `document.documentElement.dir` and `lang` set on boot and on switch.
  Layout uses logical properties (`start`/`end`, `ps`/`pe`, `text-start`/`text-end`)
  — see §6 for the enforcement tests.

---

## 2. Terminology Glossary (canonical)

One English term → one Arabic translation, used everywhere. The i18n dictionary is the
single source of truth; this glossary documents the canonical pairs.

| English | Arabic | Notes |
|---|---|---|
| Dashboard | لوحة التحكم | Never "الرئيسية" for the page title (bottom bar may use "Home") |
| Point of Sale (POS) | نقطة البيع | Never "المبيعات" alone |
| Appointment | موعد | Booking = حجز |
| Customer | عميل | Client = عميل (avoid "زبون") |
| Employee | موظف | Team = الفريق (informal) |
| Service | خدمة | Service menu = قائمة الخدمات |
| Inventory | المخزون | Products = المنتجات |
| Invoice | فاتورة | Receipt = إيصال |
| Payment | الدفع | Payment method = طريقة الدفع |
| Discount | خصم | — |
| Loyalty points | نقاط الولاء | Points = نقاط |
| Gift card | بطاقة هدية | — |
| Package | باقة | — |
| Advance | سلفة | — |
| Payroll | الرواتب | Payroll run = دورة رواتب |
| Attendance | الحضور | — |
| Expense | مصروف | — |
| Report | تقرير | Reports = التقارير |
| Settings | الإعدادات | — |
| Notification | إشعار | — |
| Support | الدعم الفني | Help = المساعدة |
| Sign in | تسجيل الدخول | Login = تسجيل الدخول |
| Sign out / Logout | تسجيل الخروج | — |
| Restore | استعادة | — |
| Backup | نسخة احتياطية | — |
| Deactivate | إلغاء التفعيل | — |
| Activate | تفعيل | — |

**Rule:** a new feature's UI strings must use these pairs. The i18n leak test
(`i18n.no-language-leak.test.ts`) already fails on missing/duplicate keys; the
glossary test (§9) fails on mixed-usage of the above in shipped strings.

---

## 3. Formatting

| Type | Rule | Example (ar) |
|---|---|---|
| Dates | `toLocaleDateString(lang, { dateStyle: 'medium' })` — always pass the active language; never a hardcoded locale | ٢٠ أغسطس ٢٠٢٦ |
| Times | `toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })` | ٤:٠٠ م |
| Numbers | OMR amounts via `formatOMRAmount` (3 decimals) — Arabic-Indic digits per locale | ١٥٫٥٠٠ ر.ع. |
| Currency | `OMR` / `ر.ع.` — never mixed in one string | — |
| Plurals | Manual forms are rare; prefer "N items" with count in the number | — |
| Names | `dir="ltr"` on name/phone/email inputs so Latin text renders correctly in RTL | — |

**Known fixes implemented this session:**
- `AttendancePage`, `AdvancesPage`, `ExpensesPage` used hardcoded `"ar-SA"` /
  `"ar-OM"` locale strings — now follow the active UI language.
- `AccountingPage` used `text-left` (physical) — replaced with `text-start`
  (logical) so the table header aligns correctly in RTL.
- Receipt print date now uses the active language.

---

## 4. Content Ownership & Translation Workflow

| Content type | Owner | Process |
|---|---|---|
| Interface copy | Product (this repo) | String added to both `ar`/`en` dictionaries in the same commit; leak test enforces |
| User-generated content (customer names, notes) | Staff entry | Never machine-translated; stored as entered |
| Business-managed content (service names, branding) | Center admin via UI | Stored in DB, rendered as-is; RTL-aware inputs |
| Legal/regulated text | Owner + legal counsel | **Never machine-translated**; human review required before publishing |
| Help articles | Product (this repo) | Bilingual registry in `src/shared/help/articles.ts`; freshness test pins count |

**No CMS recommended** — interface copy changes with code; business content is edited
in-app (branding, services). Non-developers do not need independent publishing
infrastructure at this scale.

---

## 5. Fallback & Missing Keys

- `fallbackLng: 'ar'` — a key missing from `en` renders Arabic to English users
  (silent!). The no-language-leak test scans every shipped `t("…")` literal.
- Missing from both → raw key string is rendered; the test fails on unresolved keys.
- Dynamic keys (e.g. `t(initError)`) are allowed only for known error keys.

---

## 6. RTL / Mixed-Direction Rules

1. Layout must use logical utilities: `start/end`, `ps/pe/ms/me`, `text-start/end`,
   `border-s/e`, `rounded-s/e`, `translate-x` guarded by `i18n.language`.
2. Icons that imply direction (arrows, chevrons) flip in RTL
   (`rotate-180` when `i18n.language === "ar"`).
3. Latin fields (email, phone, URLs, invoice serials) get `dir="ltr"` inline so
   punctuation/order stays correct inside RTL text.
4. `document.documentElement.dir/lang` updated on boot and language switch.
5. Test: `localization-rtl.test.tsx` walks key pages and asserts:
   - no `text-left`/`text-right` physical utilities in shipped pages,
   - chevron/arrow flip classes present where expected,
   - `dir="ltr"` present on latin input types.

---

## 7. QA Matrix

| Check | Test |
|---|---|
| No Arabic in English UI | `i18n.no-language-leak.test.ts` |
| Every shipped key resolves in Arabic | `i18n.no-language-leak.test.ts` |
| No duplicate keys either dictionary | `i18n.no-language-leak.test.ts` |
| Coverage of shipped surface | `i18n.coverage.test.tsx` |
| Glossary consistency | `localization-glossary.test.ts` (new) |
| RTL logical-property enforcement | `localization-rtl.test.tsx` (new) |
| Dates follow active language | `localization-rtl.test.tsx` (new) |

---

## 8. Test Plan (implemented)

1. `localization-glossary.test.ts` — canonical pairs; fails if a shipped string uses
   a deprecated synonym (e.g. "زبون" for customer, "المبيعات" for POS page).
2. `localization-rtl.test.tsx` — physical-direction utilities absent in pages;
   `dir` attributes correct; date locale follows language.
3. Existing leak/coverage tests stay green.
