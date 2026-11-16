import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url);
const C = (() => { const g = {}; new Function('globalThis', 'module', fs.readFileSync(new URL('../src/core.js', import.meta.url), 'utf8') + ';return globalThis')(g, undefined); return g.DrillCore; })();
const G = require('../src/generators.js');
const cat = JSON.parse(fs.readFileSync(new URL('../catalog/k5-grade4.json', import.meta.url)));
let bad = 0, total = 0; const gcd = (a, b) => b ? gcd(b, a % b) : a;
for (const kind of G.kinds) for (const L of [1, 2, 3]) for (let seed = 1; seed <= 150; seed++) {
  const probs = G.generate(kind, 12, L, seed * 7919 + L);
  if (probs.length < 8) { console.log('too few distinct', kind, L, probs.length); bad++; }
  for (const p of probs) { total++; try { const s = C.solve(kind, p.q); if (!s.steps.length || !s.slots) throw new Error('empty'); } catch (e) { bad++; if (bad < 8) console.log('FAIL', kind, L, JSON.stringify(p.q), e.message); } }
}
/* every coverage entry (with its own options) x level x seed; column problems are also checked against plain arithmetic */
for (const [slug, cv] of Object.entries(G.COVERAGE)) for (const L of [1, 2, 3]) for (let seed = 1; seed <= 60; seed++) {
  const probs = G.generate(cv.kind, 8, L, seed * 131 + L, cv.opts);
  if (probs.length < 5) { console.log('too few problems', slug, L, probs.length); bad++; }
  for (const p of probs) {
    total++;
    try {
      const sv = C.solve(cv.kind, p.q);
      if (/^dec_(cmp|order|h|add_cols|sub_cols|money)$/.test(cv.kind)) {
        const q = p.q, P = n => Math.pow(10, n), dof = (v, d) => { const t = String(v).padStart(d + 1, '0'); return d ? t.slice(0, -d) + '.' + t.slice(-d) : t; }, strip = h => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        if (cv.kind === 'dec_cmp') {
          const dp = Math.max(q.pa, q.pb), A = q.a * P(dp - q.pa), B = q.b * P(dp - q.pb);
          if (sv.slots[0].v.sym !== (A < B ? '<' : A > B ? '>' : '=')) throw new Error('dec_cmp ' + JSON.stringify(q));
        } else if (cv.kind === 'dec_order') {
          const dp = Math.max(...q.ps), sc = q.v.map((x, i) => x * P(dp - q.ps[i])), srt = q.v.map((x, i) => i).sort((i, j) => q.dir === '<' ? sc[i] - sc[j] : sc[j] - sc[i]);
          const want = srt.map(i => dof(q.v[i], q.ps[i])).join(' ' + q.dir + ' '), got = strip(sv.steps[sv.steps.length - 1].work);
          if (new Set(sc).size !== 3 || got !== want) throw new Error('dec_order ' + got + ' vs ' + want);
        } else if (cv.kind === 'dec_h') {
          const dp = Math.max(q.pa, q.pb), A = q.a * P(dp - q.pa), B = q.b * P(dp - q.pb), R = q.op === '+' ? A + B : A - B;
          const hid = q.miss === 'a' ? A : q.miss === 'b' ? B : R;
          if (R <= 0 || sv.slots[0].v.w !== dof(hid, dp) || strip(sv.steps[sv.steps.length - 1].work) !== 'Answer: ' + dof(hid, dp)) throw new Error('dec_h ' + JSON.stringify(q));
        } else if (cv.kind === 'dec_add_cols') {
          const sum = q.addends.reduce((x, y) => x + y, 0); if (sv.col.answer !== dof(sum, q.dp) || sv.col.dp !== q.dp) throw new Error('dec_add_cols ' + JSON.stringify(q));
          if (strip(sv.steps[sv.steps.length - 1].work) !== 'Answer: ' + dof(sum, q.dp)) throw new Error('dec add answer text');
        } else if (cv.kind === 'dec_sub_cols') {
          if (q.a <= q.b || sv.col.answer !== dof(q.a - q.b, q.dp)) throw new Error('dec_sub_cols ' + JSON.stringify(q));
        } else {
          const want = '$' + dof(q.p === 1 ? q.t * 10 : q.t, 2); if (sv.slots[0].v.w !== want) throw new Error('money ' + JSON.stringify(q));
        }
      } else if (cv.kind === 'dec_to_frac' || cv.kind === 'frac_to_dec') {
        const q = p.q, sl = sv.slots[0], w = q.w || 0;
        if (cv.kind === 'dec_to_frac') {
          const B = q.p === 1 ? 10 : 100, v = sl.v; if (w !== (v.w || 0) || v.num * B !== q.N * v.den || gcd(v.num, v.den) !== 1 || v.num >= v.den) throw new Error('dec_to_frac ' + JSON.stringify(q));
          if (sv.row[0].v.w !== (w + '.' + String(q.N).padStart(q.p, '0'))) throw new Error('dec text');
        } else {
          const got = String(sl.v.w), want = ''; if (Math.abs(Number(got) - (w + q.n / q.d)) > 1e-9 || /\.\d*0$/.test(got) || !/^\d+\.\d{1,2}$/.test(got)) throw new Error('frac_to_dec ' + JSON.stringify(q) + ' ' + got);
        }
        if (sv.steps.filter(s => s.slot === 0).length !== 1) throw new Error('slot step');
      } else if (cv.kind === 'frac_add' || cv.kind === 'frac_sub' || cv.kind === 'equiv') {
        const q = p.q, sl = sv.slots[0], uv = (v, d) => (v.w || 0) * d + (v.num || 0);
        if (cv.kind === 'equiv') {
          if (sl.v.num * q.d !== q.n * sl.v.den || sl.v.den !== q.d * q.k || sl.v.num !== q.n * q.k) throw new Error('equiv ' + JSON.stringify(q));
          if (!(sl.q && (sl.q.num === '?' || sl.q.den === '?'))) throw new Error('equiv hidden');
        } else {
          const d = q.d, tot = x => x.w * d + x.n, got = uv(sl.v, d);
          if (sl.v.den != null && sl.v.den !== d) throw new Error('denominator changed');
          const want = cv.kind === 'frac_add' ? tot(q.a) + tot(q.b) : q.miss ? tot(q.b) : tot(q.a) - tot(q.b);
          if (got !== want || want <= 0) throw new Error('frac answer ' + got + ' vs ' + want + ' ' + JSON.stringify(q));
          if (sl.v.num != null && gcd(sl.v.num, d) !== 1) throw new Error('not lowest terms ' + JSON.stringify(q));
          if (cv.kind === 'frac_sub' && tot(q.a) <= tot(q.b)) throw new Error('negative');
        }
        if (sv.steps.length < 2 || sv.steps.filter(s => s.slot === 0).length !== 1) throw new Error('steps');
      } else if (cv.kind === 'fact') {
        const q = p.q, ev = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b }[q.op];
        if (ev(q.t[0], q.t[1]) !== q.r || !Number.isInteger(q.r) || q.r <= 0 || q.t.some(x => x <= 0)) throw new Error('fact math ' + JSON.stringify(q));
        const hid = q.miss === 'r' ? q.r : q.miss === 'x' ? q.t[0] : q.t[1];
        if (sv.slots[0].v.w !== hid || !sv.fact || sv.steps.length !== 1) throw new Error('fact slot');
      } else if (sv.col && sv.col.kind === 'div') {
        const Qw = Math.floor(p.q.a / p.q.b), Rw = p.q.a % p.q.b, f1 = sv.col.frames[sv.col.frames.length - 1];
        if (f1.q.join('').replace(/^0+/, '') !== String(Qw) || (f1.q.join('')[0] === '0')) throw new Error('quotient ' + f1.q.join('') + ' vs ' + Qw);
        if ((f1.rtxt || '') !== (Rw ? 'r ' + Rw : '')) throw new Error('remainder text ' + f1.rtxt + ' vs ' + Rw);
        if (sv.col.frames.length !== sv.steps.length + 1) throw new Error('frames/steps mismatch');
        if (p.q.b < 2 || p.q.a < p.q.b) throw new Error('bad division problem');
      } else if (sv.col) {
        const want = cv.kind === 'add_cols' ? p.q.addends.reduce((a, b) => a + b, 0) : cv.kind === 'mul_cols' ? p.q.a * p.q.b : p.q.a - p.q.b;
        const last = sv.col.frames[sv.col.frames.length - 1], got = last.ans.slice().reverse().join('');
        if (String(want) !== got || sv.col.answer !== String(want)) throw new Error('wrong column answer ' + got + ' vs ' + want);
        if (sv.col.frames.length !== sv.steps.length + 1) throw new Error('frames/steps mismatch');
        if (cv.kind === 'sub_cols' && (p.q.a <= p.q.b)) throw new Error('negative');
        if (cv.kind === 'mul_cols') { const f0 = sv.col.frames[sv.col.frames.length - 1]; if (sv.col.parts) { const sum = f0.parts.reduce((t2, row) => t2 + Number(row.slice().reverse().join('')), 0); if (sum !== want) throw new Error('partials sum ' + sum + ' vs ' + want); } }
      }
    } catch (e) { bad++; if (bad < 8) console.log('FAIL', slug, L, JSON.stringify(p.q), e.message); }
  }
}
const slugs = new Set(); for (const s of cat.subjects) for (const t of Object.values(s.topics)) for (const x of t) { const p = x.split('|'); if (p[1]) slugs.add(p[1]); }
for (const k of Object.keys(G.COVERAGE)) if (!slugs.has(k)) { console.log('coverage slug not in catalog:', k); bad++; }
for (const [k, v] of Object.entries(G.COVERAGE)) if (!G.GEN[v.kind]) { console.log('no generator', k); bad++; }
console.log(total, 'problems solved;', bad ? bad + ' PROBLEMS' : 'ALL OK');
process.exit(bad ? 1 : 0);
