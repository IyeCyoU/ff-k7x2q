# Family Fund

A private dashboard for a family that pools money every month: household expenses, an investment pool and a long-term housing goal. You import your bank-statement workbook (Excel), and the app builds contribution tracking, fund balances, ownership percentages, a monthly report and a review list on top of it.

It is a **single static HTML file**. There is no server and no account. Your data is read in the browser and stays in that browser.

![Overview](docs/screenshots/overview.png)

<details>
<summary>More screenshots</summary>

![Contribution tracker](docs/screenshots/contributions.png)

![Monthly report](docs/screenshots/report.png)

</details>

All screenshots use the synthetic workbook in `sample-data/`, not real figures.

## What it does

- **Contribution tracking.** Required against paid, per brother, per month, with running outstanding and advance balances. Targets come from a plan with effective-from months, so changing or suspending a contribution never rewrites history. Late, advance and catch-up payments are matched oldest-arrears-first.
- **Separate funds.** Household, investment, special and (optionally) a separate medical fund, each with an opening balance, movements and a closing balance that reconciles to the bank statement.
- **Investment ownership.** Each brother's share follows what he actually contributed. Payouts can be marked *deployed* or *returned to a brother*, which changes ownership only when money is returned.
- **Housing goal.** Progress, required monthly amount, pace against a straight line, projected completion date and a what-if table.
- **Cash ledger.** For money that never touches the bank. ATM withdrawals are itemised instead of counted twice, and entries that look like a bank row are flagged.
- **Categories without touching data.** Bank rows are read-only. Categories, payment modes, medical treatment, notes and category splits are stored as a separate layer that survives re-imports.
- **Controls.** Reconciliation checks, and a review list for duplicates, missing brothers or categories, negative balances, unexplained cash and more. Nothing is ever deleted or changed for you.
- **Monthly report.** On screen, as a PDF, or as text to paste into WhatsApp.

## Quick start

1. Open the app (see *Deploy* below, or open `dist/index.html` after `python build.py`).
2. Choose your workbook. It needs a sheet with these columns in one header row:

   | Date | Depositor | TransactionType | Purpose | Description | Amount |
   |---|---|---|---|---|---|

   - `Depositor` is a brother's name, `Bapa` (the person who spends), or a bank label.
   - `Purpose` drives the treatment: `Family Expenses`, `Investments`, `Medical Expense`, `Additional Expense`, `Internal Transfer`, `Bank Charges`.
   - Deposits are positive, withdrawals negative. A totals row is skipped. A cell next to the text `Bank Statement Balance` in the first rows is used for reconciliation.
3. Review the import summary and confirm.

To try it without real data, generate a synthetic workbook: `python sample-data/make_sample.py`.

## Run it on a PC with no internet

`python build.py --offline` also writes `dist/family-fund-offline.html`, one file with every library inlined. Copy it anywhere, double-click it and it opens in Chrome or Edge. It downloads the two libraries once into `vendor/` (git-ignored) if they are not there yet.

Data is saved in the browser for that file location, so keep the file in one place and use **Setup → Save backup** now and then.

## Privacy

- Nothing is uploaded. The workbook is parsed in the browser and saved in that browser's local storage.
- Use **Setup → Save backup** to keep a copy; use **Restore backup** to move to another device.
- `.gitignore` blocks `*.xlsx`, `*.csv` and backup files so real data is not committed by accident. Only `sample-data/sample-workbook.xlsx` is allowed.
- The app loads SheetJS and jsPDF from cdnjs and fonts from Google Fonts. It falls back to system fonts offline.

## Development

Only Python is needed to build. Node is optional (used for a syntax check if present).

```bash
python build.py                       # bundles src/ into dist/index.html
pip install -r requirements-dev.txt
playwright install chromium
pytest -q                             # end-to-end tests against the sample workbook
python scripts/screenshots.py         # refresh docs/screenshots
```

```
src/
  core.js       constants, formatting, state, workbook import
  engine.js     classification, contributions, funds, goal, exceptions, controls
  charts.js     small SVG chart kit with tooltips
  views1.js     filters, overview, contribution tracker
  views2.js     household, investments, housing goal, monthly report, transactions
  views3.js     cash ledger, controls, setup, edit dialogs
  pdf.js        PDF report
  main.js       navigation, events, import, sorting, backup
  style.css     design tokens and components
  fontdata.js   Roboto subset (rupee sign) for the PDF, see scripts/make_font_subset.py
sample-data/    synthetic workbook generator
tests/          Playwright + pytest end-to-end tests
```

Offline test runs: set `LOCAL_VENDOR` to a folder containing `xlsx/dist/xlsx.full.min.js` and `jspdf/dist/jspdf.umd.min.js` (for example an `npm i xlsx@0.18.5 jspdf@2.5.1` `node_modules`).

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds and publishes `dist/` on every push to `main`.

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The site appears at `https://<user>.github.io/<repo>/`.

Pages sites are public, even when the repository is private, unless your plan supports private Pages. The site contains no data, only the app, but the sidebar shows the brothers' first names. Change them in `src/core.js` (`defaults()`) if that matters. You can also skip Pages and just open `dist/index.html` from a file.

## Known limits

- Brothers' names are fixed in `defaults()`; there is no in-app editor for them yet.
- Data lives in one browser. Multi-device sharing is not built in.
- The PDF and most figures assume Indian rupee formatting.
- Categories are one level deep plus subcategories; a split changes the category of a payment, not its fund.

## Licence

MIT. Third-party notices are in `NOTICE.md`.
