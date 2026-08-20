# Privacy & Data Governance — LenaBeauty

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Engineering best practices implemented. Legal compliance requires qualified
legal review — this document does not provide or claim legal advice.

---

## 0. Scope & Honest Limits

This document is an engineering privacy-by-design baseline. It is **not legal advice**
and does not certify compliance with any regulation (e.g. Oman's PDPL, GDPR, etc.).
The owner should have this reviewed by qualified legal counsel before Production with
real customer data. Open legal questions are listed in §8.

---

## 1. Data Inventory (what the app actually stores)

| Data | Purpose | Source | Storage | Access |
|---|---|---|---|---|
| Customer name, phone, email, notes | CRM / appointments / POS | Staff entry | Supabase Postgres | Center members (RLS) |
| Employee name, phone, salary, commission | Workforce mgmt / payroll | Staff entry (ADMIN) | Supabase Postgres | ADMIN only (salary hidden from others) |
| Appointment records (customer, service, staff, time) | Operations | Staff entry | Supabase Postgres | Center members |
| Invoices & payments (method, amounts) | Accounting | POS checkout | Supabase Postgres | Center members; revenue admin-only |
| Gift cards / packages entitlements | Deferred obligations | POS | Supabase Postgres | Center members |
| Auth identity (email, hashed password, role) | Access control | Admin-created accounts | Supabase Auth | Server-side only |
| Center branding (logo, colors, text) | Invoices/branding | ADMIN upload | Supabase Storage (private) + localStorage cache | ADMIN write; members read via signed URL |
| Support tickets | Help intake | Staff self-report | Supabase Postgres | Center members (immutable) |
| Notification timeline (message previews) | Delivery log | App events | Supabase Postgres | Center members |
| Local prefs (lang, theme, active center) | UX preference | Browser | localStorage (device only) | Same device |
| Activation events (guide_shown etc.) | Onboarding measurement | Browser | localStorage (device only, no PII) | Same device |

**Explicitly NOT stored:** payment card numbers, government IDs, passwords in plaintext,
biometrics, location data, device identifiers, advertising identifiers.

---

## 2. Flow Map

```
Staff input → Client validation → Supabase RPC (SECURITY DEFINER + RLS)
   → Postgres (tenant-scoped by center_id) 
   → Signed URL for private Storage reads (1h expiry)
   → Optional: manual wa.me handoff (message leaves only when staff taps Send)
Browser prefs → localStorage (never synced, no PII in activation events)
```

---

## 3. Minimization & Safe Defaults

| Practice | Status |
|---|---|
| RLS on every table; tenant-scoped reads/writes | ✅ Verified (audit gate) |
| Compensation fields stripped for non-ADMIN | ✅ Verified (list_employees_v1) |
| No public bucket; signed URLs with 1h expiry | ✅ Verified |
| Support intake rejects secret patterns | ✅ Implemented (help system) |
| Logs never contain SQL bound params or full customer IDs | ✅ Implemented this session |
| Password reset does not reveal account existence | ✅ Verified |
| No analytics provider, no tracking pixels, no third-party SDKs | ✅ Verified |
| localStorage contains only prefs + activation events (no PII) | ✅ Verified |

---

## 4. Providers & Sharing

| Provider | Data | Notes |
|---|---|---|
| Supabase (Auth, Postgres, Storage) | All app data | Region/tenant policy must be confirmed with provider for Production |
| Meta (WhatsApp) | **None automated** | Only manual wa.me links; staff chooses what to send; no API |
| Payment providers (Thawani/PayTabs/Stripe) | **Metadata only** | No live session, no card data, no webhook |

**No other third parties. No data is sold or shared for advertising.**

---

## 5. Retention Recommendations (owner decision required)

| Data | Recommended retention | Basis |
|---|---|---|
| Customer records | Until account closed + legal tax period | Business need |
| Invoices / financial records | Legal retention period (tax law — **legal review needed**) | Regulatory |
| Support tickets | 2 years | Operational |
| Notification timeline | 90 days | Operational |
| Activation events (local) | Device lifetime / cleared on logout | No PII |
| Logs | 90 days | Ops |

⚠️ Exact retention periods are an **owner + legal** decision — not asserted as compliance here.

---

## 6. User Rights & Request Workflows (implemented foundation)

### 6.1 "My Data" controls (new — Settings → Data)

- **Export my data** — exports the caller's center-scoped operational dataset (customers,
  appointments, invoices) as JSON to the device. No server copy retained.
- **Request account deletion** — generates a provider-neutral deletion request ticket
  (stored in `support_tickets` with `privacy_request` marker) that the owner action:
  deletes the auth user + profile + memberships + cascades. The app never hard-deletes
  data automatically without owner confirmation (reversibility).
- **Consent/notification preferences** — per-channel opt-in with quiet hours
  (implemented in notification system).

### 6.2 Flow guarantees

- Every request shows a confirmation step (no accidental destructive action).
- Identity: the request is bound to the authenticated session; an ADMIN confirms
  deletion of an account (self-lockout protection: an admin deleting their own account
  is warned).
- Completion: request state visible in Support Operations (NEW → ACKNOWLEDGED → RESOLVED).
- Failure recovery: RPC failures surface a friendly error with retry; nothing is
  partially deleted (transactional where possible).

---

## 7. Technical Controls Implemented This Session

| Control | Where |
|---|---|
| SQL bound params never logged | `src/infrastructure/tauri/client.ts` |
| Full customer IDs never logged | `src/infrastructure/services/whatsappService.ts` |
| Secret-pattern rejection in support intake | `src/pages/HelpCenterPage.tsx` |
| Immutable support tickets (no UPDATE/DELETE) | Migration `20260820000003` |
| Tenant-scoped everything (center_id RLS) | Verified via audit gate |

---

## 8. Open Legal Questions (for the owner + counsel)

1. Which legal regime applies to this product (Oman PDPL, GCC data law, EU GDPR if
   serving EU customers)?
2. What retention period is legally required for invoices/tax records in Oman?
3. Is explicit consent required for the center's staff-facing processing, or is
   legitimate-interest/employment basis sufficient?
4. Cross-border: where does the Supabase project physically host data? Is transfer
   lawful under the applicable regime?
5. Employee salary/commission data — any special protection required?
6. Do we need a formal privacy policy / notice displayed at sign-in?

---

## 9. Test Plan (implemented in `src/__tests__/privacy-governance.test.ts`)

1. No source file logs SQL bound params (Tauri client shape-only).
2. WhatsApp service logs contain at most a 4-char suffix of ids.
3. localStorage keys contain no PII values (activation events empty of emails/phones).
4. Support intake rejects secret patterns.
5. No `VITE_*` or secret strings in compiled dist (secrets-scan already covers).
6. "My Data" export invokes the export RPC and renders JSON locally.
