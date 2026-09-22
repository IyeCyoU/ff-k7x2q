# Changelog

## 1.1.0
- Redesigned filter bar: Year and Month stay visible; Brother, Contribution type, Expense category, Payment mode and Transaction type collapse into a "Filters" button with an active-count badge.
- Inline quick-edit: Category and Mode can be changed directly in the Transactions table, no dialog needed, for the common case.
- Denser layout: tighter page width and spacing, adaptive KPI card grid.
- Fixed a table bug where description text could wrap onto many lines and blow up row height; descriptions are now single-line with the full text on hover.
- Redesigned mobile navigation: a bottom tab bar (Overview, Contributions, Report, Transactions, More) and a small top header, replacing the horizontal scrolling tab strip.
- `python build.py --offline` builds a single standalone file that works with no internet.

## 1.0.0
First complete release.

- Import the Transactions sheet from an Excel workbook, with an import review (new, removed, unchanged rows; totals against the statement balance).
- Contribution plan with effective-from months; FIFO handling of late, advance and catch-up payments; suspend and restart.
- Household, investment, special and (optional) separate medical funds with month-by-month roll-forward.
- Investment ownership from actual contributions; treatment of payouts as deployed or returned.
- Housing goal tracker with pace, projection and sensitivity table.
- Cash ledger with ATM itemisation to avoid double counting; duplicate-of-bank warnings.
- Category layer on top of untouched bank rows: payee rules, per-row categories, category splits.
- Controls and exception review; nothing is ever deleted or edited automatically.
- Sortable tables, chart tooltips, filters, dark mode and phone layout.
- Monthly report on screen, as a PDF (with the rupee sign) and as WhatsApp text.
