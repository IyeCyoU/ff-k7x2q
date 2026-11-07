"""Nothing published may contain the family's real names. The public site, the source on GitHub,
the README, the sample workbook and the screenshots use made-up names only.

The names are not written here either: only salted SHA-256 fingerprints of them, compared with every
word in the published files."""
import hashlib
import pathlib
import re
import subprocess
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIVATE = {"c50155ae27b71f18023a7157c36b923fdae7a1245453b52932cd073cf7538b80", "829e20341f051df5d9c5342e2b3443541fbff8a8973e7a7f3e1279bcb79d37fe", "49b8608bcc1d4d5a49ad897f976905588ec4e207fbf27fd42f6be7ec53284d6c", "49920a336570247389ff24e115a2e12d88e2feb4b3a54e180642ddbc483dedd2", "b4ac5f3f6c52232d8493de5b91bc0b6efe0978e42a139f61852c977b5f553393", "c963a65b01b9842e8c4e95123492108f371b63682215ff61647ae62611d00a8b"}


def private_words(text):
    words = {w.lower() for w in re.findall(r"[A-Za-z]{3,}", text)}
    return sorted(w for w in words if hashlib.sha256(("family-fund:" + w).encode()).hexdigest() in PRIVATE)


def test_published_files_hold_no_real_names(built):
    subprocess.run([sys.executable, str(ROOT / "build.py"), "--offline"], check=True, stdout=subprocess.DEVNULL)
    files = [p for p in ROOT.rglob("*") if p.is_file() and p.suffix in {".js", ".html", ".md", ".py", ".json", ".css", ".txt", ".yml", ".webmanifest"}
             and not any(part in {"node_modules", ".git", "vendor", "__pycache__", ".pytest_cache"} for part in p.parts)]
    found = {str(p.relative_to(ROOT)): private_words(p.read_text(errors="ignore")) for p in files}
    assert {k: v for k, v in found.items() if v} == {}


def test_sample_workbook_holds_no_real_names():
    wb = openpyxl.load_workbook(ROOT / "sample-data" / "sample-workbook.xlsx")
    text = " ".join(str(c.value) for ws in wb for row in ws.iter_rows() for c in row if c.value is not None)
    assert private_words(text) == []
