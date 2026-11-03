#!/usr/bin/env python3
"""Bundle ui.html + core.js + pdf.js into one self-contained HTML file.

  python3 build.py                              -> ../fraction-drills.html (drop-in PDF app)
  python3 build.py --lesson lesson.json --out X -> same app, opened straight into one worksheet
"""
import argparse, json, re
from pathlib import Path

here = Path(__file__).parent
ap = argparse.ArgumentParser()
ap.add_argument("--pdfjs", default=str(here.parent / "node_modules/pdfjs-dist/legacy/build"))
ap.add_argument("--out", default=str(here.parent / "docs/index.html"))
ap.add_argument("--lesson", help="lesson JSON from makelesson.mjs to open on load")
a = ap.parse_args()
pdfjs, out = Path(a.pdfjs), Path(a.out)


def safe(text, name):
    # these sequences would end or confuse an inline <script> block
    if "</script" in text.lower() or "<!--" in text:
        text = text.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT").replace("<!--", "<\\!--")
        print(f"escaped sequences in {name}")
    return text


def classic(text, global_name=None):
    """Turn an ES-module bundle into a classic script (no import()/Blob modules; safer in Safari)."""
    text = text.replace("import.meta.url", "location.href")
    m = re.search(r"export\{([^}]*)\};?\s*$", text)
    assert m, "no export clause found"
    text = text[:m.start()]
    if global_name:
        pairs = []
        for part in m.group(1).split(","):
            bits = part.strip().split(" as ")
            pairs.append(f"{bits[-1].strip()}:{bits[0].strip()}")
        text += f"globalThis.{global_name}={{{','.join(pairs)}}};"
    return "(function(){" + text + "\n})();"

lib = safe(classic((pdfjs / "pdf.min.mjs").read_text(encoding="utf-8"), "__pdfjsLib"), "pdf lib")
worker = safe(classic((pdfjs / "pdf.worker.min.mjs").read_text(encoding="utf-8")), "pdf worker")
core = safe((here / "core.js").read_text(encoding="utf-8"), "core")
gen = safe((here / "generators.js").read_text(encoding="utf-8"), "generators")
catalog = safe(json.dumps(json.loads((here.parent / "catalog" / "k5-grade4.json").read_text(encoding="utf-8")), ensure_ascii=False), "catalog")
pre = "null"
if a.lesson:
    pre = safe(json.dumps(json.loads(Path(a.lesson).read_text(encoding="utf-8")), ensure_ascii=False), "lesson")
lib_files = sorted((here.parent / "lessons").glob("*.json"))
lib_json = safe(json.dumps([json.loads(f.read_text(encoding="utf-8")) for f in lib_files], ensure_ascii=False), "lesson library")
print(f"lesson library: {len(lib_files)} lessons")
html = (here / "ui.html").read_text(encoding="utf-8")
for marker, body in (("/*__PDFJS_LIB__*/", lib), ("/*__PDFJS_WORKER__*/", worker), ("/*__CORE__*/", core), ("/*__GEN__*/", gen), ("/*__CATALOG__*/null", catalog), ("/*__PRELOAD__*/null", pre), ("/*__LIBRARY__*/[]", lib_json)):
    assert html.count(marker) == 1, marker
    html = html.replace(marker, body)
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size/1e6:.2f} MB)")
