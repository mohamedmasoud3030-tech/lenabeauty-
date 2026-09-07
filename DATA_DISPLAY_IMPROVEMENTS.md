# DATA_DISPLAY_IMPROVEMENTS

| Page | Current | Verdict | Improved | Why |
|---|---|---|---|---|
| Dashboard tiles | Stat cards | Keep | Larger labels | 8px fails reading |
| Dashboard today | List | Keep | Keep | Sequential today’s book |
| Dashboard alerts | Two card lists | Merge | One exceptions list | Duplicate low stock |
| Dashboard revenue | Area chart | Keep if `canViewRevenue` else hide | Permission-true | Charts only when they inform |
| Appointments | Day/week schedule | Keep | Keep | Time is the meaning |
| POS catalog | Cards | Keep | Keep | Independent add |
| POS cart | List | Keep | Keep | Sequential lines |
| Customers desktop | Table `py-8` | Improve density | Operational table | Compare spend/loyalty |
| Customers mobile | List + menu | Keep | One search | Find, then passport |
| Services/Inventory | Table / 2-col cards | Keep | 44px toggles | Compare vs browse |
| Expenses | Table / cards | Improve density | Same patterns, denser, 3dp OMR | Cost comparison |
| Gift cards / packages | Cards + form | Keep | Labels | Independent instruments |
| Reports | Tabs + charts/tables | Keep | Keep | Period comparison |
| Action Center | Card lists | Keep | Keep | Actionable exceptions |
| Settings | Key-value form | Keep | RTL chevron | Single record |

**Table on phone:** never shrink columns unusable. Existing table→card transform is correct (customers, services, inventory, expenses, employees).

**List rules reused:** ListState for loading/error/empty; search client-side on already loaded rows; no bulk actions (none in product); item actions stay on the row.
