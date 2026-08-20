# Onboarding & Activation Plan — LenaBeauty

**Version:** 1.0
**Date:** 2026-08-20
**Model:** Progressive, self-retiring setup guide (no tour, no modal spam)

---

## 1. Journey Map

```
[First visit]
    |
    v
[Login page] ──→ [Dashboard / First-run]
    |                    |
    |                    v
    |           [Welcome header: "Welcome"]
    |                    |
    |           [GettingStartedCard: 5 steps]
    |                    |
    |            ┌───────┴───────┐
    |            v               v
    |      [Admin adds     [Staff sees
    |       services]      "ask admin"]
    |            |               |
    |            v               v
    |      [Employees]     [Customers]
    |            |               |
    |            v               v
    |      [Appointment]   [First sale]
    |            |               |
    |            v               v
    |      [🎉 Setup complete!]
    |            |
    |            v
    |      [Dashboard / returning user]
    |            |
    |            v
    |      [Welcome header: "Welcome back"]
    |            |
    v            v
[Recovery: password reset, expired session → login → return to destination]
```

## 2. Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| **No landing page** | Login page IS the landing | Staff-only app; public cannot register or browse |
| **No signup** | Accounts created by admin only | No public sign-up route exists in the product; saying so on login prevents confusion |
| **No tour/modals** | Self-retiring `GettingStartedCard` | Non-intrusive, dismissable, data-driven |
| **No demo data** | Real empty states only | Fabricated data would mislead; empty state = "add your first" |
| **No measurement beyond localStorage** | `activation/events.ts` — anonymous, no PII | No marketing tracking, no names/emails |
| **First value** | Creating the first service + customer + booking a real appointment | The center cannot operate without services |
| **Post-setup celebration** | Single `WelcomeCompleted` card | Positive feedback that auto-dismisses after 7 days or first sale |

## 3. Activation Events (Anonymous, Local Only)

| Event | When | Purpose |
|---|---|---|
| `guide_shown` | GettingStartedCard renders | Know onboarding was presented |
| `guide_dismissed` | User clicks X on card | Know user declined guided setup |
| `first_service_created` | After first service is saved | Track first value created |
| `center_fully_setup` | All 5 steps complete | Know setup is done |
| `first_value_reached` | (existing) center has data | Measure activation completion |

## 4. Acceptance Criteria

1. **First visit**: user sees login with product description, no credentials yet
2. **Login error**: clear error message, no redirect
3. **Post-login (empty center)**: Dashboard with "Welcome" + GettingStartedCard + 4 metric cards.
   No operational panels (Today's Appointments, Alerts, Chart, Activity, Quick Actions)
4. **Post-login (center with data)**: "Welcome back" + metrics + operational panels
5. **Setup guide → step 1**: Click leads to /services
6. **Staff role**: "Employees" step shows "ask admin" text, not a link
7. **Guide completion**: After all 5 steps done, card disappears
8. **Post-setup**: `WelcomeCompleted` card shows for 7 days or first sale
9. **Return visit (no setup)**: Same as first visit, guide still visible
10. **Return visit (setup done)**: Dashboard with full panels
11. **Session expiry**: Redirect to login, return to original destination
12. **Mobile**: Dashboard metrics 2-column, touch targets ≥ 44px, RTL correct
13. **Reset password**: Flow survives tab close → new tab with link works

## 5. Success Signals

| Signal | Measurement | Target |
|---|---|---|
| Guide seen | `guide_shown` event | 100% of first-time users |
| First service created | `first_service_created` event | Within first session |
| All 5 steps completed | `center_fully_setup` event | Within first week |
| Return visit rate | `hasCenterData` → "Welcome back" | >50% after setup |
| Guide dismissed | `guide_dismissed` event | <20% before completing step 2 |

## 6. Revised First-Run Dashboard Behavior

| Panel | First Run (no data) | Returning (has data) |
|---|---|---|
| Welcome header | "Welcome" + "Start with service menu" | "Welcome back" |
| GettingStartedCard | ✅ Visible | ❌ Hidden (done) |
| WelcomeCompleted | ❌ Hidden | ✅ If newly completed, shows 7 days |
| 4 Metric cards (Revenue, Appts, Customers, Low Stock) | ✅ Dimmed (show zeros) | ✅ Full data |
| Today's Appointments | ❌ Hidden | ✅ Visible |
| Operational Alerts | ❌ Hidden | ✅ Visible |
| 7-Day Revenue chart | ❌ Hidden | ✅ Visible |
| Financial Summary | ❌ Hidden | ✅ Visible |
| Activity Feed | ❌ Hidden | ✅ Visible |
| Quick Actions | ❌ Hidden | ✅ Visible |
| NavigationNotice | ✅ After redirect | ✅ After redirect |

## 7. Post-Setup Completion Card

After the GettingStartedCard retires (all 5 steps complete), a `WelcomeCompleted` card appears for 7 days or until the first sale:

- "🎉 Your center is set up!"
- "You're ready to run daily operations from the Dashboard, POS, and Appointments screens."
- CTA: "Record your first sale" → /POS
- Dismisses forever on click or after 7 days