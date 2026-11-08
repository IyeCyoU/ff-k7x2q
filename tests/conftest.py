import os
import pathlib
import subprocess
import sys

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "sample-data" / "sample-workbook.xlsx"
APP = ROOT / "dist" / "index.html"


@pytest.fixture(scope="session", autouse=True)
def built():
    subprocess.run([sys.executable, str(ROOT / "build.py")], check=True)
    if not SAMPLE.exists():   # committed; regenerate only when missing so test runs leave no changes behind
        subprocess.run([sys.executable, str(ROOT / "sample-data" / "make_sample.py")], check=True)


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def _route(vendor):
    """In CI the CDN is reachable. Offline, set LOCAL_VENDOR to a folder containing node_modules/xlsx and jspdf."""
    def handler(route):
        url = route.request.url
        if "fonts.g" in url:
            return route.abort()
        if vendor and "xlsx.full.min" in url:
            return route.fulfill(path=os.path.join(vendor, "xlsx/dist/xlsx.full.min.js"), content_type="text/javascript")
        if vendor and "jspdf.umd" in url:
            return route.fulfill(path=os.path.join(vendor, "jspdf/dist/jspdf.umd.min.js"), content_type="text/javascript")
        route.continue_()
    return handler


@pytest.fixture()
def page(browser):
    ctx = browser.new_context(viewport={"width": 1360, "height": 900})
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.route("**/*", _route(os.environ.get("LOCAL_VENDOR")))
    pg.goto(APP.as_uri())
    yield pg
    ctx.close()


@pytest.fixture()
def loaded(page):
    """App with the sample workbook imported."""
    page.set_input_files("#file", str(SAMPLE))
    page.wait_for_selector("#applyImp")
    page.click("#applyImp")
    page.wait_for_selector(".hero")
    return page
