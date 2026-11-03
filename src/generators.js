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
    'fractional-part-of-set': { kind: 'fraction_of_set', level: 2 }
  };

  function generate(kind, count, level, seed) {
    const r = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed), out = [], seen = {};
    for (let i = 0, guard = 0; out.length < count && guard < count * 60; guard++) {
      const q = GEN[kind](r, level), key = JSON.stringify(q);
      if (seen[key]) continue;                       /* no repeated problems on one sheet */
      seen[key] = 1; out.push({ q }); i++;
    }
    return out;
  }

  g.DrillGen = { GEN, COVERAGE, generate, rng, kinds: Object.keys(GEN) };
  if (typeof module !== 'undefined') module.exports = g.DrillGen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
