import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs'; import vm from 'vm';
vm.runInThisContext(fs.readFileSync('../src/core.js','utf8'));
const C = globalThis.DrillCore, dir = process.env.SAMPLES || './samples';
async function load(f){ const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(dir+'/'+f)), useSystemFonts: true, verbosity:0 }).promise;
  const pg=[]; for (let p=1;p<=pdf.numPages;p++){ const tc=await (await pdf.getPage(p)).getTextContent(); pg.push(tc.items.map(t=>({str:t.str,x:t.transform[4],y:t.transform[5],size:Math.hypot(t.transform[0],t.transform[1]),width:t.width}))); } return pg; }
function parse(pg){ let kind=null, probs=[]; pg.forEach(it=>{const r=C.parsePage(it); if(r.kind){kind=r.kind; probs=probs.concat(r.problems);}}); return {kind,probs}; }
let ok=true;
// compare_mixed: key = symbols on page 2 matched to labels by position
{ const pg=await load('grade-4-comparing-fractions-improper-mixed-a.pdf'); const {kind,probs}=parse(pg);
  const labels=pg[1].filter(o=>/^\d+\.$/.test(o.str.trim())&&o.size<14), syms=pg[1].filter(o=>/^[<>=]$/.test(o.str.trim()));
  const key={}; labels.forEach(l=>{ const s=syms.filter(y=>Math.abs(y.y-l.y)<45&&y.x>l.x&&y.x<l.x+190).sort((a,b)=>a.x-b.x)[0]; key[parseInt(l.str)]=s?s.str.trim():'?'; });
  const got=probs.map(p=>C.solve(kind,p.q).slots[0].v.sym); const want=Object.keys(key).sort((a,b)=>a-b).map(k=>key[k]);
  const m=got.join('')===want.join(''); ok=ok&&m; console.log('compare_mixed',kind,probs.length,m?'MATCH KEY':'MISMATCH',got.join(''),want.join('')); }
// fraction_of_set A/C
for (const f of ['grade-4-fractional-part-set-a.pdf','grade-4-fractional-part-set-c.pdf']) { const pg=await load(f); const {kind,probs}=parse(pg);
  const got=probs.map(p=>C.solve(kind,p.q).slots[0].v.w);
  // key: answer digit right after each "What is" line on page 2, in reading order
  const q2=pg[1].filter(o=>/^What is/.test(o.str)); const want=q2.sort((a,b)=>Math.abs(a.y-b.y)>8?b.y-a.y:a.x-b.x).map(q=>+pg[1].find(o=>Math.abs(o.y-q.y)<4&&/^\d+$/.test(o.str.trim())&&o.x>q.x).str);
  const m=JSON.stringify(got)===JSON.stringify(want); ok=ok&&m; console.log(f,kind,probs.length,m?'MATCH KEY':'MISMATCH',got,want); }
// order3
{ const pg=await load('grade-4-ordering-3-fractions-a.pdf'); const {kind,probs}=parse(pg);
  console.log('order3',kind,probs.length); probs.forEach((p,i)=>{ const st=C.solve(kind,p.q).steps; console.log(i+1,p.q.dir,JSON.stringify(p.q.v.map(v=>[v.w,v.n,v.d])),'→',st[st.length-2].work.replace(/<[^>]+>/g,'')); }); }
console.log(ok?'ALL OK':'PROBLEMS');
