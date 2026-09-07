# FORM_IMPROVEMENT_STANDARD

Apply on shared patterns; do not fork a new form library.

## Rules
1. Visible `<label>` (not placeholder-only).
2. Requiredness from copy + validation, not a red star system.
3. Control matches data: text, `inputMode` decimal/numeric/tel/email, select, checkbox, date.
4. 44×44 actions; 16px inputs under 640px (already global CSS).
5. Inline field error next to the field; toast for server failure.
6. Keep values after failed save.
7. Disable submit while in-flight (`checkingOut`, `saving`).
8. `confirmCloseMessage` on dirty Modal forms.
9. OMR via `formatOMRAmount` (3 dp). Never `toFixed(2)`.
10. Logical CSS (`start`/`end`); `dir="ltr"` only on phone/email/code.
11. Autocomplete: login email/password already set. Do not fake autocomplete on money fields.
12. No `window.prompt` / `window.alert` / `window.confirm` in product UI (`ConfirmDialog` / `Modal` only).

## This round
| Form | Change |
|---|---|
| POS starting-from price | Replace prompt with Modal; min = catalog starting price |
| Gift card sell | Labels, min-h-11, focus ring, expiry label |
| Package create | Visible labels on name/price/description |
| Expenses add/edit | Keep Modal footer save; denser page around it |
| Service/product/employee/customer/settings | Keep; 44px toggles only |

## Explicit non-goals
No new fields. No extra validation theatre. No schema change.
