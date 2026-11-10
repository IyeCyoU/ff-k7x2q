"""End-to-end checks against the synthetic sample workbook (no real data in this repo)."""
import pytest

STATEMENT_CHECKS = ("bank statement", "fund balances add up", "tracker match", "required")


def js(page, expr, arg=None):
    return page.evaluate(expr, arg) if arg is not None else page.evaluate(expr)


def test_import_reconciles_to_statement(loaded):
    r = js(loaded, "()=>({n:S.tx.length,bad:S.bad.length,skipped:S.meta.totalsSkipped,stmt:S.meta.statementBalance,bank:R.bankCum[R.N-1],fam:R.famCum[R.N-1]})")
    assert r["n"] > 200 and r["bad"] == 0 and r["skipped"] == 1
    assert abs(r["bank"] - r["stmt"]) < 0.01
    checks = js(loaded, "()=>R.checks.map(c=>[c.name.toLowerCase(),c.status])")
    for name, status in checks:
        if any(k in name for k in STATEMENT_CHECKS):
            assert status == "Reconciled", name


def test_fund_balances_add_to_family_position(loaded):
    d = js(loaded, "()=>{const l=R.N-1;return ['H','I','S','M','X'].reduce((a,f)=>a+R.F[f][l].close,0)-R.famCum[l]}")
    assert abs(d) < 0.01


def test_ownership_adds_to_100_percent(loaded):
    pcts = js(loaded, "()=>ownership(R.N-1).rows.map(r=>r.pct)")
    assert abs(sum(pcts) - 1) < 1e-9


def test_returned_withdrawal_lowers_ownership(loaded):
    before = js(loaded, "()=>ownership(R.N-1).rows.find(r=>r.b==='Bilal').pct")
    js(loaded, "()=>{const e=R.led.find(x=>x.kind==='invd'&&x.person==='Bilal');S.overlay[e.id]={inv:'Returned to brother'};refresh();}")
    after = js(loaded, "()=>ownership(R.N-1).rows.find(r=>r.b==='Bilal').pct")
    assert after < before


def test_contribution_plan_suspension(loaded):
    js(loaded, "()=>{S.cfg.plan.push({id:'x',from:'2026-02',brother:'All',type:'Investment',amount:0,status:'Suspended'});refresh();}")
    req = js(loaded, "()=>S.cfg.brothers.map(b=>R.C[b].Investment[R.N-1].req)")
    assert req == [0, 0, 0, 0]
    earlier = js(loaded, "()=>R.C.Aman.Investment[R.mi['2026-01']].req")
    assert earlier == 10000  # history keeps the target that applied then


def test_duplicate_rows_are_flagged_not_removed(loaded):
    codes = js(loaded, "()=>R.exceptions.map(e=>e.code)")
    assert "Duplicate possibility" in codes
    n = js(loaded, "()=>S.tx.filter(t=>t.date==='2025-11-23'&&t.dep==='Aman'&&t.purpose==='Family Expenses').length")
    assert n == 2


def test_split_keeps_totals_and_survives(loaded):
    base = js(loaded, "()=>[R.famCum[R.N-1],R.F.H[R.N-1].close]")
    tid, amt = js(loaded, "()=>{const e=R.led.filter(x=>x.kind==='hhx'&&!x.atm).sort((a,b)=>a.amt-b.amt)[0];return [e.id,-e.amt]}")
    a = round(amt * 0.4, 2)
    js(loaded, "([id,a,b])=>{S.overlay[id]={split:[{cat:'Groceries',amt:a},{cat:'Repairs',amt:b}]};refresh();}", [tid, a, round(amt - a, 2)])
    assert js(loaded, "()=>[R.famCum[R.N-1],R.F.H[R.N-1].close]") == pytest.approx(base)
    assert js(loaded, "(id)=>R.led.filter(e=>e.parentId===id).length", tid) == 2
    js(loaded, "(id)=>{S.overlay[id]={split:[{cat:'Groceries',amt:1},{cat:'Repairs',amt:1}]};refresh();}", tid)
    assert "Split mismatch" in js(loaded, "()=>R.exceptions.map(e=>e.code)")


def test_cash_ledger_and_atm_itemisation(loaded):
    js(loaded, """()=>{S.cash.push({id:'c1',date:'2026-03-30',dir:'Receipt',by:'Parent',person:'Dev',mode:'Cash',acct:'Cash',cls:'Household',cat:'',sub:'',med:'',src:'Cash in hand',desc:'Cash to Parent',amt:5000,ref:'',note:''},
      {id:'c2',date:'2026-03-31',dir:'Payment',by:'Parent',person:'',mode:'Cash',acct:'Cash',cls:'Household',cat:'Groceries',sub:'',med:'',src:'Cash in hand',desc:'Vegetables',amt:1200,ref:'',note:''},
      {id:'c3',date:'2026-03-31',dir:'Payment',by:'Parent',person:'',mode:'Cash',acct:'Cash',cls:'Household',cat:'Groceries',sub:'',med:'',src:'ATM cash (already booked)',desc:'From ATM cash',amt:2000,ref:'',note:''}); refresh();}""")
    r = js(loaded, "()=>({cash:R.cashCum[R.N-1],atm:atmStats()})")
    assert r["cash"] == pytest.approx(3800)          # 5000 in, 1200 out; ATM item is memo only
    assert r["atm"]["memo"] == pytest.approx(2000)


def test_sorting_covers_every_page(loaded):
    loaded.click('#nav button[data-arg="transactions"]')
    loaded.select_option("#f-year", "All")
    loaded.wait_for_selector("tr.click")
    top = lambda: loaded.evaluate("()=>document.querySelector('#txBody tbody tr td:nth-child(8)').textContent")
    biggest = js(loaded, "()=>Math.max(...sel([]).map(e=>e.amt))")
    loaded.click('#txBody th:has-text("Amount")')
    assert float(top().replace("₹", "").replace(",", "")) == pytest.approx(biggest)


def test_saving_categories_persists(loaded):
    loaded.click('#nav button[data-arg="setup"]')
    loaded.fill("#cat-t", loaded.input_value("#cat-t") + "\nPets: Food, Vet")
    loaded.click('[data-act="saveCats"]')
    loaded.reload()
    loaded.wait_for_selector("#nav")
    assert js(loaded, "()=>S.cfg.categories['Pets']") == ["Food", "Vet"]


def test_report_pdf_is_generated(loaded):
    n = js(loaded, "()=>{const b=makeReportPDF(reportData(R.months[R.N-1]));const h=new Uint8Array(b).slice(0,4);return [b.byteLength,String.fromCharCode(...h)]}")
    assert n[1] == "%PDF" and n[0] > 20000


def test_every_tab_renders_without_errors(loaded):
    for tab in ["overview", "contributions", "household", "investments", "goal", "report", "transactions", "cash", "controls", "setup"]:
        loaded.click(f'#nav button[data-arg="{tab}"]')
        loaded.wait_for_timeout(120)
        assert not loaded.query_selector(".callout.neg:has-text('could not be drawn')"), tab
    assert loaded.errors == []


def test_saving_categories_never_removes_them_silently(loaded):
    """Typing one new category into the box used to replace the whole list without a word."""
    js(loaded, "()=>goto('setup')")
    n = js(loaded, "()=>Object.keys(S.cfg.categories).length")
    loaded.fill("#cat-t", "Rent")
    loaded.click("[data-act=saveCats]")
    assert "Remove" in loaded.text_content("#modalRoot")      # a warning, naming what would go
    assert "Groceries" in loaded.text_content("#modalRoot")
    loaded.click("#modalRoot [data-act=closeModal]")          # cancel
    assert js(loaded, "()=>Object.keys(S.cfg.categories).length") == n
    # if it did happen, the defaults can be brought back, keeping your own
    js(loaded, "()=>{S.cfg.categories={Rent:[]};refresh();goto('setup');}")
    loaded.click("[data-act=restoreCats]")
    cats = js(loaded, "()=>Object.keys(S.cfg.categories)")
    assert "Rent" in cats and "Groceries" in cats and len(cats) == n + 1


PRINT_PAGES = ("overview", "contributions", "household", "investments", "goal")


def test_each_main_page_prints_cleanly(loaded):
    """Every main page has a Print button; on paper the menus and buttons go, colours stay light, nothing runs off the page."""
    loaded.evaluate("()=>{window.__printed=0;window.print=()=>{window.__printed++;}}")
    loaded.emulate_media(color_scheme="dark")
    for tab in PRINT_PAGES:
        loaded.evaluate("t=>goto(t)", tab)
        loaded.click("#view .vh [data-act=printPage]")
        assert loaded.evaluate("()=>window.__printed") == PRINT_PAGES.index(tab) + 1
        loaded.set_viewport_size({"width": 720, "height": 1000})       # roughly A4 width inside the margins
        loaded.emulate_media(media="print", color_scheme="dark")
        r = loaded.evaluate("""()=>({
            head: getComputedStyle(document.querySelector('.print-head')).display,
            side: getComputedStyle(document.querySelector('.side')).display,
            filters: getComputedStyle(document.querySelector('#filters')).display,
            btn: getComputedStyle(document.querySelector('#view .vh [data-act=printPage]')).display,
            bg: getComputedStyle(document.body).backgroundColor,
            over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            text: document.querySelector('.print-head').textContent})""")
        assert r["head"] == "block" and r["side"] == "none" and r["filters"] == "none" and r["btn"] == "none", (tab, r)
        assert r["bg"] == "rgb(255, 255, 255)", (tab, r)
        assert r["over"] <= 1, (tab, r)
        assert "Family Fund" in r["text"] and "printed" in r["text"], r
        loaded.emulate_media(media="screen", color_scheme="dark")
        loaded.set_viewport_size({"width": 1280, "height": 900})
    loaded.evaluate("()=>goto('transactions')")
    assert loaded.query_selector("#view [data-act=printPage]") is None
