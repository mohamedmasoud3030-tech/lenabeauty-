# LenaBeauty — Production Readiness & Security Hardening

**Branch:** `arena/019fee12-lenabeauty`  
**Environment verified:** current Lena Supabase project, still demo/staging data only.

## Live findings and fixes

The hardening migration `20260810000005_security_hardening_auth.sql` was applied successfully to the current demo/staging database. Live verification then found an inherited-grant defect that source-only tests had missed: revoking EXECUTE from `PUBLIC` does **not** revoke grants previously given explicitly to `anon` or `authenticated` by older migrations.

That meant dormant public booking/client-portal SECURITY DEFINER RPCs were still executable by `authenticated`, contrary to the original report. The defect was fixed by the additive repair migration `20260810000006_security_grant_repair.sql`.

The repair:

- revokes all existing function EXECUTE grants from `PUBLIC`, `anon`, and `authenticated` in `public` and `app_private`;
- hardens future default function privileges;
- re-grants only eleven exact staff-UI RPC signatures to `authenticated`;
- leaves all public booking/client-portal RPCs with zero `anon`/`authenticated` EXECUTE grants until the customer-booking phase;
- leaves the legacy seven-argument `process_checkout_v1` overload ungranted; the shipped UI uses the current eight-argument overload;
- leaves `add_customer_notification_event_v1` ungranted because no shipped client call uses it;
- grants only the policy helpers required by authenticated RLS/storage evaluation.

## Verified security defects closed

1. **Cross-tenant storage access** — `center-assets` policies now require the first object-path segment to identify a center of which the caller is a member.
2. **Cross-center reference injection** — review, service-file, notification-event, and AI-lead routines validate referenced entities against `p_center_id`.
3. **Portal credential disclosure** — `public_client_portal_profile_v2` returns a curated projection and does not echo `portal_access_token` or lockout counters.
4. **Mutable routine search paths** — all application SQL/plpgsql routines are fixed to `pg_catalog, public, app_private` (or a narrower safe path where explicitly defined).
5. **Anonymous table access** — `anon` has zero table grants in `public`.
6. **Inherited function grants** — repaired by `20260810000006`; dormant public booking/client-portal routines now have zero client-role EXECUTE grants.
7. **Legacy checkout overload exposure** — seven-argument checkout is no longer executable by client roles; only the eight-argument version used by the UI is granted.
8. **`center_settings` deletion** — authenticated policies are SELECT/INSERT/UPDATE only; no DELETE policy exists.

## Live PostgreSQL evidence

Live checks against the demo/staging database confirmed:

- own-center RLS row visible: `1`;
- other-center customer visible: `0`;
- other center visible: `0`;
- cross-center INSERT rejected;
- cross-center checkout rejected;
- cross-center customer-review reference rejected;
- cross-center service-file reference rejected;
- storage SELECT/INSERT/UPDATE policies are center-member scoped;
- `anon` public table grants: `0`;
- public booking/client-portal RPCs: `anon=false`, `authenticated=false`;
- eight-argument checkout: `authenticated=true`, `anon=false`;
- seven-argument checkout: `authenticated=false`, `anon=false`;
- unused `add_customer_notification_event_v1`: no client-role EXECUTE grant.

The original behavioral SQL test also contained managed-Supabase compatibility defects discovered during live execution: it wrote the generated `auth.users.confirmed_at` column, inspected an INSERT policy through `qual` instead of `with_check`, called an overloaded checkout ambiguously, and passed an integer where the RPC requires `smallint`. These were repaired in `supabase/tests/20260810000005_security_hardening.sql` with stable auth fixtures and exact RPC casts.

## SECURITY DEFINER surface after repair

Exactly eleven shipped staff-UI SECURITY DEFINER RPC signatures remain executable by `authenticated`:

- `process_checkout_v1(..., jsonb, text)` — current eight-argument overload only
- `upsert_notification_settings_v1`
- `upsert_payment_gateway_settings_v1`
- `mark_appointment_no_show_v1`
- `issue_gift_card_v1`
- `create_service_package_v1`
- `rotate_customer_portal_token_v1`
- `create_customer_review_v1`
- `create_service_file_v1`
- `create_accounting_journal_entry_v1`
- `create_ai_booking_lead_v1`

Live inspection confirms every one is `SECURITY DEFINER`, has an immutable `search_path=pg_catalog, public, app_private`, and contains a server-side `is_center_member` authorization check. Supabase Advisor therefore continues to warn about these eleven by design; they are intentional privileged business-operation RPCs, not unresolved accidental exposure.

Reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Supabase Security Advisor — current live state

Resolved:

- mutable function search paths;
- public booking/client-portal authenticated exposure;
- legacy seven-argument checkout exposure;
- storage extension placement issue from the preceding release.

Intentional warnings remaining:

- eleven authenticated SECURITY DEFINER staff RPCs documented above.

Real operational warning remaining:

- **Leaked Password Protection is still disabled.** Managed Supabase does not expose `auth.config` in this project, so the guarded SQL block in `00005` could not enable it. It must be enabled through Supabase Auth settings / Management API. Do not describe this setting as fixed until the live Advisor warning disappears.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Environment separation

`VITE_ENVIRONMENT` explicitly distinguishes development/staging/production. Demo seeds stay outside migrations. Production bootstrap must contain no demo users, services, or transactions. A separate production data environment has not been created by this phase.

## Verification inherited from the branch

Arena reported, before the live corrections above:

- typecheck: pass;
- full Vitest suite: 397/397 pass;
- production build: pass;
- npm audit: 0 vulnerabilities.

The live corrections after that report are SQL acceptance/regression-test changes plus the additive grant-repair migration. They still require the branch's normal CI/test gate before merge.

## Remaining blockers

1. Enable **Leaked Password Protection** in managed Supabase Auth and verify the Advisor warning disappears.
2. Run the branch's final typecheck/full-test/build gates on the updated HEAD.
3. Perform final browser acceptance with operator credentials when browser access is available.

## Recommendation

**NOT YET READY FOR PRODUCTION PILOT.**

The database security defects found in live verification are now closed on demo/staging, but the Auth leaked-password protection setting is still disabled and the updated PR HEAD needs its final CI/test gate. PR #19 must remain unmerged until those conditions are closed.
