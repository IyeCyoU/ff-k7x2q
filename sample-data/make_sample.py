#!/usr/bin/env python3
"""Generate a synthetic workbook in the same layout the app imports.

Nothing here is real family data. Use it to try the app, for screenshots and for tests:

    python sample-data/make_sample.py            # writes sample-data/sample-workbook.xlsx
"""
import random
import pathlib
from datetime import date
from openpyxl import Workbook

OUT = pathlib.Path(__file__).parent / "sample-workbook.xlsx"
BROTHERS = ["Yaseer", "Nasir", "Shakir", "Zakir"]
PAYEES = [("Fresh Mart", 900, 4200), ("City Bakery", 150, 900), ("Sunrise Gas Agency", 900, 1100), ("Jio Prepaid", 299, 749),
          ("Green Basket", 300, 2500), ("Ravi Kumar", 2000, 9000), ("Lakshmi Stores", 200, 1800), ("Power Repairs", 500, 3500)]


def build(seed=7):
    rnd = random.Random(seed)
    rows = []  # (date, depositor, type, purpose, description, amount)
    ref = [500000000000]

    def r():
        ref[0] += rnd.randint(11, 999)
        return ref[0]

    def add(d, dep, typ, purpose, desc, amt):
        rows.append((d, dep, typ, purpose, desc, round(amt, 2)))

    months = [(2025, m) for m in range(1, 13)] + [(2026, m) for m in range(1, 4)]
    for i, (y, m) in enumerate(months):
        for b in BROTHERS:
            add(date(y, m, rnd.randint(1, 5)), b, "Deposit", "Family Expenses", f"Upi-{b} Sample-{b.lower()}@upi-{r()}-Monthly Expenses", 10000)
        inv = {"Yaseer": 10000, "Nasir": 10000 if i < 9 else 0, "Shakir": 5000, "Zakir": 10000 if i in (0, 1, 2) else 0}
        for b, v in inv.items():
            if v:
                add(date(y, m, rnd.randint(6, 9)), b, "Deposit", "Investments", f"Upi-{b} Sample-{b.lower()}@upi-{r()}-Investment", v)
        for _ in range(rnd.randint(6, 9)):
            p, lo, hi = rnd.choice(PAYEES)
            add(date(y, m, rnd.randint(2, 28)), "Bapa", "Withdrawal", "Family Expenses", f"Upi-{p}-{p.lower().replace(' ', '')}@upi-Ubin0000001-{r()}-Upi", -rnd.randint(lo, hi))
        if i % 2 == 0:
            add(date(y, m, 15), "Bapa", "Withdrawal", "Medical Expense", f"Upi-Care Pharma-care@upi-Ubin0000002-{r()}-Medicines", -rnd.randint(600, 4000))
        if i in (3, 8):
            add(date(y, m, 18), "Bapa", "Withdrawal", "Medical Expense", f"Upi-Lakeview Hospital-lake@upi-Ubin0000003-{r()}-Consultation", -rnd.randint(8000, 15000))
        if i % 3 == 1:
            add(date(y, m, 20), "Bapa", "Withdrawal", "Family Expenses", f"Atw-412345XXXXXX1234-SAMPLE ATM-{r()}", -3000)
        if i % 3 == 0:
            add(date(y, m, 28), "HDFC", "Deposit", "Bank Charges", "Interest Paid Till Date", round(rnd.uniform(80, 240), 2))
    # special items, transfers, deployment, a duplicate to exercise the review list
    for b in BROTHERS:
        add(date(2025, 3, 30), b, "Deposit", "Additional Expense", f"Upi-{b} Sample-{b.lower()}@upi-{r()}-Donation", 2000)
    add(date(2025, 3, 25), "Bapa", "Withdrawal", "Additional Expense", f"Upi-Community Trust-trust@upi-Ubin0000004-{r()}-Donation", -8000)
    add(date(2025, 6, 10), "Nasir", "Deposit", "Internal Transfer", "Payment From Phone", 3000)
    add(date(2025, 6, 10), "Bapa", "Withdrawal", "Internal Transfer", "Upi-Nasir Sample-nasir@upi-Internal", -3000)
    add(date(2025, 7, 12), "Bapa", "Withdrawal", "Investments", f"Upi-Plot Owner-owner@upi-Ubin0000005-{r()}-House Advance", -50000)
    add(date(2025, 9, 3), "Nasir", "Withdrawal", "Investments", f"Upi-Plot Registrar-reg@upi-Ubin0000005-{r()}-Paid Via Card", -10000)
    dup = f"Upi-Yaseer Sample-yaseer@upi-Sample0000001-{r()}-Monthly Expenses"
    add(date(2025, 11, 23), "Yaseer", "Deposit", "Family Expenses", dup, 10000)
    add(date(2025, 11, 23), "Yaseer", "Deposit", "Family Expenses", dup, 10000)
    rows.sort(key=lambda x: (x[0], x[1]))
    return rows


def write(path=OUT):
    rows = build()
    wb = Workbook()
    ws = wb.active
    ws.title = "Transactions"
    total = round(sum(r[5] for r in rows), 2)
    ws["E1"], ws["F1"] = "Bank Statement Balance", total
    ws.append([]); ws.append([])
    ws.append(["Date", "Depositor", "TransactionType", "Purpose", "Description", "Amount"])
    for row in rows:
        ws.append(list(row))
    last = ws.max_row + 1
    ws.cell(last, 1, "Total")
    ws.cell(last, 6, f"=SUBTOTAL(109,F5:F{last - 1})")
    for row in ws.iter_rows(min_row=5, max_row=last - 1, min_col=1, max_col=1):
        row[0].number_format = "dd-mmm-yyyy"
    wb.save(path)
    return rows, total


if __name__ == "__main__":
    rows, total = write()
    print(f"wrote {OUT}  ({len(rows)} transactions, statement balance {total:,.2f})")
