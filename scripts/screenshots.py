#!/usr/bin/env python3
"""Regenerate docs/screenshots from the synthetic sample workbook.

    python build.py && python scripts/screenshots.py
"""
import os, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
vendor = os.environ.get("LOCAL_VENDOR")

def route(r):
    u = r.request.url
    if "fonts.g" in u: return r.abort()
    if vendor and "xlsx.full.min" in u: return r.fulfill(path=os.path.join(vendor, "xlsx/dist/xlsx.full.min.js"), content_type="text/javascript")
    if vendor and "jspdf.umd" in u: return r.fulfill(path=os.path.join(vendor, "jspdf/dist/jspdf.umd.min.js"), content_type="text/javascript")
    r.continue_()

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1360, "height": 900})
    pg.route("**/*", route); pg.goto((ROOT / "dist" / "index.html").as_uri())
    pg.set_input_files("#file", str(ROOT / "sample-data" / "sample-workbook.xlsx")); pg.wait_for_selector("#applyImp"); pg.click("#applyImp"); pg.wait_for_selector(".hero")
    out = ROOT / "docs" / "screenshots"; out.mkdir(parents=True, exist_ok=True)
    pg.wait_for_selector(".toast", state="detached", timeout=8000); pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / "overview.png"), clip={"x": 0, "y": 0, "width": 1360, "height": 1250}, full_page=True)
    for tab, name, h in (("contributions", "contributions", 1000), ("report", "report", 1500)):
        pg.click(f'#nav button[data-arg="{tab}"]'); pg.wait_for_timeout(400); pg.mouse.move(2, 2)
        pg.screenshot(path=str(out / f"{name}.png"), clip={"x": 0, "y": 0, "width": 1360, "height": h}, full_page=True)
    b.close()
print("screenshots written to", out)
