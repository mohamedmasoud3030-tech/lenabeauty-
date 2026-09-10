# Free Plan Security Limitations — Lena Beauty

## Leaked Password Protection

Supabase Security Advisor reports **Leaked Password Protection Disabled** for the current project.

This is a **known platform-plan limitation and is NOT a release blocker for the current free-plan Demo/Staging environment**.

Official Supabase documentation states that leaked-password protection (HaveIBeenPwned password checks) is available on the **Pro Plan and above**. The current Lena Beauty project is intentionally running on the Free plan, so this control cannot be enabled without upgrading the Supabase plan.

### Risk treatment

- Status: **Accepted / Non-blocking on Free plan**.
- Scope: current Demo/Staging project and free-plan pilot usage.
- Compensating controls already present:
  - Supabase Auth password hashing (bcrypt).
  - Authenticated-only staff application surface.
  - RLS tenant isolation.
  - Membership checks inside privileged RPCs.
  - Fixed function `search_path`.
  - Least-privilege RPC grants.
  - Anonymous public-table grants removed.
  - Public booking / client-portal RPC grants are **intentionally released** (see "Intentional Anonymous Release" below) and confined to a narrow, parameterized, RLS-governed surface.
- Upgrade action: when the project moves to Supabase Pro or above, enable Leaked Password Protection and re-run Security Advisor.

This advisory must remain visible in security reviews, but **must not by itself prevent merge, Demo/Staging operation, or a controlled pilot while the project remains on the Free plan**.

---

## Intentional Anonymous Release — Public Booking & Client Portal (2026-09)

Migration `20260912110000_public_booking_release.sql` intentionally grants `EXECUTE` on a closed set of RPCs to the `anon` and `authenticated` roles so unauthenticated visitors can book appointments and clients can log into the portal by phone + code. This is a **deliberate, documented release decision**, not an oversight.

### Anon-executable RPCs (9)

| Function | Purpose | Tenant / abuse control |
| --- | --- | --- |
| `public_list_services_v1` | List bookable services for a center | Center membership filter inside function |
| `public_list_staff_v1` | List bookable staff for a center | Center membership filter inside function |
| `public_center_info_v1` | Center name / hours / contact for the booking page | Single-row by center id |
| `public_taken_slots_v1` | Occupied slots for a date (drives greyed-out UI) | Center + date scoped |
| `public_create_booking_v1` | Create a SCHEDULED appointment from the public page | Validates slot vs. taken slots + staff schedule server-side; requires `employee_id` (specialist) via DB trigger |
| `public_cancel_booking_v1` | Cancel own appointment (portal) | Re-verifies phone + token on every call; only own / SCHEDULED-future rows |
| `public_reschedule_booking_v1` | Reschedule own appointment (portal) | Same re-verification + slot availability check |
| `public_client_portal_login_v1` | Exchange phone + rotating token for a portal session | Token never returned by list RPCs; lockout on repeated failures |
| `public_client_portal_profile_v2` | Portal profile: upcoming/past visits, spend | Re-verifies phone + token on every call |

Additional hardening in the same migration: `PUBLIC` role `EXECUTE` revoked on each function; anon grants on public tables and sequences re-asserted as revoked; all functions use fixed `search_path` and SECURITY DEFINER with membership checks.

### Explicitly NOT anon-executable

- `rotate_customer_portal_token_v1` — `authenticated` only. Admins issue/rotate a client's portal code from **Customers → … → Portal Code**; the rotation RPC itself can never be called anonymously.
- All other staff RPCs remain `authenticated`-only with membership checks; frontend entity-delete use cases were removed entirely (only `payroll.deleteRun` remains).

### Frontend surface

- `#/book` (`PublicBookingPage`) and `#/portal` (`ClientPortalPage`) are the **only** routes outside `RequireAuth`, registered in `src/routes.tsx` and enforced as `PUBLIC_ROUTES` in `information-architecture.test.tsx`. They are shared from **Settings → Online Booking** (link + QR) and never appear in staff navigation.
- Client-side slot greying is cosmetic only — the server re-validates availability authoritatively inside `public_create_booking_v1` / `public_reschedule_booking_v1`.
