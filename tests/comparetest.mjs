import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs'; import vm from 'vm';
vm.runInThisContext(fs.readFileSync('../src/core.js','utf8'));
const C = globalThis.DrillCore;
const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync((process.env.SAMPLES || './samples') + '/grade-4-comparing-proper-fractions-a.pdf')), useSystemFonts: true }).promise;
const pg = [];
for (let p=1;p<=pdf.numPages;p++){ const tc=await (await pdf.getPage(p)).getTextContent(); pg.push(tc.items.map(t=>({str:t.str,x:t.transform[4],y:t.transform[5],size:Math.hypot(t.transform[0],t.transform[1]),width:t.width}))); }
const r = C.parsePage(pg[0]); console.log(r.kind, r.problems.length, 'page2 kind:', C.parsePage(pg[1]).kind);
const got = r.problems.map(p=>{const s=C.solve('compare',p.q); return `${p.q.n1}/${p.q.d1} ${s.slots[0].v.sym} ${p.q.n2}/${p.q.d2}`;});
console.log(got.join(' | '));
const want='<><>><><'.replace('<><>><><','<><>><><'); // placeholder
const exp=['<','>','<','>','>','<','>','<'];
console.log(r.problems.every((p,i)=>C.solve('compare',p.q).slots[0].v.sym===exp[i])?'MATCH KEY':'MISMATCH');
console.log(C.solve('compare',r.problems[0].q).steps.map(s=>s.work.replace(/<[^>]+>/g,'')));
