# LENA Beauty — First Customer Launch Pack

Status: canonical operator contract for the first production salon.

This pack starts after Round 4. It is not another cleanup round. Its purpose is to move one salon from an empty isolated tenant to the first real paid checkout without bypassing database, RLS, RPC, accounting, or authentication controls.

## 1. Provision the production tenant

- Use an isolated production center/tenant. Never convert the shared demo center into the customer's permanent production tenant.
- Apply the repository's canonical Supabase migrations in order and require the database contract/audit gates to pass.
- Create the owner/admin identity through the supported authentication path; do not insert auth identities directly into application tables.
- Confirm the authenticated owner resolves to the intended `center_id` before entering operational data.
- Keep public booking/portal RPCs deny-by-default unless that channel is intentionally released with its abuse controls.

Before deploying the customer build, configure its production environment and run:

```bash
npm run launch:preflight
```

The preflight fails closed unless the target is explicitly `production`, uses Supabase in single-center mode, has a real center UUID, contains no privileged `VITE_*` credential, and points to a project other than the known Lena Demo project.

Exit gate: production preflight passes, and the owner can sign in and access only the intended center.

## 2. Configure salon identity

In Settings → Center Profile:

- salon/business name
- phone
- address
- commercial registration, when applicable
- postal code
- currency = OMR for the Oman launch
- VAT/tax rate as supplied by the salon

In Settings → Branding:

- logo
- Arabic/English display names where used
- approved brand colors
- invoice/report footer and registration/tax identity where applicable

Exit gate: a newly rendered invoice/report carries the customer's identity, not demo identity.

## 3. Create owner and staff operating access

An `employees` record is an operational staff record; it is not an authentication account. Login access requires an Auth user plus server-governed profile, center membership, and `app_metadata.role`.

1. Create the Auth user in Supabase Authentication and copy its UUID.
2. Generate the reviewed membership SQL locally; the helper never accepts or prints a password/service-role key:

```bash
npm run launch:membership -- \
  --user-id <AUTH_USER_UUID> \
  --center-id <CENTER_UUID> \
  --role STAFF \
  --name "Staff Full Name"
```

3. Review the generated SQL and run it only in a trusted Supabase SQL/admin context.
4. Sign the user out/in so the fresh server-owned role reaches the Auth token.
5. Test one staff login separately from the owner login and verify admin-only routes remain unavailable.

Supported launch roles are `ADMIN`, `MANAGER`, and `STAFF`. Assign the minimum role required. Never expose service-role credentials to the browser and never add a client RPC that grants memberships.

Exit gate: owner and at least one real operator can sign in with the intended permissions.

## 4. Load opening operational data

Load only data required to operate day one:

1. active services, prices, duration, and categories
2. active employees and service assignment/schedule data required by booking
3. sellable products and truthful opening stock quantities/costs
4. existing customers needed for already-booked visits
5. future appointments that must survive the cutover
6. gift cards/packages only when the salon has real outstanding customer liabilities/entitlements to carry forward

Do not fabricate historical invoices to make dashboards look populated. Financial history is created through canonical checkout flows.

The existing `GettingStartedCard` remains the staff-facing onboarding path for services → employees → customers → appointments → sale. Settings → Go-Live is the separate production-certification view; it must not become a duplicate onboarding implementation.

Exit gate: the salon can create a valid appointment and POS catalog contains the intended opening services/products.

## 5. Backup and recovery truth

Settings → Data Export produces a complete tenant-scoped operational JSON export for the tables covered by the repository adapter. The adapter pages large tables and fails the export if a covered source fails.

The repository contains an internal restore adapter for non-financial operational entities, but the product UI intentionally does not advertise a self-service restore. Invoices are intentionally excluded from adapter restore because financial records must only be created through the guarded checkout authority.

Therefore production recovery is:

- before go-live: take a fresh operational JSON export and record its timestamp
- database disaster recovery: use the managed Supabase/Postgres backup/PITR procedure available for the production project; validate that capability for the chosen production plan before accepting real transactions
- operational import/restore: execute only as a controlled operator procedure after validating the payload and target tenant; never present it to salon staff as a full financial database restore
- never overwrite a live tenant merely to test restore

Exit gate: there is a dated pre-go-live export plus a documented production database recovery owner/procedure.

## 6. Golden go-live rehearsal

Run the exact production path with non-financial rehearsal data before opening:

Login → Customer → Appointment → Visit → POS → Checkout rehearsal boundary → Inventory → Customer history → Reports → Action Center.

For the final checkout rehearsal, do not create a fake paid transaction in the production ledger unless it is explicitly designated as the salon's real first sale. Use automated tests/demo environment for destructive checkout rehearsal.

Exit gate: no route error, no permission error, no missing catalog dependency, and no inventory/accounting contract failure.

## 7. First real sale

At the first genuine customer visit:

1. open/create the customer
2. open the real appointment/visit when applicable
3. add the delivered services/products in POS
4. select the real payment method and any legitimate package/gift-card entitlement
5. verify totals and tax before confirmation
6. confirm checkout once; never retry blindly after a network interruption
7. render/print the receipt
8. confirm the invoice appears in customer history/reports
9. confirm consumed inventory moved exactly once
10. check Action Center for any new operational exception

The Settings → Go-Live activation milestone derives first-sale evidence from the canonical Sales report, which reads tenant-scoped invoices filtered to `status = PAID`. It deliberately does not trust an imported `customer.totalSpent` value as proof of a production checkout.

Exit gate: one real PAID invoice exists, receipt is correct, customer history is correct, reporting includes the sale, and inventory/accounting side effects occurred once.

## 8. Go-live sign-off

The salon is LIVE only when all boxes are true:

- [ ] isolated production tenant
- [ ] `npm run launch:preflight` passes
- [ ] canonical migrations/audit green
- [ ] owner/admin login verified
- [ ] staff login and role boundary verified
- [ ] center profile completed
- [ ] branding completed
- [ ] services/prices/durations loaded
- [ ] employees required for day one loaded
- [ ] opening inventory verified physically
- [ ] required customers/future appointments loaded
- [ ] outstanding gift cards/packages reconciled if applicable
- [ ] pre-go-live operational export saved
- [ ] managed database recovery procedure confirmed
- [ ] golden workflow rehearsed
- [ ] first real checkout verified end-to-end from a PAID invoice

## Non-negotiable launch rules

- No demo database as the permanent customer production database.
- No direct financial inserts or manual invoice fabrication.
- No disabling RLS/RPC/auth controls to make onboarding easier.
- No destructive restore test against the live tenant.
- No claim that JSON export is a full financial/database backup.
- No browser-side membership grants or privileged credentials.
- No second customer is onboarded from an undocumented one-off process: improvements discovered during customer one must be folded back into this pack.
