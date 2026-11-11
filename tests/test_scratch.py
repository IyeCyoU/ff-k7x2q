"""Starting without the Excel workbook: from a bank statement, a hand entry or a cash entry.
Before 1.5.0 the app stayed on the start screen until a workbook was imported, even with statement rows saved."""
from conftest import ROOT, SAMPLE

APRIL = ROOT / "sample-data" / "sample-statement-2026-04.xlsx"
PAGES = ("overview", "contributions", "household", "investments", "goal", "review", "report", "transactions", "cash", "controls", "setup")


def all_pages_draw(page):
    for tab in PAGES:
        page.evaluate("t=>goto(t)", tab)
        assert not page.query_selector("#view .empty #drop, #view #drop"), tab + " still shows the start screen"
        assert "could not be drawn" not in page.inner_text("#view"), tab
    assert page.errors == []


def test_start_screen_offers_every_way_in(page):
    for act in ("pickFile", "handAdd", "addCash"):
        assert page.query_selector("#view [data-act=%s]" % act), act


def test_start_from_scratch_with_a_hand_entry(page):
    page.click("#view [data-act=handAdd]")
    page.fill("#hd-date", "2026-04-01"); page.fill("#hd-amt", "50,000"); page.fill("#hd-desc", "Opening balance")
    page.select_option("#hd-dir", "in")
    page.click("#modalRoot .btn.primary")
    page.wait_for_selector("#modalRoot [data-modal]")
    page.evaluate("closeModal()")
    assert page.evaluate("S.stmt.length") == 1
    all_pages_draw(page)


def test_start_from_a_bank_statement_only(page):
    page.set_input_files("#file", str(APRIL))
    page.click("#applyStmt")
    page.wait_for_selector("#view .rv-payee")
    assert page.evaluate("S.tx.length") == 0 and page.evaluate("S.stmt.length") > 0
    all_pages_draw(page)


def test_start_with_a_cash_entry(page):
    page.click("#view [data-act=addCash]")
    page.fill("#cf-date", "2026-04-02"); page.fill("#cf-amt", "1200")
    page.evaluate("()=>{const s=document.querySelector('#cf-dir');s.value='Payment';s.dispatchEvent(new Event('change',{bubbles:true}))}")
    page.select_option("#cf-cat", index=1)
    page.fill("#cf-desc", "Milk and vegetables")
    page.click("#modalRoot [data-act=saveCash]")
    page.wait_for_timeout(300)
    assert page.evaluate("S.cash.length") == 1, page.inner_text("#modalRoot")
    page.evaluate("closeModal()")
    all_pages_draw(page)


def test_removing_the_excel_history_keeps_the_app_usable(page):
    page.set_input_files("#file", str(SAMPLE)); page.click("#applyImp"); page.wait_for_selector(".hero")
    page.set_input_files("#file", str(APRIL)); page.click("#applyStmt"); page.wait_for_selector("#view .rv-payee")
    page.evaluate("()=>STMT_ACTIONS.removeHistory()")
    page.click("#modalRoot .btn.danger, #modalRoot .btn.primary")
    assert page.evaluate("S.tx.length") == 0
    all_pages_draw(page)


def test_second_transaction_is_one_tap_away(page):
    """After the first hand entry there must be an obvious way to add the next one (1.5.0 left you on Overview with none)."""
    page.set_viewport_size({"width": 390, "height": 800})       # a phone: To review is hidden under More there
    page.click("#view [data-act=handAdd]")
    page.fill("#hd-date", "2026-04-01"); page.fill("#hd-amt", "50000"); page.fill("#hd-desc", "Opening balance")
    page.click("[data-act=handNext]")
    page.select_option("#modalRoot .rp-who", index=1)
    page.click("#modalRoot [data-act=rvSave][data-arg=more]")     # Approve and add another
    page.wait_for_selector("#hd-amt")
    assert page.input_value("#hd-date") == "01/04/2026"           # carries the date on, for entering a run of them
    page.select_option("#hd-dir", "out"); page.fill("#hd-amt", "1,250"); page.fill("#hd-desc", "Electricity bill")
    page.click("[data-act=handNext]")
    page.select_option("#modalRoot .rp-who", index=1)
    page.click("#modalRoot [data-act=rvSave]:not([data-arg])")
    assert page.evaluate("S.stmt.length") == 2 and page.evaluate("Object.keys(S.review).length") == 2
    assert abs(page.evaluate("R.bankCum[R.N-1]") - 48750) < 0.01
    assert not page.query_selector("#modalRoot [data-modal]")
    for tab in ("overview", "transactions", "review"):            # and a button on the pages you land on
        page.evaluate("t=>goto(t)", tab)
        assert page.query_selector("#view .vh [data-act=handAdd]"), tab
    page.click("#view .vh [data-act=handAdd]")
    page.click("#modalRoot [data-act=addCash]")                   # wrong form? switch to a cash entry
    assert page.query_selector("#cf-amt")
    assert page.errors == []


def hand(page, date, amt, desc, direction="in", more=False):
    page.fill("#hd-date", date); page.fill("#hd-amt", amt); page.fill("#hd-desc", desc); page.select_option("#hd-dir", direction)
    page.click("[data-act=handNext]")
    page.select_option("#modalRoot .rp-who", index=1)
    page.click("#modalRoot [data-act=rvSave][data-arg=more]" if more else "#modalRoot [data-act=rvSave]:not([data-arg])")


def test_date_box_takes_typing_and_pasting(page):
    cases = {"5/4/2026": "2026-04-05", "05-04-26": "2026-04-05", "5.4.2026": "2026-04-05", "5 Apr 2026": "2026-04-05", "05-Apr-2026": "2026-04-05",
             "5th April 2026": "2026-04-05", "Apr 5, 2026": "2026-04-05", "2026-04-05": "2026-04-05", "  05/04/2026 ": "2026-04-05",
             "31/02/2026": None, "13/13/2026": None, "hello": None, "": None}
    got = page.evaluate("c=>Object.fromEntries(Object.keys(c).map(k=>[k,parseTypedDate(k)]))", cases)
    assert got == cases
    page.click("#view [data-act=handAdd]")
    assert page.get_attribute("#hd-date", "type") == "text"       # a plain box: paste works, no three-part picker to fight
    page.fill("#hd-date", "5 apr 2026"); page.press("#hd-date", "Tab")
    assert page.input_value("#hd-date") == "05/04/2026"            # tidied when you leave the box
    page.fill("#hd-date", "31/02/2026"); page.fill("#hd-amt", "100"); page.fill("#hd-desc", "x")
    page.click("[data-act=handNext]")
    assert "day/month/year" in page.inner_text("#hd-msg") and page.evaluate("S.stmt.length") == 0
    page.evaluate("()=>{const p=document.querySelector('.dpick');p.value='2026-04-09';p.dispatchEvent(new Event('change',{bubbles:true}))}")
    assert page.input_value("#hd-date") == "09/04/2026"            # the small calendar still works
    assert page.errors == []


def test_a_posted_hand_entry_can_be_edited(page):
    page.click("#view [data-act=handAdd]")
    hand(page, "01/04/2026", "50000", "Opening balance")
    tid = page.evaluate("S.stmt[0].id")
    # reach it the way a user does: Transactions -> the row -> Edit
    page.evaluate("goto('transactions')")
    page.click("#txBody tbody tr")
    page.click("#modalRoot [data-act=handEdit]")
    assert page.input_value("#hd-date") == "01/04/2026" and page.input_value("#hd-amt") == "50000" and page.input_value("#hd-desc") == "Opening balance"
    page.fill("#hd-date", "28/03/2026"); page.fill("#hd-amt", "52,500"); page.fill("#hd-desc", "Opening balance (corrected)")
    page.click("[data-act=handNext]")
    r = page.evaluate("()=>({n:S.stmt.length,t:S.stmt[0],rv:S.review[S.stmt[0].id],bank:R.bankCum[R.N-1],first:R.months[0]})")
    assert r["n"] == 1 and r["t"]["id"] == tid                     # same entry, not a second one
    assert r["t"]["date"] == "2026-03-28" and r["t"]["amt"] == 52500 and r["t"]["desc"] == "Opening balance (corrected)"
    assert r["rv"] and r["rv"]["parts"][0]["amt"] == 52500         # who / what for kept
    assert abs(r["bank"] - 52500) < 0.01 and r["first"] == "2026-03"
    assert not page.query_selector("#modalRoot [data-modal]")
    # turning money in into money out: the old choice no longer fits, so it asks again
    page.click("#txBody tbody tr"); page.click("#modalRoot [data-act=handEdit]")
    page.select_option("#hd-dir", "out"); page.click("[data-act=handNext]")
    page.wait_for_selector("#rv-parts")
    assert page.evaluate("id=>!S.review[id]", tid) and page.evaluate("S.stmt[0].amt") == -52500
    assert page.errors == []


def test_bank_statement_rows_cannot_be_edited(page):
    page.set_input_files("#file", str(APRIL)); page.click("#applyStmt"); page.wait_for_selector("#view .rv-payee")
    page.evaluate("()=>reviewDialog(S.stmt.find(t=>!t.manual).id)")
    assert not page.query_selector("#modalRoot [data-act=handEdit]")
    page.evaluate("()=>STMT_ACTIONS.handEdit({dataset:{arg:S.stmt.find(t=>!t.manual).id}})")
    assert not page.query_selector("#hd-amt")
