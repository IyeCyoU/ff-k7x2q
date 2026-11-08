# Changelog

## 1.4.0
- **Add a transaction by hand** on To review: date, in/out, amount, description, then who and what for (with splits), in the same dialog as statement rows. Marked "By hand" in Transactions; can be deleted.
- Importing a statement **recognises hand entries** (same amount, within 5 days): the bank row replaces the hand entry and keeps its who/what and split. A hand entry dated inside the statement's period but not in it is flagged.
- Hand entries dated after the latest statement do not count as a difference from the bank balance.
- **Setup → Remove Excel history**: drops the rows imported from the workbook and keeps statements, hand entries, approvals, cash ledger, plan, categories and family members.

## 1.3.1
- The family fund position no longer includes money held for others (Outside the family fund); it is shown on its own line under the total, and in the monthly report, WhatsApp text and PDF.
- "Differs from statement" explains itself: the app finds the first day its bank balance and the bank's disagree, and says whether the gap comes from the Excel history before the first statement or from a day inside it.

## 1.3.0
- **Import the bank's own statement** (HDFC net banking Excel, .xls or .xlsx). The running balance and the bank's own summary are checked; rows already imported, or already in your Excel history, are skipped; a statement that does not continue from the app's balance (a missing month) is flagged.
- **To review**: every bank row waits for your approval of *who* and *what for*. Suggestions come from your history, brothers' names and the narration's remark ("MONTHLY EXPENSES", "INVESTMENT", "LOAN REPAYMENT"…). Until approved a row is in the bank balance but in no brother's contribution and no fund.
- **Split** one bank row into parts, each with its own brother, purpose, category and amount; the parts must add up.
- **Outside the family fund**: money that passes through for others (payable to a third party, donation / charity, other debt). Shown as money held for others until it goes out again.
- **Paid directly by a brother** in the cash ledger: his contribution and the expense at once; the family's cash and bank do not change.
- The bank balance check uses the latest statement's closing balance automatically.

## 1.2.1
- **Erase everything** removes everything the app saved in the browser and restarts it fresh. It used to reset the data but leave the page's searches and filters behind, and did not say that Setup returns to its starting values.
- **Setup → Family members**: set the brothers' names, the person who spends and the bank labels. Renaming updates plan lines and cash entries.
- No real names anywhere in the code, the public site, the sample workbook, the README or the screenshots: everything public uses made-up names. A test fails if a real name is ever added.
- The version is shown in the sidebar and in Setup, and a "what's new" note appears once after each update.

## 1.2.0
- Installs on a phone's Home Screen and opens without internet; shows "A new version is ready" after an update.
- SheetJS and jsPDF are bundled with the app (pinned, fingerprint-checked) instead of loaded from a CDN.
- Strict security policy: the page cannot send anything to any server.
- Backups can have a password (AES-256 encryption). Older backups still restore.
- Money boxes accept 10,000, 1,00,000 (lakh) and ₹ amounts, and no longer change on mouse-wheel scroll.
- The cursor stays where you were after an edit, and open sections stay open.
- Phone: the Filters pop-up stays on screen and above the cards; notifications no longer block taps.
- Source recovered from the 1.1.0 build; tests, whole-app check and Pages publishing run on every change.

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
