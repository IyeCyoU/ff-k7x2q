"""Whole-app checker: imports the sample workbook, then on desktop and phone sizes opens every page,
presses every kind of button, opens every dialog, edits every kind of box and dropdown, and records
anything that goes wrong.

    python tests/crawl.py          # prints a report, exits 1 if problems were found

Recorded: script errors, the cursor being lost after an edit, the page scrolling sideways, dialogs
that cannot be closed, and controls that cannot be used.
"""
import os
import pathlib
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / "dist" / "index.html"
SAMPLE = ROOT / "sample-data" / "sample-workbook.xlsx"
VIEWPORTS = [("desktop", {"width": 1360, "height": 900}), ("phone", {"width": 393, "height": 852})]
# Never press these: they end the session rather than test a feature.
SKIP = re.compile(r"erase everything|restore backup|choose (your )?workbook|import workbook|replace", re.I)

problems = []


def note(where, what, detail=""):
    problems.append((where, what, str(detail)[:300]))


def route(vendor):
    def handler(r):
        url = r.request.url
        if "fonts.g" in url:
            return r.abort()
        if vendor and "xlsx.full.min" in url:
            return r.fulfill(path=os.path.join(vendor, "xlsx/dist/xlsx.full.min.js"), content_type="text/javascript")
        if vendor and "jspdf.umd" in url:
            return r.fulfill(path=os.path.join(vendor, "jspdf/dist/jspdf.umd.min.js"), content_type="text/javascript")
        r.continue_()
    return handler


SAMPLE_JS = """sel => { const seen = {}, out = [];
  document.querySelectorAll(sel).forEach((e, i) => {
    const dn = [...e.attributes].filter(a => a.name.startsWith('data-') && a.name !== 'data-arg').map(a => a.name + '=' + (a.name === 'data-act' ? a.value : '')).sort().join(',');
    const k = e.tagName + '|' + (e.type || '') + '|' + dn + '|' + (dn ? '' : (e.id || e.textContent.trim().slice(0, 30)));
    if ((seen[k] = (seen[k] || 0) + 1) <= 2) out.push(i);
  }); return out; }"""


def run(vendor):
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vp, size in VIEWPORTS:
            ctx = b.new_context(viewport=size)
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "ERR_FAILED" not in m.text else None)   # fonts are blocked on purpose
            page.on("dialog", lambda d: d.dismiss())
            page.route("**/*", route(vendor))
            page.goto(APP.as_uri())
            page.set_input_files("#file", str(SAMPLE))
            page.wait_for_selector("#applyImp")
            page.click("#applyImp")
            page.wait_for_selector(".hero")
            tabs = page.evaluate("TABS.map(t => t[0])")
            cursor = [0]

            def new_errors():
                e = errs[cursor[0]:]; cursor[0] = len(errs); return e

            def show(tab):
                page.evaluate("t => { closeModal(); UI.filtersOpen = false; goto(t); renderFilters(); document.querySelectorAll('.toast').forEach(x => x.remove()); }", tab)
                page.wait_for_timeout(40)

            def sideways(where):
                r = page.evaluate("({sw: document.documentElement.scrollWidth, w: innerWidth})")
                if r["sw"] > r["w"] + 2:
                    note(where, "page scrolls sideways", f"content {r['sw']}px wide on a {r['w']}px screen")

            def edit_inputs(where, scope, reshow):
                sel = f"{scope} input:not([type=file]):not([type=hidden]):not([disabled]), {scope} select:not([disabled]), {scope} textarea"
                for i in page.evaluate(SAMPLE_JS, sel):
                    if reshow:
                        reshow()
                    els = page.query_selector_all(sel)
                    if i >= len(els) or not els[i].is_visible():
                        continue
                    el = els[i]
                    info = el.evaluate("e => ({tag: e.tagName, type: e.type, ph: e.placeholder, key: e.id || e.name || Object.entries(e.dataset).map(([k,v]) => k + '=' + v).join(' ') || e.getAttribute('aria-label')})")
                    name = f"{where} › {info['tag'].lower()} {info['key'] or info['ph'] or i}"
                    try:
                        if info["tag"] == "SELECT":
                            opts = el.evaluate("e => [...e.options].map(o => o.value)")
                            if len(opts) > 1:
                                el.select_option(opts[1 if len(opts) > 2 else -1])
                        elif info["type"] in ("checkbox", "radio"):
                            el.click(force=True)
                        elif info["type"] in ("color", "range", "date", "month"):
                            pass
                        else:
                            el.click(); el.fill("")
                            page.keyboard.type("Test" if info["type"] in ("text", "search") and not re.search(r"amount|₹|rate|%|target|\d", (info["ph"] or "") + (info["key"] or ""), re.I) else "1,250")
                            has_next = page.evaluate("() => { const a = [...document.querySelectorAll('input,select,textarea,button,a[href]')].filter(x => !x.disabled && x.offsetParent !== null); return a.indexOf(document.activeElement) < a.length - 1; }")
                            page.keyboard.press("Tab"); page.wait_for_timeout(70)
                            if has_next and page.evaluate("!document.activeElement || document.activeElement === document.body") and not (scope == "#modalRoot" and not page.query_selector("#modalRoot [data-modal]")):
                                note(name, "cursor lost after editing and pressing Tab")
                        page.wait_for_timeout(60)
                    except Exception as e:
                        note(name, "could not be edited", str(e).split("\n")[0])
                    for e in new_errors():
                        note(name, "error", e)

            def press_buttons(where, tab):
                sel = "#view button:not([disabled]), #view summary, #view [data-act], #view a[href], #filters button:not([disabled])"
                show(tab)
                for i in page.evaluate(SAMPLE_JS, sel):
                    show(tab)
                    els = page.query_selector_all(sel)
                    if i >= len(els) or not els[i].is_visible() or els[i].is_disabled():
                        continue   # greyed out now (an earlier edit changed what this page shows)
                    el = els[i]
                    label = el.evaluate("e => (e.getAttribute('aria-label') || e.textContent || e.dataset.act || e.tagName).trim().replace(/\\s+/g, ' ').slice(0, 50)")
                    name = f"{where} › {label}"
                    if SKIP.search(name):
                        continue
                    try:
                        with page.expect_download(timeout=1500) as _:
                            el.click(timeout=2000)
                    except Exception as e:
                        if "Timeout" not in str(e) or "click" in str(e).split("\n")[0].lower() and "download" not in str(e).lower():
                            if "waiting for event \"download\"" not in str(e):
                                note(name, "could not be pressed", str(e).split("\n")[0])
                    page.wait_for_timeout(80)
                    if page.query_selector("#modalRoot [data-modal]"):
                        sideways(name + " (dialog)")
                        edit_inputs(f"{name} › dialog", "#modalRoot", None)
                        if page.query_selector("#modalRoot [data-modal]"):
                            page.keyboard.press("Escape"); page.wait_for_timeout(60)
                            if page.query_selector("#modalRoot [data-modal]"):
                                closer = page.query_selector("#modalRoot [data-act=closeModal], #modalRoot button:has-text('Cancel'), #modalRoot button:has-text('Close')")
                                if closer:
                                    closer.click(); page.wait_for_timeout(60)
                                if page.query_selector("#modalRoot [data-modal]"):
                                    note(name, "dialog cannot be closed")
                    for e in new_errors():
                        note(name, "error", e)

            for tab in tabs:
                where = f"{vp} › {tab}"
                print(f"[{round(time.time() - T0)}s] {where}", file=sys.stderr)
                show(tab); sideways(where)
                for e in new_errors():
                    note(where, "error on open", e)
                edit_inputs(where, "#view", lambda: show(tab))
                edit_inputs(where + " › filters", "#filters", lambda: show(tab))
                press_buttons(where, tab)
            ctx.close()
        b.close()


if __name__ == "__main__":
    T0 = time.time()
    subprocess.run([sys.executable, str(ROOT / "build.py")], check=True, stdout=subprocess.DEVNULL)
    if not SAMPLE.exists():
        subprocess.run([sys.executable, str(ROOT / "sample-data" / "make_sample.py")], check=True)
    run(os.environ.get("LOCAL_VENDOR"))
    seen, uniq = set(), []
    for w, what, d in problems:
        k = (re.sub(r"^(desktop|phone) › ", "", w), what, d)
        if k not in seen:
            seen.add(k); uniq.append((w, what, d))
    print(f"\nChecked in {round(time.time() - T0)}s. {len(uniq)} problem(s):")
    for w, what, d in uniq:
        print(f"- [{w}] {what}" + (f": {d}" if d else ""))
    sys.exit(1 if uniq else 0)
