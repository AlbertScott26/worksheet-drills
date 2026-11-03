import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const SAMPLES = process.env.SAMPLES || './samples';
import fs from 'fs';
import vm from 'vm';
vm.runInThisContext(fs.readFileSync('../src/core.js', 'utf8'));
const C = globalThis.DrillCore;

const exp = {
  improper_to_mixed: [[32,9],[67,12],[116,15],[34,15],[25,12],[41,6],[53,7],[25,4],[127,15],[21,8],[15,4],[33,10],[25,9],[38,7],[99,10],[44,5],[53,15],[41,8],[64,9],[57,10],[16,7],[56,9],[21,10],[67,8],[12,7],[83,12],[36,7],[19,6],[13,2],[22,3],[23,5],[20,7],[76,15],[85,9],[80,9],[41,12],[6,5],[107,15],[63,8],[37,5]],
  mixed_to_improper: [[9,1,9],[3,8,9],[8,7,12],[7,7,9],[3,11,15],[3,2,5],[4,2,7],[7,1,3],[5,1,7],[2,7,10],[3,4,5],[4,5,7],[3,3,8],[6,1,8],[5,5,6],[7,4,15],[4,2,9],[9,1,6],[7,5,8],[1,5,9],[6,4,7],[8,7,15],[6,1,5],[8,1,12],[8,1,15],[7,5,12],[1,3,10],[6,8,15],[1,9,10],[4,6,7],[1,1,4],[1,11,12],[3,4,9],[3,1,10],[2,1,2],[4,3,5],[4,7,8],[6,2,15],[5,3,4],[5,3,7]],
  simplify_proper: [[7,14],[4,20],[14,21],[12,21],[12,18],[5,50],[30,72],[4,40],[12,30],[30,55],[24,33],[24,40],[40,110],[36,40],[2,18],[10,120],[8,96],[50,60],[10,45],[8,64],[9,27],[7,56],[45,54],[30,55],[20,35],[30,36],[10,24],[10,20],[35,56],[4,8],[8,56],[27,99],[4,12],[3,6],[9,54],[9,18],[3,24],[6,16],[24,42],[15,21]],
  simplify_improper: [[63,27],[68,24],[95,35],[78,30],[104,36],[14,12],[22,8],[112,49],[40,25],[63,24],[27,24],[35,21],[88,32],[20,12],[38,18],[81,36],[30,21],[104,48],[66,30],[115,40]]
};

let allOk = true;
for (const f of fs.readdirSync(SAMPLES).filter(x => x.endsWith('.pdf'))) {
  const data = new Uint8Array(fs.readFileSync(SAMPLES + '/' + f));
  const pdf = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items.map(t => ({ str: t.str, x: t.transform[4], y: t.transform[5], size: Math.hypot(t.transform[0], t.transform[1]), width: t.width }));
  const r = C.parsePage(items);
  const got = r.problems.map(p => p.q.w != null ? [p.q.w, p.q.num, p.q.den] : [p.q.num, p.q.den]);
  const want = exp[r.kind];
  if (!want) { console.log(f.slice(0, 40).padEnd(42), r.kind, '(checked in keycheck.mjs)'); continue; }
  const ok = JSON.stringify(got) === JSON.stringify(want);
  allOk = allOk && ok;
  console.log(f.slice(0, 40).padEnd(42), r.kind, got.length, ok ? 'MATCH' : 'MISMATCH');
  if (!ok) got.forEach((g, i) => { if (JSON.stringify(g) !== JSON.stringify(want[i])) console.log('  #' + (i + 1), 'got', g, 'want', want[i]); });
  // step-engine sanity: final slot value must equal the true value
  r.problems.forEach((p, i) => {
    const s = C.solve(r.kind, p.q);
    const last = s.slots[s.slots.length - 1].v;
    const val = v => (v.w || 0) + ((v.num || 0) / (v.den || 1));
    const orig = (p.q.w || 0) + p.q.num / p.q.den;
    if (Math.abs(val(last) - orig) > 1e-9 && r.kind !== 'mixed_to_improper') { console.log('  VALUE MISMATCH', i + 1, p.q, last); allOk = false; }
    if (r.kind === 'mixed_to_improper') { const v = last.num / last.den; if (Math.abs(v - orig) > 1e-9) { console.log('  VALUE MISMATCH', i + 1); allOk = false; } }
    const filled = s.steps.filter(st => st.slot != null).map(st => st.slot).sort().join();
    if (filled !== s.slots.map((_, k) => k).join()) { console.log('  SLOT MISMATCH', i + 1); allOk = false; }
  });
}
console.log(allOk ? 'ALL OK' : 'PROBLEMS');
