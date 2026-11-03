"""Layout safeguard test (needs Playwright + Chromium). Usage: python3 tests/e2e_layout.py [path/to/index.html]
Sweeps every READY generator topic x level x mode; fails on any overflow, mismatched fraction size or guard repair.
Also injects a hostile CSS rule to prove numerators cannot be shrunk by stray styles."""
import sys, pathlib
from playwright.sync_api import sync_playwright
html = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'index.html').resolve()
FRAC = "[...document.querySelectorAll('.frac')].filter(f=>{var n=f.querySelector('.n'),d=f.querySelector('.d');return n&&d&&getComputedStyle(n).fontSize!==getComputedStyle(d).fontSize}).length"
bad = []
repaired = []
with sync_playwright() as p:
    pg = p.chromium.launch().new_page(viewport={'width': 1600, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + str(html))
    cov = pg.evaluate("""(()=>{var r=[];__CATALOG__.subjects.forEach((sj,si)=>Object.keys(sj.topics).forEach((tn,ti)=>sj.topics[tn].forEach((x,ui)=>{var s=x.split('|')[1];if(s&&DrillGen.COVERAGE[s])r.push([si,ti,ui,x.split('|')[0]])})));return r})()""")
    for hostile in (False, True):
        if hostile: pg.add_style_tag(content="#row .n,.bl .n,.st .n{font-size:9px!important}")
        for si, ti, ui, t in cov:
            for lvl in (1, 2, 3):
                pg.evaluate(f"__fd.G.si={si};__fd.G.ti={ti};__fd.G.ui={ui};__fd.G.level={lvl};__fd.G.count=10;__fd.startGen({lvl*37+ui})")
                n = pg.evaluate('__fd.data.probs.length')
                for mode in ('guided', 'walk'):
                    pg.evaluate(f"__fd.mode='{mode}';__fd.guardLog=[]")
                    for i in range(n):
                        pg.evaluate(f"__fd.i={i};__fd.s=__fd.data.probs[{i}].steps.length;document.dispatchEvent(new KeyboardEvent('keydown',{{key:'ArrowLeft'}}));document.dispatchEvent(new KeyboardEvent('keydown',{{key:'ArrowRight'}}))")
                        m = pg.evaluate(FRAC)
                        if m: bad.append((hostile, t, lvl, mode, i + 1, 'fraction mismatch', m))
                    log = pg.evaluate("__fd.guardLog")
                    if log and not hostile: bad.append((hostile, t, lvl, mode, 'guard repaired', log[:2]))
                    elif log: repaired.append(1)
print(len(cov), 'topics checked;', 'JS errors:', errs)
if not repaired: bad.append('guard never repaired a hostile numerator: safeguard not working')
print('guard repairs under hostile CSS:', len(repaired))
print('ALL OK' if not bad and not errs else f'{len(bad)} PROBLEMS: {bad[:5]}')
sys.exit(1 if bad or errs else 0)
