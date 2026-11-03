import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url);
const C = (() => { const g = {}; new Function('globalThis', 'module', fs.readFileSync(new URL('../src/core.js', import.meta.url), 'utf8') + ';return globalThis')(g, undefined); return g.DrillCore; })();
const G = require('../src/generators.js');
const cat = JSON.parse(fs.readFileSync(new URL('../catalog/k5-grade4.json', import.meta.url)));
let bad = 0, total = 0;
for (const kind of G.kinds) for (const L of [1, 2, 3]) for (let seed = 1; seed <= 150; seed++) {
  const probs = G.generate(kind, 12, L, seed * 7919 + L);
  if (probs.length < 8) { console.log('too few distinct', kind, L, probs.length); bad++; }
  for (const p of probs) { total++; try { const s = C.solve(kind, p.q); if (!s.steps.length || !s.slots) throw new Error('empty'); } catch (e) { bad++; if (bad < 8) console.log('FAIL', kind, L, JSON.stringify(p.q), e.message); } }
}
const slugs = new Set(); for (const s of cat.subjects) for (const t of Object.values(s.topics)) for (const x of t) { const p = x.split('|'); if (p[1]) slugs.add(p[1]); }
for (const k of Object.keys(G.COVERAGE)) if (!slugs.has(k)) { console.log('coverage slug not in catalog:', k); bad++; }
for (const [k, v] of Object.entries(G.COVERAGE)) if (!G.GEN[v.kind]) { console.log('no generator', k); bad++; }
console.log(total, 'problems solved;', bad ? bad + ' PROBLEMS' : 'ALL OK');
process.exit(bad ? 1 : 0);
