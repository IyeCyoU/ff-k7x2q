"""The published website: served over http exactly as GitHub Pages serves dist/.

Offline use, updates, the security policy, amounts typed the way people type them, the phone layout,
and keeping your place while editing."""
import base64
import functools
import json
import http.server
import pathlib
import shutil
import threading

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SAMPLE = ROOT / "sample-data" / "sample-workbook.xlsx"


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webmanifest": "application/manifest+json", ".js": "text/javascript"}

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def _switched(pg, name, seconds=10):
    """Wait until the offline copy has switched to the release whose cache name contains `name`: the old cache is
    gone and nothing is installing or waiting. (Polled from here: a promise handed to wait_for_function counts as true.)"""
    st = None
    for _ in range(seconds * 10):
        st = pg.evaluate("""() => Promise.all([caches.keys(), navigator.serviceWorker.getRegistration()]).then(([k, r]) =>
            ({keys: k, waiting: !!r.waiting, installing: !!r.installing, active: r.active && r.active.state}))""")
        if len(st["keys"]) == 1 and name in st["keys"][0] and not st["waiting"] and not st["installing"] and st["active"] == "activated":
            return st
        pg.wait_for_timeout(100)
    raise AssertionError("the offline copy did not switch by itself: %r" % (st,))


def serve(directory):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


@pytest.fixture(scope="module")
def site(built):
    srv, url = serve(DIST)
    yield url
    srv.shutdown()


def open_site(browser, url, width=1360, height=900):
    ctx = browser.new_context(viewport={"width": width, "height": height})
    pg = ctx.new_page()
    pg.problems = []
    pg.on("pageerror", lambda e: pg.problems.append(str(e)))
    # Failed loads are checked by name (requestfailed); the console line for them names no file.
    # Google Fonts are blocked on purpose: the app must work without them.
    pg.on("console", lambda m: pg.problems.append(m.text) if m.type == "error" and "net::ERR_FAILED" not in m.text else None)
    pg.on("requestfailed", lambda r: pg.problems.append("FAILED " + r.url[:90]) if "fonts.g" not in r.url else None)
    pg.route("**/*", lambda r: r.abort() if "fonts.g" in r.request.url else r.continue_())
    pg.goto(url)
    return ctx, pg


def load_sample(pg):
    pg.set_input_files("#file", str(SAMPLE))
    pg.wait_for_selector("#applyImp")
    pg.click("#applyImp")
    pg.wait_for_selector(".hero")


def test_libraries_come_with_the_app_not_a_cdn(site, browser):
    ctx, pg = open_site(browser, site)
    outside = []
    pg.on("request", lambda r: outside.append(r.url) if not r.url.startswith(site) and "fonts.g" not in r.url else None)
    pg.reload()
    load_sample(pg)
    assert outside == []
    assert pg.evaluate("typeof XLSX === 'object' && typeof jspdf === 'object'")
    ctx.close()


def test_security_policy_blocks_other_servers_and_app_trips_nothing(site, browser):
    ctx, pg = open_site(browser, site)
    pg.evaluate("window.__v = []; document.addEventListener('securitypolicyviolation', e => __v.push(e.violatedDirective))")
    load_sample(pg)
    for tab in pg.evaluate("TABS.map(t => t[0])"):
        pg.evaluate("t => goto(t)", tab)
    pg.click("[data-act=moreFilters]")
    assert pg.evaluate("__v") == [], "the app itself must not trip the policy"
    assert pg.problems == []
    sent = pg.evaluate("fetch('https://example.com/x', {method: 'POST', body: 'data'}).then(() => 'sent', () => 'blocked')")
    assert sent == "blocked"
    ctx.close()


def test_works_offline_and_updates_without_asking(built, browser, tmp_path):
    copy = tmp_path / "site"
    shutil.copytree(DIST, copy)
    srv, url = serve(copy)
    try:
        ctx, pg = open_site(browser, url)
        pg.evaluate("navigator.serviceWorker.ready")
        cached = pg.evaluate("caches.keys().then(k => caches.open(k[0])).then(c => c.keys()).then(r => r.length)")
        assert cached >= 9
        pg.reload()
        ctx.set_offline(True)
        pg.reload()
        assert pg.title() == "Family Fund"
        load_sample(pg)                       # the libraries work offline too
        ctx.set_offline(False)
        # a new release of the offline copy takes over by itself: no question, no reload, nothing on screen
        pg.evaluate("window.__same = true")
        sw = copy / "sw.js"
        sw.write_text(sw.read_text().replace("const CACHE = 'family-fund-", "const CACHE = 'family-fund-next-"))
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        _switched(pg, "family-fund-next-")
        assert pg.evaluate("window.__same") is True, "the page must not be reloaded for this"
        assert pg.query_selector(".sw-update") is None and "new version is ready" not in pg.inner_text("body").lower()
        assert pg.problems == []
        ctx.close()
    finally:
        srv.shutdown()


def test_offline_single_file_needs_no_internet(browser):
    off = DIST / "family-fund-offline.html"
    if not off.exists():
        import subprocess, sys
        subprocess.run([sys.executable, str(ROOT / "build.py"), "--offline"], check=True)
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(off.as_uri())
    load_sample(pg)
    assert errors == []
    ctx.close()


@pytest.mark.parametrize("typed, want", [("10,000", 10000), ("1,00,000", 100000), ("₹ 12,500", 12500), ("15000", 15000)])
def test_contribution_amount_typed_with_commas(site, browser, typed, want):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.evaluate("goto('setup')")
    box = "input[data-plan][data-k=amount]"
    pid = pg.get_attribute(box, "data-plan")
    pg.click(box); pg.fill(box, ""); pg.keyboard.type(typed); pg.keyboard.press("Tab")
    pg.wait_for_timeout(150)
    assert pg.evaluate("id => S.cfg.plan.find(p => p.id === id).amount", pid) == want
    ctx.close()


def test_goal_target_and_cash_amount_typed_with_commas(site, browser):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.evaluate("goto('setup')")
    pg.click("#g-t"); pg.fill("#g-t", ""); pg.keyboard.type("1,00,00,000"); pg.keyboard.press("Tab")
    pg.wait_for_timeout(150)
    assert pg.evaluate("S.cfg.goal.target") == 10000000
    pg.evaluate("goto('cash')")
    pg.click("[data-act=addCash]")
    pg.fill("#cf-desc", "Vegetables") if pg.query_selector("#cf-desc") else None
    pg.click("#cf-amt"); pg.keyboard.type("1,250.50"); pg.keyboard.press("Tab")
    assert float(pg.input_value("#cf-amt")) == 1250.5
    ctx.close()


def test_cursor_stays_put_after_an_edit(site, browser):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.evaluate("goto('setup')")
    pg.click("#st-tol"); pg.fill("#st-tol", ""); pg.keyboard.type("2"); pg.keyboard.press("Tab")
    pg.wait_for_timeout(150)
    assert pg.evaluate("document.activeElement !== document.body"), "cursor lost after editing"
    assert pg.evaluate("S.cfg.tol") == 2
    ctx.close()


def test_phone_filters_popup_is_on_screen_and_on_top(site, browser):
    ctx, pg = open_site(browser, site, 393, 852)
    load_sample(pg)
    pg.click("[data-act=moreFilters]")
    pg.wait_for_timeout(150)
    r = pg.evaluate("(() => { const r = document.querySelector('.popover').getBoundingClientRect(); return {l: r.left, r: r.right, b: r.bottom}; })()")
    assert r["l"] >= 0 and r["r"] <= 393, r
    assert pg.evaluate("document.documentElement.scrollWidth") <= 393
    # every select in the pop-up is the topmost thing at its centre (not hidden behind a card)
    hidden = pg.evaluate("""() => [...document.querySelectorAll('.popover select')].filter(s => {
        const b = s.getBoundingClientRect(); const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !(top === s || s.contains(top)); }).map(s => s.dataset.f)""")
    assert hidden == []
    ctx.close()


def test_app_installs_on_phones(site, browser):
    ctx, pg = open_site(browser, site)
    m = pg.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    assert m["display"] == "standalone" and len(m["icons"]) >= 3
    for icon in [i["src"] for i in m["icons"]] + ["icons/apple-touch-icon.png"]:
        assert (DIST / icon).exists(), icon
    ctx.close()


def test_backup_with_password_round_trip(site, browser, tmp_path):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    before = pg.evaluate("[S.tx.length, R.famCum[R.N-1]]")
    pg.evaluate("goto('setup')")
    pg.click("[data-act=backup]")
    pg.fill("#bk-pw", "short"); pg.fill("#bk-pw2", "short"); pg.click("#bk-ok")
    assert "8 characters" in pg.text_content("#bk-msg")
    pg.fill("#bk-pw", "family secret 9"); pg.fill("#bk-pw2", "family secret 9")
    with pg.expect_download() as d:
        pg.click("#bk-ok")
    f = tmp_path / "backup.json"; d.value.save_as(f)
    raw = f.read_text()
    obj = json.loads(raw)
    # only the envelope is readable; everything else is inside the ciphertext
    assert set(obj) == {"app", "kind", "v", "enc", "salt", "iv", "ct"} and obj["enc"] is True
    envelope = json.dumps({k: v for k, v in obj.items() if k != "ct"})
    for name in pg.evaluate("S.cfg.brothers") + ["Parent"]:
        assert name not in envelope, f"{name} readable in an encrypted backup"
    # (the ciphertext is random base64, so short names can appear in it by chance; it must not be readable)
    ct = base64.b64decode(obj["ct"])
    assert b'"tx"' not in ct and b'"brothers"' not in ct, "backup contents are not encrypted"
    # wipe, then restore with a wrong and the right password
    pg.evaluate("localStorage.clear()"); pg.reload()
    pg.set_input_files("#file", str(f))
    pg.fill("#br-pw", "wrong password"); pg.click("#br-ok")
    pg.locator("#br-msg", has_text="did not open").wait_for()   # unlocking is slow on purpose
    assert "did not open" in pg.text_content("#br-msg")
    pg.fill("#br-pw", "family secret 9"); pg.click("#br-ok")
    pg.click("#confirmOk")
    pg.wait_for_selector(".hero")
    assert pg.evaluate("[S.tx.length, R.famCum[R.N-1]]") == before
    ctx.close()


def test_old_backup_without_password_still_restores(site, browser, tmp_path):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    f = tmp_path / "plain.json"
    f.write_text(pg.evaluate("JSON.stringify(S)"))
    n = pg.evaluate("S.tx.length")
    pg.evaluate("localStorage.clear()"); pg.reload()
    pg.set_input_files("#file", str(f))
    pg.click("#confirmOk")
    pg.wait_for_selector(".hero")
    assert pg.evaluate("S.tx.length") == n
    ctx.close()


def test_erase_everything_leaves_nothing_behind(site, browser):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.evaluate("""() => { S.cfg.plan[0].amount = 12345; S.cfg.goal.target = 7777777; S.cfg.categories['My category'] = ['x'];
        S.cfg.rules.unshift({kw: 'zomato', cat: 'Groceries'}); S.cfg.tol = 9; S.cash.push({id: 'c1', date: '2026-03-30', dir: 'Receipt', amt: 5, cls: 'Household'});
        UI.txq = 'rent'; persist(); }""")
    pg.wait_for_timeout(300)                       # let the save land, as it would for a person
    pg.evaluate("goto('setup')")
    pg.click("[data-act=resetAll]")
    with pg.expect_navigation():
        pg.click("#confirmOk")
    pg.wait_for_selector("#view")
    left = pg.evaluate("JSON.parse(localStorage.getItem(KEY))")
    fresh = pg.evaluate("defaults()")
    assert left in (None, fresh), "after erasing, nothing or only the app's starting values may be saved"
    assert pg.evaluate("[S.tx.length, S.cash.length, UI.txq]") == [0, 0, ""]
    assert pg.query_selector(".hero") is None      # back to the import screen
    ctx.close()


def test_whats_new_appears_once_after_an_update(site, browser):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.wait_for_timeout(300)
    version = pg.evaluate("APP_VERSION")
    assert version in pg.text_content(".side .foot")
    pg.evaluate("localStorage.setItem(SEEN_KEY, '1.1.0')")   # as if this browser last ran 1.1.0
    pg.reload()
    pg.wait_for_selector(".wn-note")
    assert f"Updated to version {version}" in pg.text_content(".wn-note")
    assert pg.query_selector("#wn-h") is None, "a note, not a window you must close"
    pg.click(".wn-note button")                               # details only if asked for
    pg.wait_for_selector("#wn-h")
    assert "What's new in 1.2.0" in pg.text_content("#modalRoot")
    pg.click("#modalRoot [data-act=closeModal]")
    pg.reload()
    pg.wait_for_selector(".hero")
    assert pg.query_selector(".wn-note") is None and pg.query_selector("#wn-h") is None, "shown again after it was seen"
    ctx.close()


def test_new_user_does_not_get_whats_new(site, browser):
    ctx, pg = open_site(browser, site)
    pg.wait_for_selector("#view")
    assert pg.query_selector("#wn-h") is None and pg.query_selector(".wn-note") is None
    ctx.close()


def test_family_members_can_be_renamed(site, browser):
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    pg.evaluate("S.cfg.plan.push({id: 'pz', from: '2026-01', brother: 'Aman', type: 'Investment', amount: 5000, status: 'Active'}); refresh();")
    pg.evaluate("goto('setup')")
    pg.fill("#mb-0", "Zed"); pg.keyboard.press("Tab"); pg.wait_for_timeout(200)
    r = pg.evaluate("({bro: S.cfg.brothers, plan: S.cfg.plan.find(p => p.id === 'pz').brother, side: document.getElementById('brandNames').textContent, people: S.cfg.people})")
    assert r["bro"][0] == "Zed" and r["plan"] == "Zed" and "Zed" in r["side"] and "Aman" not in r["people"]
    pg.click("[data-act=addMember]"); pg.wait_for_timeout(150)
    assert pg.evaluate("S.cfg.brothers.length") == 5
    pg.fill("#mb-4", ""); pg.keyboard.press("Tab"); pg.wait_for_timeout(150)
    assert pg.evaluate("S.cfg.brothers.length") == 4
    ctx.close()


def test_data_saved_by_an_older_version_keeps_working(site, browser):
    """Older versions had no spender or bank-label settings; their saved data must flag nothing new."""
    ctx, pg = open_site(browser, site)
    load_sample(pg)
    before = pg.evaluate("R.exceptions.filter(e => e.code === 'Missing brother').length")
    pg.evaluate("""() => { clearTimeout(saveT); saveT = null;   // no pending save may overwrite the old-version data
        const o = JSON.parse(JSON.stringify(S)); delete o.cfg.spender; delete o.cfg.banks;
        const legacy = ['B', 'a', 'p', 'a'].join('');
        o.tx.forEach(t => { if (t.dep === 'Parent') t.dep = legacy; });
        localStorage.setItem(KEY, JSON.stringify(o)); localStorage.setItem(SEEN_KEY, APP_VERSION); }""")
    pg.reload(); pg.wait_for_selector(".hero")
    assert pg.evaluate("S.cfg.spender") == "".join(["B", "a", "p", "a"])
    assert pg.evaluate("R.exceptions.filter(e => e.code === 'Missing brother').length") == before
    ctx.close()



def _release(copy, version):
    """Pretend a new release was published: the offline-support file names another version."""
    import re
    sw = copy / "sw.js"
    sw.write_text(re.sub(r"const CACHE = 'family-fund-[0-9.]+-", "const CACHE = 'family-fund-%s-" % version, sw.read_text(), count=1))


def _come_back(pg):
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")


def test_never_asks_about_a_new_version(built, browser, tmp_path):
    """The "A new version is ready" message is gone for good: not on opening, not while in use, not after a release."""
    copy = tmp_path / "site"; shutil.copytree(DIST, copy)
    srv, url = serve(copy)
    try:
        ctx, pg = open_site(browser, url)
        pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(300)
        assert "sw-update" not in (DIST / "index.html").read_text(), "the app has no code left that can show it"
        for v in ("9.9.1", "9.9.2", "9.9.3"):
            _release(copy, v)
            pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            _switched(pg, v)
            assert pg.query_selector(".sw-update") is None
        pg2 = ctx.new_page(); pg2.goto(url); pg2.wait_for_timeout(1500)      # opening it again: still nothing
        assert pg2.query_selector(".sw-update") is None
        ctx.close()
    finally:
        srv.shutdown()


def test_app_left_open_refreshes_itself_once_and_never_loops(built, browser, tmp_path):
    copy = tmp_path / "site"; shutil.copytree(DIST, copy)
    srv, url = serve(copy)
    try:
        ctx, pg = open_site(browser, url)
        pg.evaluate("navigator.serviceWorker.ready"); pg.reload(); pg.wait_for_timeout(300)
        # same release on the website: coming back to the app does nothing
        pg.evaluate("window.__same = true"); _come_back(pg); pg.wait_for_timeout(1500)
        assert pg.evaluate("window.__same") is True
        # a new release while something is being typed: left alone
        _release(copy, "9.9.9")
        pg.evaluate("()=>{const i=document.createElement('input');i.id='typing';document.body.appendChild(i);i.focus();}")
        _come_back(pg); pg.wait_for_timeout(1500)
        assert pg.evaluate("window.__same") is True, "never refresh while the user is typing"
        # nothing being edited: it refreshes itself, once
        pg.evaluate("document.getElementById('typing').remove()")
        with pg.expect_navigation(timeout=6000):
            _come_back(pg)
        pg.wait_for_timeout(500)
        # this test site still serves the old page, so the page is still "behind": it must not try again and again
        pg.evaluate("window.__same = true")
        for _ in range(3):
            _come_back(pg); pg.wait_for_timeout(800)
        assert pg.evaluate("window.__same") is True, "one refresh per release, no loop"
        assert pg.query_selector(".sw-update") is None
        ctx.close()
    finally:
        srv.shutdown()
