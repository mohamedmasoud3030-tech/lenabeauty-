# Admin Support & Operations Specification — LenaBeauty

**Version:** 1.0  
**Date:** 2026-08-20  
**Status:** Approved for repository-side implementation; no production-data activation.

---

## 1. Design Principles

1. **Least privilege** — Every admin capability is individually gated by server-side
   `has_center_role`. No capability is granted because a user is "admin" broadly.
2. **Investigation first, action second** — Read-only investigation tools are the
   foundation. Destructive, financial, or data-modifying actions require confirmation
   + reason capture + immutable audit event.
3. **No impersonation** — The system never lets an admin "act as" another user.
   Every audit event records the real actor.
4. **No hardcoded backdoors** — All privileged access goes through the same auth
   middleware and RLS as regular access. There are no hidden routes, no secret
   keys, no bypass parameters.
5. **Manager gets read-only investigation; Admin gets full support** — MANAGER role
   can view records and audit trail but cannot perform privileged actions.
6. **Reason capture** — Every high-impact action (deactivate employee, void invoice,
   force-cancel appointment) requires the admin to enter a written reason. The
   reason is stored in the audit trail.

---

## 2. Role / Capability Matrix

| Capability | ADMIN | MANAGER | STAFF |
|---|---|---|---|
| View customer records | ✅ Full | ✅ Read-only | ✅ Read-only |
| View employee records | ✅ Full (incl. salary) | ✅ No salary | ✅ No salary |
| View invoices | ✅ Full | ✅ Full | ✅ Own |
| View appointments | ✅ All centers | ✅ Own center | ✅ Own center |
| Search records globally | ✅ Full | ✅ Customer/Invoice | ❌ |
| View audit trail | ✅ Full | ✅ Center-scoped | ❌ |
| Add support notes | ✅ | ❌ | ❌ |
| Manage employees (CRUD) | ✅ | ❌ | ❌ |
| Deactivate employee | ✅ (reason + confirm) | ❌ | ❌ |
| Void invoice | ✅ (reason + confirm) | ❌ | ❌ |
| Force-cancel appointment | ✅ (reason + confirm) | ❌ | ❌ |
| View compensation data | ✅ Full | ❌ | ❌ |
| Export investigation data | ✅ JSON | ❌ | ❌ |
| Manage center settings | ✅ | ❌ | ❌ |
| View notification history | ✅ | ❌ | ❌ |

**Key:** MANAGER sees the same operational data as STAFF plus customer/invoice search
and audit trail — but never compensation, never destructive actions.

---

## 3. Workflows

### 3.1 Record Investigation

```
[Staff reports issue] → [Admin opens Support Operations]
  → Search by customer name / phone / invoice serial / appointment ID
  → View full record detail with activity timeline
  → (Optional) View related audit events
  → Resolve by taking appropriate action or adding support note
```

### 3.2 High-Impact Action (e.g., Deactivate Employee)

```
[Admin clicks Deactivate]
  → Confirm dialog: "Deactivate [employee name]?"
    [×] This employee has [N] pending advances
    [×] This action cannot be undone via UI (contact support for reversal)
  → Reason: [_______] (required, min 10 chars)
  → [Cancel] [Confirm & Deactivate]
  → On confirm: Server-side RPC validates ADMIN role, deactivates, writes audit
  → Toast: "Employee deactivated"
  → Audit event: { actor, action: "employee_deactivate", target, reason, timestamp }
```

### 3.3 Support Note

```
[Admin on customer detail view]
  → "Notes" section shows existing support notes
  → "Add note" button → inline textarea
  → Save → RPC writes support_note with actor_id + center_id + customer_id
  → Note appears immutably in timeline (append-only)
```

---

## 4. Risk Controls

| Control | Implementation | Where |
|---|---|---|
| Server-side authorization | `has_center_role(center_id, ARRAY['ADMIN'])` | DB RPC |
| Reason capture | Required field (min 10 chars) for deactivate/void/cancel | UI + RPC |
| Confirmation dialog | `ConfirmDialog` pattern before every high-impact action | UI |
| Audit trail | Immutable `admin_audit_events` table, append-only | DB |
| No hard delete | Employee deletion converts to deactivation (`is_active = false`) | DB |
| Bulk limits | All operations are single-record; no bulk | Architecture |
| Partial-failure recovery | All RPCs are transactional | DB |
| Idempotency | Actions carry client-generated idempotency key | Future |

---

## 5. Audit Trail

### 5.1 Table: `admin_audit_events`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `center_id` | UUID FK → centers | Tenant scope |
| `actor_id` | UUID | The admin who performed the action |
| `actor_name` | TEXT | Denormalized for trail readability |
| `action` | TEXT | Machine-readable action name |
| `target_type` | TEXT | "employee" | "customer" | "invoice" | "appointment" |
| `target_id` | UUID | ID of the affected record |
| `target_summary` | TEXT | Human-readable summary (e.g. "Employee: Sara") |
| `reason` | TEXT | Admin's stated reason (required for high-impact actions) |
| `details` | JSONB | Action-specific payload (before/after snapshots) |
| `created_at` | TIMESTAMPTZ | Immutable timestamp |

### 5.2 Event Action Types

| Action | Target Type | Details |
|---|---|---|
| `employee_deactivate` | employee | `{ was_active: true }` |
| `employee_reactivate` | employee | `{ was_active: false }` |
| `employee_update` | employee | `{ changed_fields: ["salary"], before: {...}, after: {...} }` |
| `invoice_void` | invoice | `{ serial: "INV-001", total: 15.500 }` |
| `appointment_force_cancel` | appointment | `{ date: "...", customer: "..." }` |
| `support_note_added` | customer | `{ note_preview: "..." }` |
| `customer_data_export` | customer | `{ record_count: 1 }` |
| `center_setting_changed` | center | `{ changed_fields: [...] }` |

### 5.3 Immutability

- `admin_audit_events` has RLS policy: `INSERT` allowed for authenticated (via RPC),
  `SELECT` allowed for center members, `UPDATE`/`DELETE` denied for all roles.
- Audit events are written server-side within the SECURITY DEFINER RPC — clients
  cannot write directly to the table.

---

## 6. Support Notes

### 6.1 Table: `customer_support_notes`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID FK → centers | |
| `customer_id` | UUID FK → customers | |
| `actor_id` | UUID FK → auth.users | The admin who wrote the note |
| `note` | TEXT | Note content |
| `created_at` | TIMESTAMPTZ | Immutable |

Append-only: notes are never edited or deleted. If correction needed, add a new
note referencing the earlier one.

---

## 7. UX States

Every investigation surface must handle:

| State | Handling |
|---|---|
| **Loading** | Skeleton loader matching list/card shape |
| **Empty** | "No records found" with contextual message |
| **Error** | Error message with Retry button; surface hides rather than fabricates data |
| **Not found** | "No customer found with that ID/phone" |
| **Restricted** | "You do not have permission to view this data" — only shown when auth check fails server-side |
| **Success** | Data rendered with appropriate accessibility attributes |

---

## 8. Sensitive Field Masking

| Field | ADMIN | MANAGER/STAFF |
|---|---|---|
| Employee salary | ✅ Visible | ❌ Not returned (RPC strips salary fields) |
| Employee phone | ✅ Visible | ✅ Visible |
| Customer phone | ✅ Visible | ✅ Masked: `+968*****00` |
| Invoice total | ✅ Visible | ✅ Visible |
| Compensation data | ✅ Visible | ❌ Not returned |
| Audit actor name | ✅ Visible | ✅ Visible |

---

## 9. Data Flow

```
[UI] → [useCases.support.*] → [Supabase RPC] → [has_center_role check]
    → [Action] → [Write audit event (SECURITY DEFINER)] → [Return result]
```

All support RPCs:
- Accept `p_center_id UUID` as first parameter
- Validate `has_center_role(p_center_id, ARRAY['ADMIN'])` for write actions
- Validate `is_center_member(p_center_id)` for read-only investigation
- Write an `admin_audit_events` row for every high-impact action
- Use `SECURITY DEFINER` with pinned `search_path`
- Return `JSONB` for typed frontend consumption

---

## 10. Test Plan

### 10.1 Authorization Tests

1. STAFF user cannot access any admin support route — redirected to dashboard
2. MANAGER user can access investigation page but sees restricted data
3. ADMIN user sees full data and action buttons
4. Direct API call to employee list without ADMIN role returns error
5. Direct API call to audit trail without membership returns error

### 10.2 Investigation Tests

6. Search by customer name returns matching records
7. Search by phone returns customer + related invoices
8. Search by non-existent ID returns empty state
9. View audit trail for a center shows chronological events
10. View audit trail for non-member center returns error

### 10.3 Action Tests

11. Deactivate employee with reason succeeds (ADMIN only)
12. Deactivate employee without reason fails validation
13. Deactivate employee as MANAGER returns authorization error
14. Reactivate employee follows same pattern
15. Add support note to customer persists and is visible
16. Add support note as STAFF returns authorization error

### 10.4 Audit Tests

17. Every deactivation creates an `admin_audit_events` row
18. Audit event contains correct actor, action, reason
19. Audit event is immutable (UPDATE/DELETE denied)
20. Audit trail pagination works (max 50 per page)