"""Nothing published may contain the family's real names. The public site, the source on GitHub,
the README, the sample workbook and the screenshots use made-up names only. (The bank's own name is not
protected: the app reads that bank's statement layout by name.)

The names are not written here either: only salted SHA-256 fingerprints of them, compared with every
word in the published files."""
import hashlib
import pathlib
import re
import subprocess
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIVATE = {"c50155ae27b71f18023a7157c36b923fdae7a1245453b52932cd073cf7538b80", "829e20341f051df5d9c5342e2b3443541fbff8a8973e7a7f3e1279bcb79d37fe", "49b8608bcc1d4d5a49ad897f976905588ec4e207fbf27fd42f6be7ec53284d6c", "49920a336570247389ff24e115a2e12d88e2feb4b3a54e180642ddbc483dedd2", "b4ac5f3f6c52232d8493de5b91bc0b6efe0978e42a139f61852c977b5f553393"}


def private_words(text):
    words = {w.lower() for w in re.findall(r"[A-Za-z]{3,}", text)}
    return sorted(w for w in words if hashlib.sha256(("family-fund:" + w).encode()).hexdigest() in PRIVATE)


def test_published_files_hold_no_real_names(built):
    subprocess.run([sys.executable, str(ROOT / "build.py"), "--offline"], check=True, stdout=subprocess.DEVNULL)
    files = [p for p in ROOT.rglob("*") if p.is_file() and p.suffix in {".js", ".html", ".md", ".py", ".json", ".css", ".txt", ".yml", ".webmanifest"}
             and not any(part in {"node_modules", ".git", "vendor", "__pycache__", ".pytest_cache"} for part in p.parts)]
    found = {str(p.relative_to(ROOT)): private_words(p.read_text(errors="ignore")) for p in files}
    assert {k: v for k, v in found.items() if v} == {}


def test_sample_workbooks_hold_no_real_names():
    files = sorted((ROOT / "sample-data").glob("*.xlsx"))
    assert len(files) >= 3, "sample workbook and sample statements"
    for f in files:
        wb = openpyxl.load_workbook(f)
        text = " ".join(str(c.value) for ws in wb for row in ws.iter_rows() for c in row if c.value is not None)
        assert private_words(text) == [], f.name


def test_no_unexpected_files_at_the_top_level():
    """Files uploaded by mistake (for example another app's index.html) must not sit in this repository.
    The website is built from src/ into dist/; nothing at the top level is published."""
    import subprocess
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    top = sorted({p.split("/")[0] for p in tracked})
    allowed = {".github", ".gitignore", "CHANGELOG.md", "LICENSE", "NOTICE.md", "README.md", "VERSION", "build.py",
               "docs", "package-lock.json", "package.json", "requirements-dev.txt", "sample-data", "scripts", "src", "tests"}
    assert [t for t in top if t not in allowed] == [], "unexpected file or folder at the top level of the repository"
