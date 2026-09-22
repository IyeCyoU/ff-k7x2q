#!/usr/bin/env python3
"""Bundle src/ into one self-contained dist/index.html (only Python needed).

    python build.py            # dist/index.html (loads SheetJS and jsPDF from a CDN)
    python build.py --offline  # also dist/family-fund-offline.html (everything inlined, works with no internet)
"""
import pathlib, shutil, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
ORDER = ["fontdata.js", "core.js", "engine.js", "charts.js", "views1.js", "views2.js", "views3.js", "pdf.js", "main.js"]

version = (ROOT / "VERSION").read_text().strip()
js = "\n".join((SRC / f).read_text() for f in ORDER)
js = js.replace("'use strict';\n", "").replace("__APP_VERSION__", version)
js = "'use strict';\n" + js.replace("</script>", "<\\/script>")
html = (SRC / "shell.html").read_text().replace("/*CSS*/", (SRC / "style.css").read_text()).replace("/*JS*/", js)

out = ROOT / "dist"
out.mkdir(exist_ok=True)
(out / "index.html").write_text(html)
print(f"dist/index.html  v{version}  {len(html) / 1024:.0f} KB")

LIBS = {
    "xlsx.full.min.js": "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "jspdf.umd.min.js": "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
}
if "--offline" in sys.argv:
    vend = ROOT / "vendor"
    vend.mkdir(exist_ok=True)
    off = html
    for name, url in LIBS.items():
        f = vend / name
        if not f.exists():
            print("downloading", url)
            urllib.request.urlretrieve(url, f)
        code = f.read_text(encoding="utf-8").replace("</script", "<\\/script")
        tag = f'<script src="{url}"></script>'
        assert tag in off, f"{tag} not found in shell.html"
        off = off.replace(tag, "<script>\n" + code + "\n</script>")
    (out / "family-fund-offline.html").write_text(off, encoding="utf-8")
    print(f"dist/family-fund-offline.html  {len(off) / 1024:.0f} KB  (no internet needed)")

if shutil.which("node"):  # optional syntax check
    tmp = out / "_check.js"
    tmp.write_text(js)
    r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    tmp.unlink()
    if r.returncode:
        sys.exit("JavaScript syntax error:\n" + r.stderr)
    print("syntax check ok")
