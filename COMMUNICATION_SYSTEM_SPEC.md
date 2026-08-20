# Communication System Specification — LenaBeauty

**Version:** 1.0  
**Date:** 2026-08-20  
**Status:** Approved for repository-side implementation; no live provider activation.

---

## 1. Design Principles

1. **Provider-neutral core** — The domain layer defines events and delivery requirements; channel adapters implement actual sending. No channel is hard-coded in business logic.
2. **Transactional first, optional second** — Appointment confirmations and payment receipts are transactional (must deliver). Promotions and loyalty updates are optional (best-effort).
3. **Idempotent delivery** — Every notification event carries a deduplication key so repeated triggers produce at most one send per channel.
4. **Preference-gated** — No message is sent to a customer who has opted out of that channel or is in quiet hours.
5. **No secrets in notifications** — Message previews, subject lines, URLs, and logs never expose API keys, tokens, passwords, or financial account details.
6. **No live provider activation** — The repository ships with wa.me (manual WhatsApp) and in-app toast channels active. SMS, email, push, and WhatsApp Business API require explicit owner approval.

---

## 2. Event–Channel Matrix

| Event ID | Event Name | Priority | Category | In-App (Toast) | WhatsApp (wa.me) | WhatsApp (API) | SMS | Email | Push |
|---|---|---|---|---|---|---|---|---|---|
| E-01 | Appointment booked | High | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | 🔒 Future |
| E-02 | Appointment reminder | Medium | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | 🔒 Future |
| E-03 | Appointment cancelled | High | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | 🔒 Future |
| E-04 | Appointment rescheduled | High | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | 🔒 Future |
| E-05 | Appointment completed | Low | Transactional | ✅ Staff | — | — | — | — | — |
| E-06 | Invoice/checkout complete | High | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | 🔒 Future |
| E-07 | Loyalty points earned | Low | Optional | — | ✅ Customer | 🔒 Future | — | — | — |
| E-08 | Tier upgrade | Medium | Optional | — | ✅ Customer | 🔒 Future | — | — | — |
| E-09 | Reward expiring | Low | Optional | — | ✅ Customer | 🔒 Future | — | — | — |
| E-10 | Low stock alert | Low | Optional | ✅ Staff | — | — | — | — | — |
| E-11 | Payment received | High | Transactional | ✅ Staff | ✅ Customer | 🔒 Future | 🔒 Future | 🔒 Future | — |

**Legend:**
- ✅ = Implemented in this version
- 🔒 Future = Architecture exists, requires owner approval for provider
- — = Not appropriate for this channel

---

## 3. Channels

### 3.1 In-App (Toast)
| Property | Value |
|---|---|
| Channel ID | `toast` |
| Direction | Staff only |
| Delivery guarantee | Best-effort (browser session) || 
| Cost | Free
| Privacy | No PII leaves the browser |

Implementation: Existing `Toast` component (`src/shared/components/Toast.tsx`).

### 3.2 In-App Notification Center
| Property | Value |
|---|---|
| Channel ID | `in_app` |
| Direction | Staff only |
| Delivery guarantee | Persistent in DB (survives refresh) ||| Cost | Free
| Privacy | No PII in notification center list |

Implementation: New `NotificationCenter` component fetches from `customer_notification_timeline` via `add_customer_notification_event_v1` RPC.

### 3.3 WhatsApp (wa.me Manual)
| Property | Value |
|---|
| Channel ID | `whatsapp_wa_me` |
| Direction | Customer |
| Delivery guarantee | None — user muss manully press Send | 
|| Cost | Free
| Privacy | Message is built clien-side, opened in browser, no PII sent to our servers|

Implementation: Existing `whatsappService.ts` — opens `https://wa.me/...` in new tab.

### 3.4 WhatsApp Business API (Future)
| Property | Value |
|---|---|---|
| Channel ID | `whatsapp_api` |
| Direction | Customer |
| Delivery guarantee | Yes — confirmed delivery receipt |
| Cost | Meta per-conversation pricing |
| Privacy | Requires Meta Business verification; templated messages only |

Implementation: Provider class using Graph API. Needs owner approval.

### 3.5 SMS (Future)
| Property | Value |
|---|---|
| Channel ID | `sms` |
| Direction | Customer |
| Delivery guarantee | Carrier-dependent |
| Cost | Per-message (bulk SMS provider) |
| Privacy | Phone number is PII — logged with limited retention |

### 3.6 Email (Future)
| Property | Value |
|---|---|
| Channel ID | `email` |
| Direction | Customer |
| Delivery guarantee | Best-effort (SMTP) | 
| Cost | Per-thousand (transactional email provider)|
| Privacy | No customer content in subject line |

---

## 4. Templates

### 4.1 Template Registry

Templates are stored in code (colocated with the notification domain), not in the database. Database-stored templates (from `notification_settings.whatsapp_template_*`) are used for center-customizable messages; all oters use compiled templates.

### 4.2 Variable Interpolation

| Variable | Source | Example |
|---|---|---|
| `{ustomer_name}` | `Customer.name` | "فاطمة" |
| `{appointment_date}` | `Appointment.dateTime` + locale formatting | "20 أغسطس 2026" |
| `{appointment_time}` | `Appointment.dateTime` + locale formatting | "4:0 م" |
| `{ervice_name}` | `Service.name` | "قص وتصفيف" |
| `{taf_name}` | `Employee.name` | "سارة" |
| `{enter_name}` | `CenterSettings.name` | "LenaBeauty" |
| `{payment_amount}` | `Invoice.totalAmount` | "15.500 OMR" |
| `{payment_method}` | `Invoice.paymentMethod` | "نقد" |
| `{oyalty_points}` | `Customer.loyaltyPoints` | "20" |
| `{tier_name}` | Customer tier (calculated) | "ذهبي" |
| `{tier_discunt}` | Tier discunt percentage | "10" |

### 4.3 Template Validation

Each template is validated at build time:
1. All untion variables exist in the variable registry.
2. No double-braced `{{...}}` that would leak braces.
3. No HTML or script tags.
4. Max length: 4096 chars (WhatsApp limit is 4096, SMS is 160).
5. Bilingual: Arabic and English versions for all customer-facing templates.

### 4.4 Default Templates

```typescript
const DEFAULT_TEMPLATES = {
  appointment_booked: {
    ar: "مرحباً {customer_name}!\nتم تأكيد موعدك في {center_name}\nالخدمة: {service_name}\nالتاريخ: {appointment_date}\nالوقت: {appointment_time}\nالأخصائي: {staff_name}",
    en: "Hello {customer_name}!\nYour appointment at {center_name} is confirmed.\nService: {service_name}\nDate: {appointment_date}\nTime: {appointment_time}\nStaff: {staff_name}",
  },
  appointment_reminder: {
    ar: "تذكير بموعدك غداً في {center_name}\nالخدمة: {ervice_name}\nالوقت: {appointment_time}\nنتظررك!",
    en: "Reminder: your appointment tomorrow at {center_name}\nService: {service_name}\nTime: {appointment_time}\nSee you soon!",
  },
  appointment_cancelled: {
    ar: "تم إلغاء موعدك في {center_name}\nالخدمة: {ervice_name}\nللتاص بنا لحجز موعد جدي.",
    en: "Your appointment at {center_name} has been cancelled.\nService: {service_name}\nPlease contact us to reschedule.",
  },
  invoice_receipt: {
    ar: "شكراً لزيارتك {center_name}!\nالمبلوغ: {payment_amount}\nطريقة الدفع: {payment_method}\nتاريخ الفاتورة: {appointment_date}",
    en: "Thank you for visiting {center_name}!\nAmount: {payment_amount}\nPayment: {payment_method}\nInvoice date: {appointment_date}",
  },
  loyalty_points_earned: {
    ar: "أحزت على {loyalty_points} نقطة ولاء!\nرصيدك الإجمالي: {total_points} نقطة\nالمستوى: {tier_name}",
    en: "You earned {loyalty_points} loyalty points!\nTotal balance: {total_points}\nTier: {tier_name}",
  },
  tier_upgrade: {
    ar: "تهانينا! لقد ارتقيت إلى مستوى {tier_name}\nالآن تحصل على {tier_discunt}% خصم!",
    en: "Congratulations! You've reached {tier_name} tier!\nYou now get {tier_discount}% discount!"
  },
}
```

---

## 5. Customer Preferences

### 5.1 Channel Opt-In

Each customer has per-channel opt-in stored in `customer_notification_preferences`:

| Field | Type | Default |Description |
|---|---|---|
| `channel` | enum | — | `WHATSAPP` \| `SMS` \| `EMAIL` |
| `opt_in` | bool | true for WhatsApp, lse otherwise | Subscription state |
| `opt_in_token` | uuid | null | For one-click untubscribe links |
| `quiet_hour_start` | time | null | Local time after which no messages |
| `quiet_hour_end` | time | null | Local time before which no messages |
| `updated_at` | timestamptz | now() | Last changed |

### 5.2 Default Behavior

- New customers are opted in for WhatsApp (the primary channel).
- SMS and Email are opted out by default (require explicit consent).
- Quiet hours default to 21:00 – 08:00.
- Staff cannot override opt-out; they can ask the customer to opt in.

### 5.3 Opt-Out Handling

1. Every WhatsApp message includes an opt-out instruction.
2. A one-click unsubscribe mechanism via `opt_in_token` (future: URL shortener).
3. Opt-out is respected immediately; the `customer_notification_timeline` records the event as `SKIPPED_OPT_OUT`.

---

## 6. Delivery Lifecycle

```
[Trigger Event] → [Template Interpolation] → [Preference Check]
    → [Deduplication Check] → [Channel Delivery] → [Log Result]
                                                    ↕
                                           [Retry (if failure & transactional)]
```

### 6.1 State Machine

| State | Meaning | Next States |
|---|---|---|
| `QUEUED` | Event created, awaiting processing | `SENT`, `FAILED`, `SKIPPED_PREFERENCE`, `SKIPPED_DUPLICATE` |
| `SENT` | Channel accepted delivery | `DELIVERED`, `FAILED` |
| `DELIVERED` | Confirmed delivered | (terminal) |
| `FAILED` | Delivery atempt failed | `QUEUED` (retry), `FAILED` (exhausted) |
| `SKIPPED_PREFERENCE` | Not sent due to customer preference | (terminal)
| `SKIPPED_DUPLICATE` | Not sent because dupicate was detected | (terminal) |
| `READ` | Recipient opened/read (WhatsApp API only) | (termial) |

### 6.2 Rety Policy

| Category | Max Reries | Backoff | Notes |
|---|---|---|---|
| Transactional (appointment, invoice) | 3 | 5 min, 15 min, 60 min | |
| Optional (loyalty, reards) | 1 | 5 min | Best-effort |
| In-app (toast) | 0 | — | Session-scoped |

---

## 7. Deduplication

### 7.1 Dedup Key

```typescript
`notif_${centerId}_${customerId}_${eventId}_${referenceId}_${channel}`
```

Where `eventId` is the event type (e.g. "appointment_booked"), `referenceId` is the business-object ID (e.g. appointment UUID).

### 7.2 Windw

- Transactional events: 1 hour (same notification not sent again within window).
- Optional events: 24 hours.

### 7.3 Implementation

Deduplication is implemented in the `NotificationService` using an in-memory Set for the current session and the `customer_notification_timeline` table for persistence across sessions.

---

## 8. Scheduling and Quiet Hours

### 8.1 Quiet Hours

| Day | Start | End | Behavior |
|---|---|---|
| All | 21:00 | 08:00 | Non-urgent notifications are suppressed and queued for next-day delivery |
| Urgent exception | — | — | Appointment confirmations/cancellations bypass quiet hours |

### 8.2 Appointent Reminder Scheduling

Reminders are sent `reminder_hours_before` hours before the appointment (configurable in `notification_settings`, default 24).

---

## 9. Rate Limiting

| Channel | Global Limit | Per-Customer Limit | Notes |
|---|---|---|---|
| WhatsApp wa.me | None (manual) | — | Manual send, no rate limit|
| WhatsApp API (future| 250 conversations/24h | 1 conversation/minute | Meta platform limit |
| SMS (future) | 10/second | 1/minute | Carrier limits |
| In-app toast | None | — | Browser-only |
| In-app notification center| None | — | Own database |

---

## 10. Privacy and Security

### 10.1 What Never Appears in Notifications

- API keys, tokens, secrets
- asswords, PINs, reset links
- Full payment card numbers
- Staff salary or payroll information
- Customer government IDs
- Otional: phone numbers in notification center (show masked)

### 10.2 Data Retention

- `customer_notification_timeline`: 90 days (future: cleanup job)
- `ustomer_notification_preferences`: until customer deletion or explicit request

### 10.3 Loogin

- Delivery logs never contain full message content for masked channels.
- Error logs never contain API keys or tokens.
- Log level: `info` for sent/delivered, `warn` for failures, `eror` for provider misconfiguration.

---

## 11. Provider Boundary and Test Mode

### 11.1 Test Mode

When `VITE_ENVIRONMEN` = `development`:
1. All messages are logged but **not actually sent** to external providers.
2. WhatsApp wa.me links are still generated (they open in browser — no server send).
3. A `[TEST MODE]` prefix is prepended to messages.
4. The notification center works normally.

### 11.2 Provider Configuration

| Env Variable | Purpose | Required |
|---|---|---|
| `VITE_WHATSAPP_BUSINESS_PHONE` | WhatsApp Business phone number | No (future) |
| `VITE_WHATSAPP_API_KEY` | WhatsApp Business API key | No (future) |
| `VITE_SM_PROVIDER` | SMS provider (e.g. "twilio") | No (future) |
| `VITE_EMAIL_PROVIDER` | Email provider (e.g. "resend") | No (future) |

No provider env variable is read in this version — all are future-scoped.

---

## 12. Cost Controls

| Channel | Cost | Control |
|---|---|---|
| In-app toast | $0 | — |
| In-app notification center | $0 (DB storage) | Existing Supabase storage |
| WhatsApp wa.me | $0 | — |
| WhatsApp API | Meta per-conversation | Configurable budget alert | 
| SMS | $0.0–0.05/msg | Per-center monthly cap |
| Email | $0.001/msg | Per-center monthly cap |

No cost-bearing channel is enabled without owner approval.

---

## 13. System Architecture
```
┌─────────────────────────────────────────────────┐
│                      Presentation Layer                     │
│  ┌──────────────────┐  ┌───────────────────┐                │
│  │    Toast (staff)  │  │ Notificaton Center │               │
│  └────────┬─────────┘  └────────┬──────────┘                │
│           │                     │                          │
│  ┌────────▼──────────────────────▼───────────┐              │
│  NotificationService (orchestrator)          │             │
│  │  - deduplication check│                     │            │
│  │  - preference check   │                    │             │
│ │  - rate tting          │                     │            │
│  │  - template rendering │                    │             │
│  └────────┬──────────────────────┬───────────┘              │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
┌───────────▼──────────┐  ┌───────▼───────────┐
│  Channel: Toast       │  │ Channel: WhatsApp  │
│  (in-app for staff)   │  │ (wa.me for cust.) │
└───────────────────────┘  └───────────────────┘
            │
┌───────────▼───────────┐
│  Domain Event Triggers   │
│  (appointment, invoice,  │
│   loyalty, etc.)         │
└──────────────────────────┘
```

## 14. Monitoring and Metrics

| Metric | Source | Purpose |
|---|---|---|
| `notification.sent.total` | Delivery log | Volume tracking |
| `notification.delivered.rate` | Delivery log | Health monitoring |
| `notification.failed.total` | Delivery log | Issue detection |
| `notification.duplicates.skipped` | Dedup log | Efficiency |
| `notification.preferences.skipped` | Preference log | Preference compliance |
| `notification.retry.count` | Retry log | Reliability |

All metrics are available through the `getNotificationStats()` method and the notification center admin view.

---

## 15. Test Plan

### 15.1 Unit Tests

1. Template interpolation — all variables replaced correctly
2. Template interpolation — missing variable falls back to placeholder
3. Template validation — rejects unknown variables
4. Template validation — bilingual key parity (both dictionaries have same vars)
5. Deduplication key generation — deterministic for same inputs
6. Dedup check — same dedup key within window returns true
7. Dedup check — different dedup key returns false
8. Preference check — opted-out channel returns false
9. Preference check — quiet hours returns false for non-urgent
10. Preference check — urgent bypasses quiet hours
11. Preference check — no preferences (all default) returns true
12. Rate limiter — within limit returns true
13. Rate limiter — over limit returns false
14. Phone normalization — strips country prefix
15. Build WhatsApp link — valid URL with encoded message

### 15.2 Integration Tests

1. Notification service — orchestrates all channels
2. Dedup across sessions — uses persistence

### 15.3 What We Don't Test (Not Automatable Here)

- Actual message delivery to external providers
- WhatsApp Business API authentication
- SMTP server connectivity
- SMS gateway HTTP endpoints
- Push notification delivery on device