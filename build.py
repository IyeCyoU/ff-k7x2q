#!/usr/bin/env python3
"""Build the app from src/ (only Python needed).

    python build.py            # dist/ : the website (index.html, libraries, offline support, icons)
    python build.py --offline  # also dist/family-fund-offline.html: one file with everything inlined

The two libraries (SheetJS, jsPDF) are bundled with the app instead of loaded from a CDN at runtime,
so the app works offline, needs no third-party site, and can run under a strict security policy.
They are taken from LOCAL_VENDOR, node_modules/, vendor/ or downloaded once, and always checked
against the SHA-256 below: a changed file stops the build.
"""
import base64, hashlib, json, os, pathlib, shutil, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT / "dist"
ORDER = ["fontdata.js", "core.js", "engine.js", "charts.js", "views1.js", "views2.js", "views3.js", "pdf.js", "main.js", "pwa.js"]
LIBS = {  # file: (npm path, CDN url, sha256)
    "xlsx.full.min.js": ("xlsx/dist/xlsx.full.min.js", "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
                         "c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99"),
    "jspdf.umd.min.js": ("jspdf/dist/jspdf.umd.min.js", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
                         "98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875"),
}
FONTS_CSS = "https://fonts.googleapis.com"
FONTS_FILES = "https://fonts.gstatic.com"


def sha(b):
    return hashlib.sha256(b).hexdigest()


def library(name):
    npm, url, want = LIBS[name]
    for base in [os.environ.get("LOCAL_VENDOR"), ROOT / "node_modules"]:
        if base and (pathlib.Path(base) / npm).exists():
            data = (pathlib.Path(base) / npm).read_bytes()
            break
    else:
        cached = ROOT / "vendor" / name
        if not cached.exists():
            print("downloading", url)
            cached.parent.mkdir(exist_ok=True)
            urllib.request.urlretrieve(url, cached)
        data = cached.read_bytes()
    if sha(data) != want:
        sys.exit(f"{name}: fingerprint does not match the pinned version.\n  got  {sha(data)}\n  want {want}")
    return data


def csp(script_hashes, extra_script=""):
    h = " ".join(f"'sha256-{x}'" for x in script_hashes)
    return ("default-src 'none'; "
            f"script-src {extra_script}{h}; "
            f"style-src 'self' 'unsafe-inline' {FONTS_CSS}; font-src {FONTS_FILES} data:; "
            "img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; "
            "base-uri 'none'; form-action 'none'; object-src 'none'")


def b64sha(s):
    return base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()


version = (ROOT / "VERSION").read_text().strip()
js = "\n".join((SRC / f).read_text() for f in ORDER)
js = js.replace("'use strict';\n", "").replace("__APP_VERSION__", version)
js = "'use strict';\n" + js.replace("</script>", "<\\/script>")
shell = (SRC / "shell.html").read_text().replace("/*CSS*/", (SRC / "style.css").read_text())
inline_js = "\n" + js    # exactly what sits between <script> and </script>, so its hash matches
page = shell.replace("/*JS*/", js)

if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "vendor").mkdir(parents=True)
libs = {n: library(n) for n in LIBS}
for n, data in libs.items():
    (OUT / "vendor" / n).write_bytes(data)

# The website: libraries as local files, strict policy (only this exact inline script may run).
site = page
for n, (_, url, _) in LIBS.items():
    tag = f'<script src="{url}"></script>'
    assert tag in site, f"{tag} not found in shell.html"
    site = site.replace(tag, f'<script src="vendor/{n}"></script>')
policy = csp([b64sha(inline_js)], "'self' ")
head = (f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n'
        '<meta name="referrer" content="no-referrer">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" type="image/png" href="icons/icon-192.png">\n'
        '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
        '<meta name="theme-color" content="#14382c">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="Family Fund">\n')
site = site.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + head, 1)
(OUT / "index.html").write_text(site)
shutil.copytree(SRC / "icons", OUT / "icons")
shutil.copy(SRC / "manifest.webmanifest", OUT / "manifest.webmanifest")
# Offline cache: its name changes whenever any published file changes, so phones always get updates.
files = ["index.html", "manifest.webmanifest"] + [f"vendor/{n}" for n in LIBS] + [f"icons/{p.name}" for p in sorted((OUT / "icons").iterdir())]
digest = hashlib.sha256(b"".join((OUT / f).read_bytes() for f in files)).hexdigest()[:12]
cache = f"family-fund-{version}-{digest}"
(OUT / "sw.js").write_text((SRC / "sw.js").read_text().replace("__CACHE__", cache).replace("__FILES__", json.dumps(["./"] + files)))
print(f"dist/  v{version}  index.html {len(site) / 1024:.0f} KB + libraries, offline cache {cache}")

if "--offline" in sys.argv:
    off = page
    hashes = [b64sha(inline_js)]
    for n, (_, url, _) in LIBS.items():
        code = "\n" + libs[n].decode("utf-8").replace("</script", "<\\/script") + "\n"
        off = off.replace(f'<script src="{url}"></script>', "<script>" + code + "</script>")
        hashes.append(b64sha(code))
    off = off.replace('<meta charset="utf-8">\n', f'<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="{csp(hashes)}">\n<meta name="referrer" content="no-referrer">\n', 1)
    (OUT / "family-fund-offline.html").write_text(off, encoding="utf-8")
    print(f"dist/family-fund-offline.html  {len(off) / 1024:.0f} KB  (no internet needed)")

if shutil.which("node"):  # optional syntax check
    tmp = OUT / "_check.js"
    tmp.write_text(js)
    r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    tmp.unlink()
    if r.returncode:
        sys.exit("JavaScript syntax error:\n" + r.stderr)
    print("syntax check ok")
