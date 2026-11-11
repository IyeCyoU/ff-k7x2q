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
