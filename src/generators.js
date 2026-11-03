/* Problem generators: make random problems in the exact shape DrillCore.solve() expects.
   Pure functions, no DOM. Each generator: (rnd, level) -> q, level = 1 (easy) | 2 (medium) | 3 (hard).
   COVERAGE maps a catalog sub-topic slug (K5 Learning URL slug) to { kind, level }. */
(function (g) {
  function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

  function rng(seed) {                       /* mulberry32: same seed, same worksheet */
    let a = (seed >>> 0) || 1;
    const f = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }


  /* ---------- column arithmetic helpers ---------- */
  const pickD = (r, d) => Array.isArray(d) ? r.pick(d) : d;
  const nDigits = (r, d) => { let t = String(r.int(1, 9)); for (let i = 1; i < d; i++) t += r.int(0, 9); return Number(t); };
  function carryCount(A) {
    let c = 0, n = 0; const W = Math.max.apply(null, A.map(x => String(x).length));
    for (let i = 0; i < W; i++) { let t = c; A.forEach(x => { const t2 = String(x), k = t2.length - 1 - i; if (k >= 0) t += +t2[k]; }); c = Math.floor(t / 10); if (c) n++; }
    return n;
  }
  function borrowCount(a, b) {
    const cur = String(a).split('').reverse().map(Number), B = String(b).split('').reverse().map(Number); let n = 0;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] < (B[i] || 0)) { n++; let j = i + 1; while (cur[j] === 0) j++; cur[j]--; for (let k = i + 1; k < j; k++) cur[k] = 9; cur[i] += 10; }
    }
    return n;
  }

  const DEN = { 1: [2, 3, 4, 5, 6], 2: [2, 3, 4, 5, 6, 8, 10], 3: [3, 4, 5, 6, 7, 8, 9, 10, 12] };

  const GEN = {
    improper_to_mixed(r, L) {
      const d = r.pick(DEN[L]);
      let n; do { n = r.int(d + 1, d * (L === 1 ? 3 : L === 2 ? 5 : 9)); } while (n % d === 0);
      return { w: null, num: n, den: d };
    },
    mixed_to_improper(r, L) {
      const d = r.pick(DEN[L]);
      return { w: r.int(1, L === 1 ? 4 : L === 2 ? 9 : 19), num: r.int(1, d - 1), den: d };
    },
    simplify_proper(r, L) {
      for (;;) {
        const d0 = r.int(2, L === 1 ? 4 : 7), n0 = r.int(1, d0 - 1);
        if (gcd(n0, d0) !== 1) continue;
        const k = r.int(2, L === 1 ? 3 : L === 2 ? 6 : 9);
        return { w: null, num: n0 * k, den: d0 * k };
      }
    },
    simplify_improper(r, L) {
      for (;;) {
        const d0 = r.int(2, L === 1 ? 4 : 7), n0 = r.int(d0 + 1, d0 * 3);
        if (gcd(n0, d0) !== 1 || n0 % d0 === 0) continue;
        const k = r.int(2, L === 1 ? 3 : L === 2 ? 5 : 8);
        return { w: null, num: n0 * k, den: d0 * k };
      }
    },
    complete_whole(r, L) {
      const d = r.pick(DEN[L]), W = r.int(1, L === 1 ? 2 : L === 2 ? 3 : 5);
      return { num: r.int(1, W * d - 1), den: d, target: W };
    },
    compare(r, L) {
      for (;;) {
        const d1 = r.pick(DEN[L]), d2 = r.pick(DEN[L]);
        const n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1);
        if (d1 === d2 && L > 1) continue;
        if (n1 * d2 === n2 * d1 && r.int(1, 4) > 1) continue;       /* equal pairs only now and then */
        return { n1, d1, n2, d2 };
      }
    },
    compare_mixed(r, L) {
      const one = () => {
        const d = r.pick(DEN[L]), kind = r.int(1, 3);
        if (kind === 1) return { w: 0, n: r.int(d + 1, d * 3), d };                /* improper */
        if (kind === 2) return { w: r.int(1, L === 1 ? 3 : 6), n: r.int(1, d - 1), d };  /* mixed */
        return { w: 0, n: r.int(1, d - 1), d };                                    /* proper */
      };
      for (;;) {
        const a = one(), b = one();
        if (a.d === b.d && a.w === b.w && a.n === b.n) continue;
        return { a, b };
      }
    },
    fraction_of_set(r, L) {
      const b = r.pick(L === 1 ? [2, 3, 4] : L === 2 ? [2, 3, 4, 5, 6] : [3, 4, 5, 6, 7, 8, 9]);
      return { a: r.int(1, L === 1 ? 1 : b - 1), b, N: b * r.int(2, L === 1 ? 4 : L === 2 ? 6 : 9) };
    },

    add_cols(r, L, o) {
      o = o || { n: 2, d: 3 };
      const d = pickD(r, o.d), n = o.n || 2;
      let best = null;
      for (let t = 0; t < 1500; t++) {
        const A = []; for (let i = 0; i < n; i++) A.push(nDigits(r, d));
        const k = carryCount(A);
        best = A;
        if (L === 1 ? k <= Math.max(1, Math.ceil(d / 3)) : L === 2 ? k >= 1 : k >= Math.min(d, d + n - 3)) break;
      }
      return { addends: best };
    },
    sub_cols(r, L, o) {
      o = o || { d: 3 };
      const mf = o.mf || 'rand';
      let best = null;
      for (let t = 0; t < 2500; t++) {
        let a, b, d = pickD(r, o.d || 3);
        if (mf === 'zeros2') { a = r.int(2, 9) * 1000 + r.int(1, 8); b = nDigits(r, 4); }
        else if (mf === 'zeros3') { a = r.int(2, 9) * 10000 + r.int(1, 8); b = nDigits(r, r.pick([4, 5])); }
        else if (mf === 'p1000') { a = 1000; b = nDigits(r, r.pick([2, 3, 3])); }
        else if (mf === 'wholeK') { a = r.int(2, 9) * 1000; b = nDigits(r, r.pick([3, 4])); }
        else if (mf === 'wholeH') { a = r.int(2, 9) * 100; b = nDigits(r, 2); }
        else { a = nDigits(r, d); b = nDigits(r, o.sd || d); }
        if (b >= a) continue;
        const k = borrowCount(a, b); best = { a, b };
        if (mf !== 'rand') { if (k >= 1) break; continue; }
        if (L === 1 ? k === 1 : L === 2 ? k >= 1 : k >= Math.max(1, d - 1)) break;
      }
      return best;
    },

    mul_cols(r, L, o) {
      o = o || { d1: 3, d2: 1 };
      const dig = (d, lo, hi, leadLo) => { let t = String(r.int(Math.max(leadLo, 1), hi)); for (let i = 1; i < d; i++) t += r.int(lo, hi); return Number(t); };
      const rg = L === 1 ? [0, 5, 1] : L === 2 ? [0, 9, 1] : [5, 9, 5];            /* digit low, high, leading low */
      const mg = L === 1 ? [2, 4, 2] : L === 2 ? [2, 9, 2] : [6, 9, 6];
      return { a: dig(o.d1, rg[0], rg[1], rg[2]), b: dig(o.d2, mg[0], mg[1], mg[2]) };
    },

    div_cols(r, L, o) {
      o = o || { d: 2, rem: 'none' };
      const lo = Math.pow(10, o.d - 1), hi = Math.pow(10, o.d) - 1;
      for (let t = 0; t < 3000; t++) {
        const v = L === 1 ? r.int(2, 5) : L === 3 ? r.int(6, 9) : r.int(2, 9);
        const rem = o.rem === 'none' || o.rem === 'facts' ? 0 : (r.int(1, 8) > 1 || L === 3 ? r.int(1, v - 1) : 0);
        const qlo = o.rem === 'facts' ? 2 : Math.ceil(lo / v), qhi = o.rem === 'facts' ? 9 : Math.floor((hi - rem) / v);
        if (qhi < qlo) continue;
        const qq = r.int(qlo, qhi), a = qq * v + rem, qs = String(qq);
        if (a < v || (o.rem !== 'facts' && String(a).length !== o.d)) continue;
        const zeros = qs.indexOf('0') >= 0;
        if (L === 1 && zeros) continue;
        if (L === 3 && o.d >= 3 && !zeros && t < 2000) continue;
        return { a, b: v };
      }
      return { a: 84, b: 4 };
    },
    order3(r, L) {
      for (;;) {
        const vs = [];
        for (let i = 0; i < 3; i++) {
          const d = r.pick(DEN[L]);
          vs.push(L === 3 && r.int(0, 1) ? { w: r.int(1, 3), n: r.int(1, d - 1), d } : { w: 0, n: r.int(1, d - 1), d });
        }
        const val = v => (v.w * v.d + v.n) / v.d, x = vs.map(val);
        if (new Set(x.map(t => t.toFixed(6))).size < 3) continue;
        return { v: vs, dir: r.int(0, 1) ? '>' : '<' };
      }
    }
  };

  /* K5 Learning Grade 4 slug -> generator kind (+ level). Everything not listed here is "planned". */
  const COVERAGE = {
    'improper-fractions-to-mixed-numbers': { kind: 'improper_to_mixed', level: 1 },
    'improper-fractions-to-mixed-numbers-harder': { kind: 'improper_to_mixed', level: 3 },
    'mixed-numbers-to-improper-fractions': { kind: 'mixed_to_improper', level: 1 },
    'mixed-numbers-to-improper-fractions-harder': { kind: 'mixed_to_improper', level: 3 },
    'adding-improper-fractions': { kind: 'complete_whole', level: 2 },
    'adding-mixed-numbers': { kind: 'complete_whole', level: 3 },
    'comparing-proper-fractions': { kind: 'compare', level: 1 },
    'comparing-fractions-unlike-denominators': { kind: 'compare', level: 2 },
    'comparing-proper-and-improper-fractions': { kind: 'compare_mixed', level: 2 },
    'comparing-mixed-numbers-and-fractions': { kind: 'compare_mixed', level: 2 },
    'comparing-fractions-improper-mixed': { kind: 'compare_mixed', level: 3 },
    'ordering-3-fractions': { kind: 'order3', level: 2 },
    'fractional-part-of-set': { kind: 'fraction_of_set', level: 2 },
    'add-3-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 2, d: 3 } },
    'add-3-3-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 3, d: 3 } },
    'add-4-3-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 4, d: 3 } },
    'add-5-3-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 5, d: 3 } },
    'add-4-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 2, d: 4 } },
    'add-3-4-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 3, d: 4 } },
    'add-4-4-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 4, d: 4 } },
    'add-5-4-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 5, d: 4 } },
    'add-5or6-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 2, d: [5, 6] } },
    'add-three-5or6-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 3, d: [5, 6] } },
    'add-four-5or6-digit-numbers-in-columns': { kind: 'add_cols', level: 2, opts: { n: 4, d: [5, 6] } },
    'subtract-2-digit-numbers': { kind: 'sub_cols', level: 2, opts: { d: 2 } },
    'subtract-3-digit-numbers-with-regrouping': { kind: 'sub_cols', level: 2, opts: { d: 3 } },
    'subtract-4-digit-numbers-with-regrouping': { kind: 'sub_cols', level: 2, opts: { d: 4 } },
    'subtract-5or6-digit-numbers': { kind: 'sub_cols', level: 2, opts: { d: [5, 6] } },
    'subtract-borrow-across-2-zeros': { kind: 'sub_cols', level: 2, opts: { mf: 'zeros2' } },
    'subtract-borrow-across-3-zeros': { kind: 'sub_cols', level: 2, opts: { mf: 'zeros3' } },
    'subtract-from-1000': { kind: 'sub_cols', level: 2, opts: { mf: 'p1000' } },
    'subtract-from-whole-thousands': { kind: 'sub_cols', level: 2, opts: { mf: 'wholeK' } },
    'subtract-2-digit-number-from-whole-hundreds': { kind: 'sub_cols', level: 2, opts: { mf: 'wholeH' } },
    'multiply-columns-1-digit-2-digit': { kind: 'mul_cols', level: 2, opts: { d1: 2, d2: 1 } },
    'multiply-columns-1-digit-3-digit': { kind: 'mul_cols', level: 2, opts: { d1: 3, d2: 1 } },
    'multiply-columns-1-digit-4-digit': { kind: 'mul_cols', level: 2, opts: { d1: 4, d2: 1 } },
    'multiply-columns-2-digit-2-digit': { kind: 'mul_cols', level: 2, opts: { d1: 2, d2: 2 } },
    'multiply-columns-2-digit-3-digit': { kind: 'mul_cols', level: 2, opts: { d1: 3, d2: 2 } },
    'multiply-columns-2-digit-4-digit': { kind: 'mul_cols', level: 2, opts: { d1: 4, d2: 2 } },
    'multiply-columns-3-digit-3-digit': { kind: 'mul_cols', level: 2, opts: { d1: 3, d2: 3 } },
    'long-division-basic-facts': { kind: 'div_cols', level: 2, opts: { d: 2, rem: 'facts' } },
    'single-digit-division-no-remainder': { kind: 'div_cols', level: 2, opts: { d: 2, rem: 'none' } },
    'long-division-with-remainder-within-1-100': { kind: 'div_cols', level: 2, opts: { d: 2, rem: 'maybe' } },
    'long-division-3x1-digit-no-remainder': { kind: 'div_cols', level: 2, opts: { d: 3, rem: 'none' } },
    'long-division-3x1-digit-with-remainder': { kind: 'div_cols', level: 2, opts: { d: 3, rem: 'maybe' } },
    'long-division-4x1-digit-no-remainder': { kind: 'div_cols', level: 2, opts: { d: 4, rem: 'none' } },
    'long-division-4x1-digit-with-remainder': { kind: 'div_cols', level: 2, opts: { d: 4, rem: 'maybe' } },
  };

  function generate(kind, count, level, seed, opts) {
    const r = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed), out = [], seen = {};
    for (let i = 0, guard = 0; out.length < count && guard < count * 60; guard++) {
      const q = GEN[kind](r, level, opts), key = JSON.stringify(q);
      if (seen[key]) continue;                       /* no repeated problems on one sheet */
      seen[key] = 1; out.push({ q }); i++;
    }
    return out;
  }

  g.DrillGen = { GEN, COVERAGE, generate, rng, kinds: Object.keys(GEN) };
  if (typeof module !== 'undefined') module.exports = g.DrillGen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
