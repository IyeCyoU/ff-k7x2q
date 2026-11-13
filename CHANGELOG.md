# Changelog

## 1.6.2
- Category and subcategory are two separate boxes everywhere a bank transaction is categorised: the transaction window, the quick boxes in the Transactions table, the review window for statement and hand entries, Categorise payees and Setup → Payee rules. The subcategory box lists only the subcategories of the category chosen beside it, is switched off when that category has none, and is cleared when the category changes. (1.6.0 offered one long list of every `Category › Subcategory` pair.)
- Categorise payees: choose the category, optionally its subcategory, then Save.
- Review window: a subcategory can now be set on a statement or hand entry.

## 1.6.1
- The "A new version is ready" message is removed. It could come back on every visit: the app page was already the new version (it is always loaded from the website first), but the offline copy only switched after a question and a reload, and on phones where that switch did not complete the question was asked again each time. Now the offline copy switches to a new release by itself, with no question and no reload.
- An app left open across a release refreshes itself once, the next time you return to it and nothing is being typed or edited. At most one refresh per release.

## 1.6.0
- Subcategories everywhere a category is chosen for a bank transaction: the transaction window, payee rules in Setup and Categorise payees offer `Category › Subcategory`. Rules can carry a subcategory. Transactions show it and search finds it.
- Your own category names are respected: if Medical or Bank Charges were renamed (for example "Medical & Healthcare"), medical and bank-charge rows use that name instead of a built-in one.
- Cash ledger → Paid directly by a brother has **Counts as his**: household or investment contribution. Use it when a brother pays a family bill himself and it should be credited to his investment share.
- Overview, Household and Investments show what the spending funds (household, medical, special) owe the investment fund, the household contributions still outstanding, and the equal top-up per brother that clears the rest.
- Investment outstanding is measured on net investment: money returned to a brother is taken off what he has paid in, so his outstanding rises by that amount.
- Fixed: importing a bank statement over an Excel history added a bank row again when the Excel sheet had recorded it as several lines (a deposit split between household and investment). Lines of the same day that add up to the bank row now count as the same money.
- Fixed: entries paid directly by a brother were listed in Controls as "Manual bank entry not yet in the statement". They never go through the bank.

## 1.5.1
- Entering transactions by hand, one after another: the review window of a hand entry has **Approve and add another** (the next one starts on the same date and direction), and **Add transaction** is on Overview and Transactions as well as To review. Before, after the first entry you were left on Overview with no way to add the next; on a phone the only button was under More → To review.
- The hand-entry form has **It was cash instead**, which opens the cash entry form.
- A hand entry can be corrected after it is posted: open it (Transactions or To review) → **Edit date, amount or description**. It stays the same entry; who and what for are kept unless the direction changes or the amount of a split entry changes. Rows from a bank statement stay read-only, as they are the bank's record.
- Date boxes (hand entry and cash entry) are plain text: type or paste `5/4/2026`, `05-04-26`, `5 Apr 2026`, `2026-04-05`, `today`. Day first. Impossible dates are refused. A small calendar button sits beside the box.

## 1.5.0
- Start without the Excel workbook. The app used to stay on the start screen until a workbook was imported, even after a bank statement or hand entries had been added (or after Remove your Excel history). It now opens as soon as there is anything: a statement, a hand entry or a cash entry. The start screen offers all of these.
- Print button on Overview, Contributions, Household, Investments and Housing goal (Ctrl+P works too). The print layout drops the sidebar, filters and buttons, always uses light colours, fits tables to the paper, keeps panels from splitting across pages and adds a top line: page, period, date printed, version.

## 1.4.2
- Setup → Categories: saving the list now warns, naming them, before any category is removed (the box replaces the whole list, so typing one new category used to delete all the others silently). New button: Bring back the default categories (adds the missing defaults, keeps your own).
- After an edit the page no longer glides from the top back to where you were: the app's own scroll corrections are instant.

## 1.4.1
- Updates no longer nag: a waiting update is applied by itself when the app is opened or comes back to the screen; only an update that arrives while you are using the app asks first. Reload always reloads (some phones never announce the switch), with a guard against reload loops.
- "What's new" is a small note that goes away by itself, with a button for the details, instead of a window to close.
- Removed an index.html and sw.js from another app that had been uploaded to the top level by mistake; a test now fails if unexpected files appear there.

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
