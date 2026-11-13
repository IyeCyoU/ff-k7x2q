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


def test_printed_tables_fit_with_a_wider_fallback_font(loaded):
    """Fonts differ between devices (CI caught a 34 px overflow with a wider system font): tables must still fit the paper."""
    loaded.add_style_tag(content="*{font-family:'DejaVu Sans',Verdana,sans-serif!important}")
    loaded.set_viewport_size({"width": 680, "height": 1000})
    for tab in PRINT_PAGES:
        loaded.evaluate("t=>goto(t)", tab)
        loaded.emulate_media(media="print")
        over = loaded.evaluate("()=>document.documentElement.scrollWidth-document.documentElement.clientWidth")
        assert over <= 1, (tab, over)
        loaded.emulate_media(media="screen")


def test_rules_and_overrides_carry_a_subcategory(loaded):
    r = js(loaded, """()=>{S.cfg.categories['Food']=['Bakery','Milk']; const e=R.led.find(x=>x.kind==='hhx'&&x.src==='Bank'&&!x.atm&&!x.splitIdx);
        S.cfg.rules.unshift({kw:e.payee.toLowerCase(),cat:'Food',sub:'Bakery'}); delete S.overlay[e.id]; refresh(); const a=R.byId[e.id];
        return {id:e.id,cat:a.cat,sub:a.sub,label:catLabel(a)}}""")
    assert r["cat"] == "Food" and r["sub"] == "Bakery" and r["label"] == "Food › Bakery"
    loaded.evaluate("id=>{goto('transactions'); openModal(txModal(id));}", r["id"])
    loaded.select_option("#tx-cat", "Food")
    loaded.select_option("#tx-sub", "Milk")
    loaded.click("#modalRoot [data-act=saveTx]")
    a = js(loaded, "id=>({cat:R.byId[id].cat,sub:R.byId[id].sub,ov:S.overlay[id]})", r["id"])
    assert a["cat"] == "Food" and a["sub"] == "Milk" and a["ov"]["sub"] == "Milk"


def test_renamed_medical_category_is_used(loaded):
    cat = js(loaded, """()=>{const c=S.cfg.categories; c['Medical & Healthcare']=c['Medical']; delete c['Medical']; S.cfg.rules=S.cfg.rules.filter(r=>r.cat!=='Medical');
        S.cash.push({id:'m1',date:R.months[R.N-1]+'-05',dir:'Payment',by:S.cfg.spender,person:'',mode:'Cash',acct:'Cash',cls:'Medical',cat:'',sub:'',med:'',src:'Cash in hand',desc:'x',amt:10});
        refresh(); return R.byId['m1'].cat}""")
    assert cat == "Medical & Healthcare"


def test_paid_from_his_pocket_can_count_as_investment(loaded):
    """A brother pays a family bill himself and it is credited to his investment share (not his household dues)."""
    before = js(loaded, "()=>({inv:R.C.Aman.Investment.reduce((a,x)=>a+x.paid,0),hh:R.C.Aman.Household.reduce((a,x)=>a+x.paid,0),bank:R.bankCum[R.N-1],cash:R.cashCum[R.N-1],spend:R.F.H.reduce((a,x)=>a+x.spend,0),exc:R.exceptions.length})")
    js(loaded, """()=>{S.cash.push({id:'dx',date:R.months[R.N-1]+'-10',dir:'Direct',by:'Aman',person:'Aman',mode:'Cash',acct:'Direct',cls:'Household',cat:'Groceries',sub:'',med:'',src:'Cash in hand',credit:'Investment',desc:'Hospital meals',amt:4000});refresh();}""")
    after = js(loaded, "()=>({inv:R.C.Aman.Investment.reduce((a,x)=>a+x.paid,0),hh:R.C.Aman.Household.reduce((a,x)=>a+x.paid,0),bank:R.bankCum[R.N-1],cash:R.cashCum[R.N-1],spend:R.F.H.reduce((a,x)=>a+x.spend,0),bad:R.exceptions.filter(e=>/Manual bank entry/.test(e.title)).length,checks:R.checks.filter(c=>c.status==='Difference').length})")
    assert after["inv"] - before["inv"] == 4000 and after["hh"] == before["hh"]
    assert after["spend"] - before["spend"] == 4000
    assert after["bank"] == before["bank"] and after["cash"] == before["cash"]
    assert after["bad"] == 0 and after["checks"] == 0          # not a "manual bank entry", and everything still reconciles


def test_overview_says_what_the_spending_funds_owe_investment(loaded):
    assert js(loaded, "()=>fundsOwe(R.N-1)") is None and not loaded.query_selector(".callout.owe")
    o = js(loaded, """()=>{const over=R.F.H[R.N-1].close+50000; S.cash.push({id:'big',date:R.months[R.N-1]+'-12',dir:'Direct',by:'Aman',person:'Aman',mode:'Cash',acct:'Direct',cls:'Household',cat:'Groceries',sub:'',med:'',src:'',credit:'Investment',desc:'x',amt:over});
        refresh(); goto('overview'); return fundsOwe(R.N-1)}""")
    assert abs(o["owed"] - 50000) < 0.01 and abs(o["short"]["H"] - 50000) < 0.01
    assert abs(o["rest"] - max(0, o["owed"] - o["arrears"])) < 0.01 and abs(o["each"] * 4 - o["rest"]) < 0.05
    text = loaded.inner_text(".callout.owe")
    assert "owe the investment fund" in text and "from each of the 4 brothers" in text
    for tab in ("household", "investments"):
        loaded.evaluate("t=>goto(t)", tab); assert loaded.query_selector(".callout.owe"), tab


def test_returned_investment_money_raises_what_he_still_owes(loaded):
    """Net investment = deposits minus what was returned to him; outstanding is measured on that."""
    r = js(loaded, """()=>{const l=R.N-1, b='Bilal', before=R.C[b].Investment[l], pos0=before.closePos;
        const e=R.led.find(x=>x.kind==='invd'&&x.person===b); S.overlay[e.id]={inv:'Returned to brother'}; refresh();
        const after=R.C[b].Investment[l];
        return {amt:-e.amt, pos0, pos1:after.closePos, net:R.invNet[b][l], paid:after.cumPaid, diff:R.checks.filter(c=>c.status==='Difference').map(c=>c.name)}}""")
    assert r["amt"] > 0 and abs((r["pos0"] - r["pos1"]) - r["amt"]) < 0.01      # his position is worse by exactly what he took back
    assert abs(r["paid"] - r["net"]) < 0.01                                      # paid in the tracker = net invested
    assert r["diff"] == []


def _opts(page, sel):
    return page.evaluate("s=>[...document.querySelector(s).options].map(o=>o.value).filter(Boolean)", sel)


def test_subcategory_box_lists_only_the_chosen_categorys(loaded):
    """Two boxes: the subcategory box shows the subcategories of the category beside it and nothing else."""
    id_ = js(loaded, """()=>{S.cfg.categories={'Food':['Bakery','Milk'],'Travel':['Fuel','Service'],'Plain':[]}; S.cfg.rules=[]; refresh();
        return R.led.find(x=>x.kind==='hhx'&&x.src==='Bank'&&!x.atm&&!x.splitIdx).id}""")
    loaded.evaluate("id=>{goto('transactions'); openModal(txModal(id));}", id_)
    assert _opts(loaded, "#tx-sub") == [] and loaded.is_disabled("#tx-sub")            # no category yet: nothing to pick
    loaded.select_option("#tx-cat", "Food")
    assert _opts(loaded, "#tx-sub") == ["Bakery", "Milk"] and not loaded.is_disabled("#tx-sub")
    loaded.select_option("#tx-sub", "Milk")
    loaded.select_option("#tx-cat", "Travel")                                           # change of category: the old subcategory cannot linger
    assert _opts(loaded, "#tx-sub") == ["Fuel", "Service"] and loaded.input_value("#tx-sub") == ""
    loaded.select_option("#tx-cat", "Plain")
    assert _opts(loaded, "#tx-sub") == [] and loaded.is_disabled("#tx-sub")
    loaded.select_option("#tx-cat", "Travel"); loaded.select_option("#tx-sub", "Fuel")
    loaded.click("#modalRoot [data-act=saveTx]")
    assert js(loaded, "id=>[R.byId[id].cat,R.byId[id].sub]", id_) == ["Travel", "Fuel"]
    # the quick boxes in the Transactions table follow the same rule
    loaded.evaluate("id=>{UI.txIds=[id]; UI.txpage=0; goto('transactions');}", id_)      # show just this row
    assert js(loaded, "id=>[...document.querySelector('[data-qsub=\"'+id+'\"]').options].map(o=>o.value).filter(Boolean)", id_) == ["Fuel", "Service"]
    loaded.evaluate("id=>{const s=document.querySelector('[data-qsub=\"'+id+'\"]');s.value='Service';s.dispatchEvent(new Event('change',{bubbles:true}))}", id_)
    assert js(loaded, "id=>[R.byId[id].cat,R.byId[id].sub]", id_) == ["Travel", "Service"]
    loaded.evaluate("id=>{const s=document.querySelector('[data-qcat=\"'+id+'\"]');s.value='Food';s.dispatchEvent(new Event('change',{bubbles:true}))}", id_)
    assert js(loaded, "id=>[R.byId[id].cat,R.byId[id].sub]", id_) == ["Food", ""]      # new category: subcategory cleared, not carried over


def test_payee_rule_with_category_then_its_subcategory(loaded):
    js(loaded, "()=>{S.cfg.categories={'Food':['Bakery','Milk'],'Travel':['Fuel'],'Plain':[]}; S.cfg.rules=[]; S.overlay={}; refresh(); goto('household');}")
    row = loaded.locator(".catpair").first
    payee = row.locator("[data-act=payeeRule]").get_attribute("data-arg")
    assert row.locator(".subsel").is_disabled()
    row.locator("[data-act=payeeRule]").click()                       # nothing chosen: nothing saved
    assert js(loaded, "()=>S.cfg.rules.length") == 0
    row = loaded.locator(".catpair").first
    row.locator("[data-catpair]").select_option("Food")
    assert row.locator(".subsel").evaluate("s=>[...s.options].map(o=>o.value).filter(Boolean)") == ["Bakery", "Milk"]
    row.locator(".subsel").select_option("Bakery")
    row.locator("[data-act=payeeRule]").click()
    assert js(loaded, "()=>S.cfg.rules[0]") == {"kw": payee.lower(), "cat": "Food", "sub": "Bakery"}
    # Setup: same two boxes
    loaded.evaluate("goto('setup')")
    loaded.select_option("#rl-c", "Travel")
    assert _opts(loaded, "#rl-s") == ["Fuel"]
    loaded.select_option("#rl-c", "Plain")
    assert _opts(loaded, "#rl-s") == [] and loaded.is_disabled("#rl-s")
