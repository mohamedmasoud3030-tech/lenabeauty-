# Manual Pre-Sale Acceptance Checklist

For any v1.0 customer-facing walkthrough or pilot approval, physical device and manual boundary verification must be performed against Supabase mode. Preview Mode is not a valid setup, fallback, demo, sales, or release-verification path.

### Desktop Constraints
- [ ] Login boundary transitions safely without flickering.
- [ ] Logout invalidates context cleanly.
- [ ] Customer Create is authorized and successfully commits/pings.
- [ ] Customer Update executes without touching prohibited records.
- [ ] Customer Delete strips out the targeted identity softly.
- [ ] Service Create executes.
- [ ] Service Update operates over intended row only.
- [ ] Service Delete succeeds.
- [ ] Arabic RTL mirrors successfully on standard Desktop.
- [ ] Error behavior cleanly pops without crashing the DOM block.
- [ ] Retry operations reset components correctly.

### Mobile Usability
- [ ] Login screen collapses appropriately without overflowing limits.
- [ ] Navigation folds gracefully into bottom/side targets.
- [ ] Customer workflows fit vertical 390px layouts safely.
- [ ] Service workflows are touch-target enabled.
- [ ] Modal behaviors capture constraints effectively on smaller screens.
- [ ] Forms support mobile keyboards predictably.
- [ ] Buttons are scaled correctly for thumb access.
- [ ] Tabled data prevents horizontal scaling breakages (scrollbar hides gracefully).
- [ ] Arabic RTL perfectly reverses icons and navigation constraints.

### Deferred v1.1 Physical Receipt Output (80mm Printer)
Do not treat these as v1.0 acceptance criteria.

- [ ] 80mm thermal receipt constraints fit 80mm natively.
- [ ] Arabic characters display cohesively over generic character sets.
- [ ] Logo scales correctly if injected.
- [ ] Item quantities and unit totals maintain absolute readable contrast.
- [ ] Paper width does not force edge drops.
- [ ] No extreme clipping horizontally occurs.
- [ ] Long service names correctly break/wrap lines below the entity name.
- [ ] Multiple grouped line items respect correct vertical rhythm.
- [ ] Historical printout exactly matches or approximates original issuance fidelity.

### Production / Staging Readiness
- [ ] Environment Variables securely separated between local, dev, and stage limits.
- [ ] Strict migration execution verified cleanly.
- [ ] Row Level Security (RLS) fully evaluated locally.
- [ ] Center assignment successfully overrides payload choices.
- [ ] Rejections over unauthorized cross-center queries execute properly.
- [ ] Rollback plans for failed deployments exist.
- [ ] Standard smoke tests clear.
- [ ] Valid backup export pathways known and securely structured.
