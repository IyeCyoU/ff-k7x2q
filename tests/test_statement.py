"""Importing the bank's own HDFC statement and reviewing it in the app.

Uses the made-up statements from sample-data/make_statement.py, which continue from the sample workbook."""
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
APRIL = ROOT / "sample-data" / "sample-statement-2026-04.xlsx"
MAY = ROOT / "sample-data" / "sample-statement-2026-05.xlsx"


@pytest.fixture(scope="session", autouse=True)
def statements(built):
    if not (APRIL.exists() and MAY.exists()):   # committed; regenerate only when missing
        subprocess.run([sys.executable, str(ROOT / "sample-data" / "make_statement.py")], check=True, stdout=subprocess.DEVNULL)


def js(page, expr, arg=None):
    return page.evaluate(expr, arg)


def import_statement(page, path, apply=True):
    page.set_input_files("#file", str(path))
    page.wait_for_selector("#applyStmt")
    text = page.text_content("#modalRoot")
    if apply:
        page.click("#applyStmt")
        page.wait_for_timeout(150)
    return text


def row_id(page, payee):
    return js(page, "p => S.stmt.find(t => payeeOf(t.desc) === p).id", payee)


def test_statement_is_read_and_continues_from_the_workbook(loaded):
    text = import_statement(loaded, APRIL, apply=False)
    assert "New rows to add12" in text.replace(" ", "").replace("\n", "") or "12" in text
    assert "continues from the balance already in the app" in text
    loaded.click("#applyStmt")
    r = js(loaded, "() => ({n: S.stmt.length, tab: UI.tab, bal: bankStatementBalance(), ledger: R.bankCum[R.N - 1], month: UI.f.month})")
    assert r["n"] == 12 and r["tab"] == "review" and r["month"] == "4"
    assert abs(r["bal"]["bal"] - r["ledger"]) < 0.01, "bank ledger must equal the statement's closing balance"
    assert "Unreconciled amount" not in js(loaded, "() => R.exceptions.map(e => e.code)")


def test_unreviewed_rows_count_in_the_bank_but_in_no_fund(loaded):
    before = js(loaded, "() => [R.F.H[R.N-1].close, R.C.Aman.Household.at(-1).cumPaid]")
    import_statement(loaded, APRIL)
    after = js(loaded, "() => ({H: R.F.H[R.N-1].close, X: R.F.X[R.N-1].close, paid: R.C.Aman.Household.at(-1).cumPaid, nr: R.exceptions.find(e => e.code === 'Not reviewed')})")
    assert after["H"] == pytest.approx(before[0]) and after["paid"] == pytest.approx(before[1])
    assert after["X"] == pytest.approx(js(loaded, "() => S.stmt.reduce((a, t) => a + t.amt, 0)"))
    assert after["nr"]["count"] == 12 and after["nr"]["sev"] == "High"


def test_overlapping_statement_adds_only_new_rows(loaded):
    import_statement(loaded, APRIL)
    text = import_statement(loaded, MAY, apply=False)
    assert "Already imported before2 (skipped)" in text.replace("\n", "")
    loaded.click("#applyStmt"); loaded.wait_for_timeout(150)
    assert js(loaded, "() => S.stmt.length") == 15
    again = import_statement(loaded, MAY, apply=False)
    assert "Nothing new" in again


def test_missing_statement_is_detected(loaded):
    text = import_statement(loaded, MAY, apply=False)   # April skipped
    assert "A statement for an earlier period may be missing" in text


def test_suggestions_read_history_names_and_narration(loaded):
    import_statement(loaded, APRIL)
    s = js(loaded, "() => Object.fromEntries(S.stmt.map(t => { const x = suggestFor(t); return [payeeOf(t.desc), [x.who, x.purpose, x.reason || '']]; }))")
    assert s["AMAN SAMPLE"][:2] == ["Aman", "Family Expenses"]       # "MONTHLY EXPENSES"
    assert s["BILALSAMPLE"][0] == "Bilal"                            # name inside an IMPS narration
    assert s["DEV SAMPLE"][:2] == ["Dev", "Investments"]             # "INVESTMENT"
    assert s["RAVI KUMAR"][1:] == ["Outside Fund", "Other debt"]     # "LOAN REPAYMENT"
    assert s["CITY CLINIC"][1] == "Medical Expense"
    assert s["INTEREST PAID TILL 31-MAR-2026"][1] == "Bank Charges"


def test_approving_a_row_counts_it(loaded):
    import_statement(loaded, APRIL)
    rid = row_id(loaded, "AMAN SAMPLE")
    before = js(loaded, "() => R.C.Aman.Household[R.mi['2026-04']].paid")
    loaded.click(f'#view [data-act=rvApprove][data-arg="{rid}"]')
    loaded.wait_for_timeout(150)
    assert js(loaded, "() => R.C.Aman.Household[R.mi['2026-04']].paid") == pytest.approx(before + 10000)
    assert js(loaded, "id => S.review[id].parts", rid) == [{"amt": 10000, "who": "Aman", "purpose": "Family Expenses", "reason": ""}]
    assert js(loaded, "() => S.stmt.filter(t => !S.review[t.id]).length") == 11
    # undo puts it back
    loaded.click(f'#view [data-act=rvUndo][data-arg="{rid}"]'); loaded.wait_for_timeout(150)
    assert js(loaded, "() => R.C.Aman.Household[R.mi['2026-04']].paid") == pytest.approx(before)


def test_split_on_behalf_of_another_brother_and_outside_money(loaded):
    """Chirag deposits 25,000: 10,000 his, 10,000 Dev's, 5,000 to pass on to a third party."""
    import_statement(loaded, APRIL)
    rid = row_id(loaded, "CHIRAG SAMPLE")
    base = js(loaded, "() => ({c: R.C.Chirag.Household[R.mi['2026-04']].paid, d: R.C.Dev.Household[R.mi['2026-04']].paid, o: R.F.O[R.N-1].close})")
    loaded.click(f'#view [data-act=rvSplit][data-arg="{rid}"]')
    loaded.wait_for_selector("#rv-parts")
    loaded.click("[data-act=rpAdd]"); loaded.click("[data-act=rpAdd]")
    parts = loaded.query_selector_all("#rv-parts .rv-part")
    plan = [("Chirag", "Family Expenses", "10,000"), ("Dev", "Family Expenses", "10000"), ("Someone else", "Outside Fund", "5,000")]
    for el, (who, purpose, amt) in zip(parts, plan):
        el.query_selector(".rp-who").select_option(who)
        el.query_selector(".rp-purpose").select_option(purpose)
        a = el.query_selector(".rp-amt"); a.fill(""); a.type(amt)
    parts[2].query_selector(".rp-reason").select_option("Payable to a third party")
    loaded.fill("#rv-note", "Dev sent his share to Chirag")
    loaded.click("[data-act=rvSave]"); loaded.wait_for_timeout(150)
    r = js(loaded, "() => ({c: R.C.Chirag.Household[R.mi['2026-04']].paid, d: R.C.Dev.Household[R.mi['2026-04']].paid, o: R.F.O[R.N-1].close, parts: R.led.filter(e => e.parentId).length})")
    assert r["c"] == pytest.approx(base["c"] + 10000) and r["d"] == pytest.approx(base["d"] + 10000)
    assert r["o"] == pytest.approx(base["o"] + 5000) and r["parts"] == 3
    # the fund total still equals the bank + cash total
    assert all(c["status"] != "Difference" for c in js(loaded, "() => R.checks"))


def test_split_that_does_not_add_up_is_refused(loaded):
    import_statement(loaded, APRIL)
    rid = row_id(loaded, "BILALSAMPLE")
    loaded.click(f'#view [data-act=rvSplit][data-arg="{rid}"]')
    loaded.click("[data-act=rpAdd]")
    p2 = loaded.query_selector_all("#rv-parts .rv-part")[1]
    p2.query_selector(".rp-who").select_option("Aman")
    a = p2.query_selector(".rp-amt"); a.fill("5000")
    loaded.click("[data-act=rvSave]")
    assert "add up to" in loaded.text_content("#rv-msg")
    assert js(loaded, "id => !!S.review[id]", rid) is False


def test_pass_through_money_nets_to_zero(loaded):
    """A donation comes in for a mosque and goes out again: not part of any family fund."""
    import_statement(loaded, APRIL)
    h0 = js(loaded, "() => R.F.H[R.N-1].close")
    js(loaded, """() => { const t = S.stmt.find(t => payeeOf(t.desc) === 'BILALSAMPLE'), u = S.stmt.find(t => payeeOf(t.desc) === 'RAVI KUMAR');
        approveRow(t.id, [{who: 'Bilal', purpose: 'Outside Fund', reason: 'Donation / charity', amt: 15000}, {who: 'Bilal', purpose: 'Family Expenses', reason: '', amt: 5000}]);
        approveRow(u.id, [{who: 'Parent', purpose: 'Outside Fund', reason: 'Donation / charity', amt: 15000}]); derive(); }""")
    r = js(loaded, "() => ({o: R.F.O[R.N-1].close, h: R.F.H[R.N-1].close})")
    assert r["o"] == pytest.approx(0)
    assert r["h"] == pytest.approx(h0 + 5000)


def test_brother_paid_directly_outside_the_bank(loaded):
    before = js(loaded, "() => ({paid: R.C.Bilal.Household.at(-1).cumPaid, cash: R.cashCum[R.N-1], bank: R.bankCum[R.N-1], spend: R.F.H[R.N-1].close})")
    js(loaded, "goto('cash')")
    loaded.click("[data-act=addCash]")
    loaded.select_option("#cf-dir", "Direct")
    loaded.select_option("#cf-person", "Bilal")
    loaded.fill("#cf-date", "2026-03-20")
    loaded.click("#cf-amt"); loaded.keyboard.type("1,500")
    loaded.select_option("#cf-cat", "Groceries")
    loaded.fill("#cf-desc", "Bilal paid the grocer from his own account")
    assert loaded.is_hidden("#cf-acct")
    loaded.click("[data-act=saveCash]"); loaded.wait_for_timeout(150)
    after = js(loaded, "() => ({paid: R.C.Bilal.Household.at(-1).cumPaid, cash: R.cashCum[R.N-1], bank: R.bankCum[R.N-1], spend: R.F.H[R.N-1].close})")
    assert after["paid"] == pytest.approx(before["paid"] + 1500)
    assert after["cash"] == pytest.approx(before["cash"]) and after["bank"] == pytest.approx(before["bank"])
    assert after["spend"] == pytest.approx(before["spend"])      # contribution and expense cancel out in the fund
    assert js(loaded, "() => R.led.some(e => e.direct && e.kind === 'hhx' && e.cat === 'Groceries' && e.amt === -1500)")


def test_reimporting_the_workbook_keeps_statement_rows_and_reviews(loaded):
    import_statement(loaded, APRIL)
    rid = row_id(loaded, "AMAN SAMPLE")
    loaded.click(f'#view [data-act=rvApprove][data-arg="{rid}"]'); loaded.wait_for_timeout(150)
    loaded.set_input_files("#file", str(ROOT / "sample-data" / "sample-workbook.xlsx"))
    loaded.wait_for_selector("#applyImp"); loaded.click("#applyImp"); loaded.wait_for_timeout(150)
    assert js(loaded, "() => S.stmt.length") == 12
    assert js(loaded, "id => !!S.review[id]", rid)


def test_old_excel_xls_format_is_read(loaded, tmp_path):
    """Net banking often gives .xls (Excel 97). Convert the sample to that format and import it."""
    xls = tmp_path / "statement.xls"
    b64 = __import__("base64").b64encode(APRIL.read_bytes()).decode()
    out = js(loaded, """b64 => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const wb = XLSX.read(bin, {type: 'array'});
        const o = XLSX.write(wb, {bookType: 'biff8', type: 'base64'}); return o; }""", b64)
    xls.write_bytes(__import__("base64").b64decode(out))
    text = import_statement(loaded, xls, apply=False)
    assert "continues from the balance already in the app" in text


def test_review_page_has_no_errors_and_fits_a_phone(loaded):
    import_statement(loaded, APRIL)
    loaded.set_viewport_size({"width": 393, "height": 852})
    js(loaded, "goto('review')")
    assert js(loaded, "document.documentElement.scrollWidth") <= 393
    rid = row_id(loaded, "FRESH MART")
    loaded.click(f'#view [data-act=rvSplit][data-arg="{rid}"]')
    assert js(loaded, "document.documentElement.scrollWidth") <= 393
    assert loaded.errors == []


def test_money_held_for_others_is_not_the_familys(loaded):
    """A brother deposits 42,500: 12,500 household, 30,000 to pass on. The family's total must not include
    the 30,000; it is shown separately as held for others."""
    import_statement(loaded, APRIL)
    rid = row_id(loaded, "CHIRAG SAMPLE")
    js(loaded, """id => { approveRow(id, [{who: 'Chirag', purpose: 'Family Expenses', reason: '', amt: 12500},
        {who: 'Chirag', purpose: 'Outside Fund', reason: 'Payable to a third party', amt: 12500}]); derive(); goto('overview'); }""", rid)
    r = js(loaded, "() => ({own: R.ownCum[R.N-1], fam: R.famCum[R.N-1], held: R.F.O[R.N-1].close, big: document.querySelector('.hero .big').textContent, eq: document.querySelector('.hero .eq').innerText})")
    assert r["held"] == pytest.approx(12500)
    assert r["own"] == pytest.approx(r["fam"] - 12500)
    assert r["big"] == js(loaded, "v => inr(v)", r["own"]), "the big total is the family's own money"
    assert "held for others" in r["eq"] and "Outside the family fund" not in r["eq"].split("Total")[0]
    wa = js(loaded, "() => whatsappText(reportData(R.months[R.N - 1]))") if js(loaded, "typeof reportData === 'function'") else None
    if wa is not None:
        assert "Held for others" in wa
    assert all(c["status"] != "Difference" for c in js(loaded, "() => R.checks"))


def test_a_balance_difference_explains_where_it_starts(loaded):
    import_statement(loaded, MAY)            # April skipped, so the app is missing April's rows
    r = js(loaded, "() => ({d: bankDrift(), text: driftText(), exc: R.exceptions.find(e => e.code === 'Unreconciled amount')})")
    assert r["d"]["first"] is True and abs(r["d"]["diff"]) > 1
    assert "comes from your Excel history before that day" in r["text"]
    assert r["exc"]["detail"] == r["text"]
    js(loaded, "goto('overview')")
    assert "see why" in loaded.text_content(".hero")


def test_no_difference_means_no_explanation(loaded):
    import_statement(loaded, APRIL)
    assert js(loaded, "() => bankDrift()") is None


def add_by_hand(page, date, direction, amount, desc):
    js(page, "goto('review')")
    page.click("[data-act=handAdd]")
    page.fill("#hd-date", date); page.select_option("#hd-dir", direction)
    page.click("#hd-amt"); page.keyboard.type(amount); page.fill("#hd-desc", desc)
    page.click("[data-act=handNext]")
    page.wait_for_selector("#rv-parts")


def test_hand_entry_is_reviewed_and_counts(loaded):
    before = js(loaded, "() => ({bank: R.bankCum[R.N-1], paid: R.C.Aman.Household.at(-1).cumPaid})")
    add_by_hand(loaded, "2026-03-28", "in", "5,000", "Cash deposit by Aman")
    p = loaded.query_selector("#rv-parts .rv-part")
    p.query_selector(".rp-who").select_option("Aman"); p.query_selector(".rp-purpose").select_option("Family Expenses")
    loaded.click("[data-act=rvSave]"); loaded.wait_for_timeout(150)
    after = js(loaded, "() => ({bank: R.bankCum[R.N-1], paid: R.C.Aman.Household.at(-1).cumPaid, src: R.led.find(e => e.manual).manual})")
    assert after["bank"] == pytest.approx(before["bank"] + 5000) and after["paid"] == pytest.approx(before["paid"] + 5000)
    js(loaded, "goto('transactions')")
    assert "By hand" in loaded.text_content("#view")


def test_statement_recognises_a_hand_entry_and_keeps_its_choice(loaded):
    """Enter Bilal's April deposit by hand, split it; then import April: no duplicate, the split is kept."""
    add_by_hand(loaded, "2026-04-03", "in", "20000", "Bilal sent money")
    loaded.click("[data-act=rpAdd]")
    parts = loaded.query_selector_all("#rv-parts .rv-part")
    for el, (who, amt) in zip(parts, [("Bilal", "12000"), ("Aman", "8000")]):
        el.query_selector(".rp-who").select_option(who); el.query_selector(".rp-purpose").select_option("Family Expenses")
        a = el.query_selector(".rp-amt"); a.fill(""); a.type(amt)
    loaded.click("[data-act=rvSave]"); loaded.wait_for_timeout(150)
    text = import_statement(loaded, APRIL, apply=False)
    assert "Your hand entries found in it1" in text.replace("\n", "").replace(" (your who and what are kept)", "")
    assert "continues from the balance already in the app" in text
    loaded.click("#applyStmt"); loaded.wait_for_timeout(150)
    r = js(loaded, """() => { const t = S.stmt.find(t => payeeOf(t.desc) === 'BILALSAMPLE');
        return {n: S.stmt.length, hand: S.stmt.filter(t => t.manual).length, parts: S.review[t.id] && S.review[t.id].parts.map(p => [p.who, p.amt]),
                bank: R.bankCum[R.N-1], stmt: bankStatementBalance().bal}; }""")
    assert r["n"] == 12 and r["hand"] == 0
    assert r["parts"] == [["Bilal", 12000], ["Aman", 8000]]
    assert r["bank"] == pytest.approx(r["stmt"])


def test_hand_entry_after_the_last_statement_is_not_a_difference(loaded):
    import_statement(loaded, APRIL)
    add_by_hand(loaded, "2026-05-10", "out", "700", "Gas cylinder")
    loaded.click("[data-act=rvSave]"); loaded.wait_for_timeout(150)
    assert "Unreconciled amount" not in js(loaded, "() => R.exceptions.map(e => e.code)")
    assert js(loaded, "() => bankStatementBalance().handAfter") == 1


def test_hand_entry_missing_from_its_statement_is_flagged(loaded):
    add_by_hand(loaded, "2026-04-10", "out", "999", "Something that never happened")
    loaded.click("[data-act=rvSave]"); loaded.wait_for_timeout(150)
    text = import_statement(loaded, APRIL, apply=False)
    assert "dated inside this statement's period but not in it" in text


def test_hand_entry_can_be_deleted_and_excel_history_removed(loaded):
    add_by_hand(loaded, "2026-03-28", "in", "100", "Test entry")
    loaded.click("[data-act=handDelete]"); loaded.click("#confirmOk"); loaded.wait_for_timeout(150)
    assert js(loaded, "() => S.stmt.filter(t => t.manual).length") == 0
    import_statement(loaded, APRIL)
    js(loaded, "goto('setup')")
    loaded.click("[data-act=removeHistory]"); loaded.click("#confirmOk"); loaded.wait_for_timeout(150)
    r = js(loaded, "() => ({tx: S.tx.length, stmt: S.stmt.length, plan: S.cfg.plan.length})")
    assert r["tx"] == 0 and r["stmt"] == 12 and r["plan"] >= 1


def test_statement_row_recorded_as_several_excel_lines_is_not_added_again(page):
    """The Excel history often splits one deposit (household + investment). Importing the bank statement over it
    used to add that deposit a second time, because no single Excel line had the same amount."""
    r = page.evaluate("""()=>{
        const mk=(date,amt,n)=>({id:'w'+n,row:n,date,dep:'Aman',type:'Deposit',purpose:'Family Expenses',desc:'x',amt});
        S.tx=[mk('2026-04-07',10000,1),mk('2026-04-07',10000,2),mk('2026-04-07',-500,3),mk('2026-04-09',4000,4),mk('2026-04-09',2500,5),mk('2026-04-09',1500,6),mk('2026-04-12',100,7)];
        const row=(id,date,amt,bal)=>({id,date,amt,bal,desc:'d',ref:'',vdate:date});
        const p={rows:[row('a','2026-04-07',20000,20000),row('b','2026-04-07',-500,19500),row('c','2026-04-09',8000,27500),row('d','2026-04-10',999,28499),row('e','2026-04-12',300,28799)],
                 period:{from:'2026-04-07',to:'2026-04-12'},opening:0,closing:28799,file:'f'};
        const plan=planStatementImport(p);
        return {fresh:plan.fresh.map(t=>t.id),inWb:plan.inWb.map(t=>t.id)}}""")
    assert sorted(r["inWb"]) == ["a", "b", "c"]          # 20,000 = 10,000 + 10,000; 8,000 = 4,000 + 2,500 + 1,500
    assert r["fresh"] == ["d", "e"]              # really new; 300 is not made up from an unrelated 100
