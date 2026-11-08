#!/usr/bin/env python3
"""Generate made-up HDFC-style bank statements (the Excel layout net banking gives) for tests and trying
the app. Every name, address, number and amount is invented. They continue from sample-workbook.xlsx.

    python sample-data/make_statement.py   # writes sample-data/sample-statement-2026-04.xlsx and -2026-05.xlsx
"""
import pathlib
from datetime import date
from openpyxl import Workbook, load_workbook

HERE = pathlib.Path(__file__).parent
STAR = "*" * 40


def opening_balance():
    """The sample workbook's closing balance, so the statements continue from it."""
    ws = load_workbook(HERE / "sample-workbook.xlsx").active
    for row in ws.iter_rows(values_only=True):
        for i, c in enumerate(row):
            if isinstance(c, str) and "bank statement balance" in c.lower():
                return next(x for x in row[i + 1:] if isinstance(x, (int, float)))
    raise SystemExit("run make_sample.py first")


def write(path, start, end, rows, opening):
    wb = Workbook(); ws = wb.active; ws.title = "Sheet 1"
    head = [
        ["HDFC BANK Ltd.", None, "Page No .:   1", None, "Statement of accounts"],
        [], [], [],
        [None, None, None, None, "Account Branch :SAMPLE BRANCH"],
        ["MR      AMAN SAMPLE", None, None, None, "Address :12 SAMPLE STREET"],
        ["12 SAMPLE STREET", None, None, None, "City :SAMPLETOWN 000000"],
        ["SAMPLETOWN", None, None, None, "State :SAMPLE STATE"],
        [".", None, None, None, "Phone no. :0000000000"],
        ["SAMPLE STATE 000000", None, None, None, "Email :sample@example.com"],
        ["JOINT HOLDERS :", None, None, None, "OD Limit :0.00   Currency :INR"],
        [None, None, None, None, "Cust ID :000000000"],
        ["Nomination  :  Registered", None, None, None, "Account No :0000XXXX0000   OTHER"],
        [f"Statement From  :  {start:%d/%m/%Y}         To  :  {end:%d/%m/%Y}", None, None, None, "A/C Open Date :01/01/2025"],
        [None, None, None, None, "Account Status :Regular"],
        [None, None, None, None, "RTGS/NEFT IFSC :SAMP0000000   MICR :000000000"],
        [],
        ["*" * 120],
        ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
        ["********", STAR, "************", "********", "*" * 18, "*" * 18, "*" * 18],
    ]
    for r in head:
        ws.append(r)
    bal, deb, cred = opening, 0.0, 0.0
    for d, narr, ref, wd, dep in rows:
        bal = round(bal - wd + dep, 2); deb += wd; cred += dep
        ws.append([f"{d:%d/%m/%y}", narr, ref, f"{d:%d/%m/%y}", wd or None, dep or None, bal])
    ws.append(["********", STAR, "************", "********", "*" * 18, "*" * 18, "*" * 18])
    ws.append([])
    ws.append(["STATEMENT SUMMARY  :-"])
    ws.append(["Opening Balance", None, "Dr Count", "Cr Count", "Debits", "Credits", "Closing Bal"])
    ws.append([opening, None, sum(1 for r in rows if r[3]), sum(1 for r in rows if r[4]), round(deb, 2), round(cred, 2), bal])
    ws.append(["Generated On: 01/06/2026 10:00:00 ... This is a computer generated statement"])
    wb.save(path)
    return bal


def main():
    ref = [5000000000000000]

    def r():
        ref[0] += 7919
        return f"{ref[0]:016d}"

    april = [
        (date(2026, 4, 2), f"UPI-AMAN SAMPLE-aman.sample@okbank-SAMP0000001-{r()[-12:]}-MONTHLY EXPENSES", r(), 0, 10000),
        (date(2026, 4, 2), f"IMPS-{r()[-12:]}-BILALSAMPLE-E231-SAMP-XXXXXXXXXXX0001-IMPS", r(), 0, 20000),
        (date(2026, 4, 3), f"UPI-CHIRAG SAMPLE-chirag@okbank-SAMP0000002-{r()[-12:]}-MONTHLY", r(), 0, 25000),
        (date(2026, 4, 4), f"UPI-FRESH MART-freshmart@okbank-SAMP0000003-{r()[-12:]}-PAID VIA APP", r(), 3240, 0),
        (date(2026, 4, 6), f"UPI-SAMPLE FILLING ST-PAYTM.S2F1M28@PTY-SAMP0000004-{r()[-12:]}-PAID VIA APP", r(), 2000, 0),
        (date(2026, 4, 9), f"ATW-512345XXXXXX0001-S1AW0001-SAMPLETOWN", r(), 5000, 0),
        (date(2026, 4, 12), f"UPI-SUNRISE GAS AGENCY-sunrise@okbank-SAMP0000005-{r()[-12:]}-GAS", r(), 1050, 0),
        (date(2026, 4, 15), f"UPI-RAVI KUMAR-ravi.k@okbank-SAMP0000006-{r()[-12:]}-LOAN REPAYMENT", r(), 15000, 0),
        (date(2026, 4, 20), f"UPI-CITY CLINIC-cityclinic@okbank-SAMP0000007-{r()[-12:]}-CONSULTATION", r(), 1200, 0),
        (date(2026, 4, 28), "INTEREST PAID TILL 31-MAR-2026", r(), 0, 182.4),
        (date(2026, 4, 29), f"UPI-DEV SAMPLE-dev@okbank-SAMP0000008-{r()[-12:]}-INVESTMENT", r(), 0, 10000),
        (date(2026, 4, 30), f"UPI-LAKSHMI STORES-lakshmi@okbank-SAMP0000009-{r()[-12:]}-PROVISIONS", r(), 2875.5, 0),
    ]
    may = [
        (date(2026, 5, 2), f"UPI-AMAN SAMPLE-aman.sample@okbank-SAMP0000001-{r()[-12:]}-MONTHLY EXPENSES", r(), 0, 10000),
        (date(2026, 5, 3), f"UPI-FRESH MART-freshmart@okbank-SAMP0000003-{r()[-12:]}-PAID VIA APP", r(), 2980, 0),
        (date(2026, 5, 7), f"UPI-JIO PREPAID-jio@okbank-SAMP0000010-{r()[-12:]}-RECHARGE", r(), 749, 0),
    ]
    op = round(opening_balance(), 2)
    end_april = write(HERE / "sample-statement-2026-04.xlsx", date(2026, 4, 1), date(2026, 4, 30), april, op)
    # May's file repeats the last two April rows, as a statement downloaded with an overlap would
    overlap = april[-2:]
    start_may = round(end_april - sum(-w + d for _, _, _, w, d in overlap), 2)
    write(HERE / "sample-statement-2026-05.xlsx", date(2026, 4, 29), date(2026, 5, 31), overlap + may, start_may)
    print("wrote sample-statement-2026-04.xlsx and sample-statement-2026-05.xlsx (made-up data)")


if __name__ == "__main__":
    main()
