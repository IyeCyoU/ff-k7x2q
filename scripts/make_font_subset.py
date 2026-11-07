#!/usr/bin/env python3
"""Rebuild src/fontdata.js: a small Roboto subset (Latin + rupee sign + minus) embedded as base64.

    pip install fonttools brotli font-roboto
    python scripts/make_font_subset.py
"""
import base64, pathlib, subprocess, sys, tempfile
import font_roboto

files = pathlib.Path(font_roboto.__file__).parent / "files"
UNICODES = "U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+20B9,U+2212,U+2192"
out = "'use strict';\n/* Roboto subset (Apache-2.0) with the rupee sign, for the PDF */\n"
with tempfile.TemporaryDirectory() as tmp:
    for key, weight in (("R", "Regular"), ("M", "Medium"), ("B", "Bold")):
        dest = pathlib.Path(tmp) / f"{weight}.ttf"
        subprocess.run(["pyftsubset", str(files / f"Roboto-{weight}.ttf"), f"--unicodes={UNICODES}", "--layout-features=",
                        "--no-hinting", "--desubroutinize", f"--output-file={dest}"], check=True)
        out += f"const FONT_{key}='" + base64.b64encode(dest.read_bytes()).decode() + "';\n"
target = pathlib.Path(__file__).resolve().parents[1] / "src" / "fontdata.js"
target.write_text(out)
print("wrote", target, f"{len(out) / 1024:.0f} KB")
