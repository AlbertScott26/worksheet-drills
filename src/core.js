/* Fraction Drills core: worksheet detection, problem parsing, and the step engine.
   Pure functions, no DOM. Works in the browser and in Node (used for testing). */
(function (g) {
  const KINDS = {
    improper_to_mixed: { label: 'IMPROPER → MIXED NUMBER', title: 'Converting Fractions · Improper to Mixed', whole: false, firstEq: false },
    mixed_to_improper: { label: 'MIXED NUMBER → IMPROPER', title: 'Converting Fractions · Mixed to Improper', whole: true, firstEq: false },
    simplify_proper: { label: 'SIMPLIFY TO LOWEST TERMS', title: 'Simplifying Proper Fractions', whole: false, firstEq: false },
    simplify_improper: { label: 'SIMPLIFY, THEN MIXED NUMBER', title: 'Simplifying Improper Fractions', whole: false, firstEq: true },
    complete_whole: { label: 'COMPLETE THE WHOLE NUMBER', title: 'Completing a Whole Number', whole: false, firstEq: false },
    compare: { label: 'COMPARING FRACTIONS', title: 'Comparing Fractions', whole: false, firstEq: false },
    compare_mixed: { label: 'COMPARING MIXED NUMBERS', title: 'Comparing Fractions and Mixed Numbers', whole: false, firstEq: false },
    fraction_of_set: { label: 'FRACTION OF A SET', title: 'Fractional Part of a Set', whole: false, firstEq: false },
    order3: { label: 'ORDERING FRACTIONS', title: 'Ordering Three Fractions', whole: false, firstEq: false },
    fact: { label: 'QUICK FACTS', title: 'Quick Facts', whole: false, firstEq: false },
    add_cols: { label: 'ADD IN COLUMNS', title: 'Adding in Columns', whole: false, firstEq: false },
    sub_cols: { label: 'SUBTRACT IN COLUMNS', title: 'Subtracting in Columns', whole: false, firstEq: false },
    mul_cols: { label: 'MULTIPLY IN COLUMNS', title: 'Multiplying in Columns', whole: false, firstEq: false },
    div_cols: { label: 'LONG DIVISION', title: 'Long Division', whole: false, firstEq: false }
  };

  function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

  function detect(text) {
    const t = String(text).toLowerCase().replace(/\s+/g, ' ');
    if (t.includes('simplifying improper')) return 'simplify_improper';
    if (t.includes('simplifying proper')) return 'simplify_proper';
    if (t.includes('completing a whole number')) return 'complete_whole';
    if (t.includes('word problems')) return null;
    if (/comparing proper & improper|comparing proper and improper/.test(t)) return 'compare_mixed';
    if (/comparing (proper )?fractions/.test(t)) return 'compare';
    if (t.includes('fractional part of a set')) return 'fraction_of_set';
    if (/ordering (3 |three )?fractions/.test(t)) return 'order3';
    if (t.includes('improper fraction to a mixed')) return 'improper_to_mixed';
    if (t.includes('mixed fraction to an improper') || t.includes('mixed number to an improper')) return 'mixed_to_improper';
    return null;
  }

  /* items: [{str, x, y, size, width}] for ONE page. y is the PDF baseline (bottom-up). */
  function parsePage(rawItems) {
    const it = rawItems
      .filter(o => o.str && o.str.trim())
      .map(o => ({ s: o.str.trim(), x: o.x, y: o.y, sz: o.size, w: o.width, cy: o.y + 0.35 * o.size }));
    const kind = detect(it.map(o => o.s).join(' '));
    if (!kind) return { kind: null, problems: [] };
    const K = KINDS[kind];
    if (kind === 'complete_whole') return parseComplete(it);
    if (it.some(o => o.s === 'Answers') || (kind === 'compare_mixed' && it.filter(o => /^[<>=]$/.test(o.s)).length >= 3)) return { kind, problems: [], isKey: true };   // answer page: skipped, answers are recomputed
    if (kind === 'compare') return parseCompare(it);
    if (kind === 'compare_mixed') return parseCompareMixed(it);
    if (kind === 'fraction_of_set') return parseFractionOfSet(it);
    if (kind === 'order3') return parseOrder3(it);

    let eqs = it.filter(o => o.s === '=');
    if (K.firstEq) {
      eqs = eqs.filter(e => !eqs.some(o => o !== e && Math.abs(o.cy - e.cy) < 2 && o.x < e.x && e.x - o.x < 100));
    }
    const digits = it.filter(o => /^\d+$/.test(o.s));
    const labels = it.filter(o => /^\d+\.$/.test(o.s));

    const probs = eqs.map(e => {
      const left = digits.filter(o => o.x + o.w <= e.x + 0.8 && o.x >= e.x - 70 && Math.abs(o.cy - e.cy) < 32);
      const join = a => a.sort((p, q) => p.x - q.x).map(o => o.s).join('');
      const num = join(left.filter(o => o.cy > e.cy + 2.5));
      const den = join(left.filter(o => o.cy < e.cy - 2.5));
      const mid = join(left.filter(o => Math.abs(o.cy - e.cy) <= 2.5));
      if (!num || !den || (K.whole && !mid)) {
        throw new Error('Could not read the problem near x=' + Math.round(e.x) + ', y=' + Math.round(e.y));
      }
      const q = { w: K.whole ? +mid : null, num: +num, den: +den };
      // printed problem number: nearest label to the left in the same row band
      let label = null, bd = 1e9;
      labels.forEach(l => {
        const dx = e.x - l.x;
        if (dx > 0 && Math.abs(l.cy - e.cy) < 30 && dx < bd) { bd = dx; label = parseInt(l.s, 10); }
      });
      return { q, x: e.x, y: e.y, label };
    });

    const numbered = probs.length > 0 && probs.every(p => p.label != null) &&
      new Set(probs.map(p => p.label)).size === probs.length;
    if (numbered) {
      probs.sort((a, b) => a.label - b.label);
    } else {
      // reading order: top row first, then left to right
      probs.sort((a, b) => (Math.abs(a.y - b.y) > 6 ? b.y - a.y : a.x - b.x));
    }
    return { kind, problems: probs.map(p => ({ q: p.q })) };
  }

  /* "n/d + _____ = W" worksheets (K5 Learning style). Items are numbered "1)", "2)" ... */
  function parseComplete(it) {
    const plus = it.filter(o => /^\+\s*_+\s*=\s*\d+$/.test(o.s));
    const digits = it.filter(o => /^\d+$/.test(o.s));
    const labels = it.filter(o => /^\d+\)$/.test(o.s));
    const join = a => a.sort((p, q) => p.x - q.x).map(o => o.s).join('');
    const probs = plus.map(pl => {
      const left = digits.filter(o => o.x + o.w <= pl.x + 0.8 && o.x >= pl.x - 60 && Math.abs(o.cy - pl.cy) < 32);
      const num = join(left.filter(o => o.cy > pl.cy + 3));
      const den = join(left.filter(o => o.cy < pl.cy - 3));
      if (!num || !den) throw new Error('Could not read the problem near x=' + Math.round(pl.x) + ', y=' + Math.round(pl.y));
      let label = null, bd = 1e9;
      labels.forEach(l => {
        const dx = pl.x - l.x;
        if (dx > 0 && Math.abs(l.cy - pl.cy) < 30 && dx < bd) { bd = dx; label = parseInt(l.s, 10); }
      });
      return { q: { num: +num, den: +den, target: +pl.s.match(/(\d+)$/)[1] }, x: pl.x, y: pl.y, label };
    });
    const numbered = probs.length > 0 && probs.every(p => p.label != null) && new Set(probs.map(p => p.label)).size === probs.length;
    if (numbered) probs.sort((a, b) => a.label - b.label);
    else probs.sort((a, b) => (Math.abs(a.y - b.y) > 6 ? b.y - a.y : a.x - b.x));
    return { kind: 'complete_whole', problems: probs.map(p => ({ q: p.q })) };
  }


  /* "a/b ○ c/d" worksheets: stacked fractions in pairs, answer is <, > or =. Numbered "1)" ... */
  function parseCompare(it) {
    const digits = it.filter(o => /^\d+$/.test(o.s) && o.sz >= 14).sort((a, b) => b.y - a.y);
    const used = new Set(), fracs = [];
    digits.forEach(u => {
      if (used.has(u)) return;
      const ucx = u.x + u.w / 2;
      let best = null;
      digits.forEach(l => {
        if (l === u || used.has(l)) return;
        const dy = u.y - l.y;
        if (dy > 10 && dy < 40 && Math.abs(l.x + l.w / 2 - ucx) < 10 && (!best || dy < u.y - best.y)) best = l;
      });
      if (!best) return;
      used.add(u); used.add(best);
      fracs.push({ n: +u.s, d: +best.s, cx: ucx, top: u.y });
    });
    if (!fracs.length) throw new Error('Could not find the fractions on this worksheet.');
    // group into rows by height, then pair neighbours left to right
    fracs.sort((a, b) => b.top - a.top);
    const rows = [];
    fracs.forEach(f => { const r = rows.find(r => Math.abs(r[0].top - f.top) < 12); if (r) r.push(f); else rows.push([f]); });
    const pairs = [];
    rows.forEach(r => {
      r.sort((a, b) => a.cx - b.cx);
      if (r.length % 2) throw new Error('A comparison is missing a fraction (found an odd number in one row).');
      for (let i = 0; i < r.length; i += 2) pairs.push({ a: r[i], b: r[i + 1] });
    });
    const labels = it.filter(o => /^\d+\)$/.test(o.s) && o.sz < 14);
    pairs.forEach(p => {
      let best = null, bd = 1e9;
      labels.forEach(l => {
        const dx = p.a.cx - l.x, dy = l.y - p.a.top;
        if (dx > 0 && dy > 0 && dy < 160) { const d = Math.hypot(dx * 0.5, dy); if (d < bd) { bd = d; best = parseInt(l.s, 10); } }
      });
      p.label = best;
    });
    const numbered = pairs.every(p => p.label != null) && new Set(pairs.map(p => p.label)).size === pairs.length;
    if (numbered) pairs.sort((a, b) => a.label - b.label);
    return { kind: 'compare', problems: pairs.map(p => ({ q: { n1: p.a.n, d1: p.a.d, n2: p.b.n, d2: p.b.d } })) };
  }

  /* ----- shared: read stacked fractions and mixed numbers from loose number items ----- */
  function readValues(nums) {
    const used = new Set(), fracs = [];
    const sorted = nums.slice().sort((a, b) => b.y - a.y);
    sorted.forEach(u => {
      if (used.has(u)) return;
      let best = null;
      sorted.forEach(l => {
        if (l === u || used.has(l)) return;
        const dy = u.y - l.y;
        if (dy > 6 && dy < 40 && Math.abs(l.sz - u.sz) < 1.5 && Math.abs((l.x + l.w / 2) - (u.x + u.w / 2)) < 10 && (!best || dy < u.y - best.y)) best = l;
      });
      if (!best) return;
      used.add(u); used.add(best);
      fracs.push({ n: +u.s, d: +best.s, x0: Math.min(u.x, best.x), x1: Math.max(u.x + u.w, best.x + best.w), mid: (u.cy + best.cy) / 2, x: Math.min(u.x, best.x) });
    });
    const wholes = nums.filter(o => !used.has(o));
    const vals = fracs.map(f => ({ w: 0, n: f.n, d: f.d, x: f.x0, f: f }));
    wholes.forEach(w => {
      const f = vals.find(v => !v.hasW && v.x - (w.x + w.w) > -3 && v.x - (w.x + w.w) < 20 && Math.abs(w.cy - v.f.mid) < 12);
      if (f) { f.w = +w.s; f.hasW = true; f.x = w.x; }
      else vals.push({ w: +w.s, n: 0, d: 1, x: w.x, f: null, hasW: true });
    });
    return vals.sort((a, b) => a.x - b.x).map(v => ({ w: v.w, n: v.n, d: v.d, x: v.x }));
  }
  const toImp = v => ({ n: v.w * v.d + v.n, d: v.d });

  /* "n. [value] ( ) [value]" worksheets with mixed numbers (K5 style). */
  function parseCompareMixed(it) {
    const labels = it.filter(o => /^\d+\.$/.test(o.s) && o.sz < 14);
    const nums = it.filter(o => /^\d+$/.test(o.s));
    if (!labels.length) throw new Error('Could not find the numbered problems.');
    const probs = labels.map(l => {
      const nxt = labels.filter(m => m !== l && Math.abs(m.y - l.y) < 20 && m.x > l.x + 20).map(m => m.x).sort((a, b) => a - b)[0];
      const x1 = nxt != null ? nxt - 8 : 1e9;
      const cell = nums.filter(o => o.x > l.x + 6 && o.x < x1 && o.y < l.y + 22 && o.y > l.y - 50);
      const v = readValues(cell);
      if (v.length !== 2) throw new Error('Problem ' + l.s + ' did not read as two numbers (found ' + v.length + ').');
      return { q: { a: { w: v[0].w, n: v[0].n, d: v[0].d }, b: { w: v[1].w, n: v[1].n, d: v[1].d } }, label: parseInt(l.s, 10) };
    });
    probs.sort((p, q) => p.label - q.label);
    return { kind: 'compare_mixed', problems: probs.map(p => ({ q: p.q })) };
  }

  /* "What is a/b of N?" worksheets (fractional part of a set). */
  function parseFractionOfSet(it) {
    const hits = it.map(o => { const m = o.s.match(/^What is (\d+)\s*\/\s*(\d+) of (\d+)\s*\?$/i); return m ? { q: { a: +m[1], b: +m[2], N: +m[3] }, x: o.x, y: o.y } : null; }).filter(Boolean);
    hits.sort((p, q) => (Math.abs(p.y - q.y) > 8 ? q.y - p.y : p.x - q.x));
    return { kind: 'fraction_of_set', problems: hits.map(h => ({ q: h.q })) };
  }

  /* three fractions per problem, plus a "___ > ___ > ___" line that says the direction. */
  function parseOrder3(it) {
    const nums = it.filter(o => /^\d+$/.test(o.s) && o.sz >= 14);
    const vals = [];
    const rowsSrc = nums.slice().sort((a, b) => b.y - a.y);
    // split into rows by vertical gaps
    const bands = [];
    rowsSrc.forEach(o => { const b = bands.find(b => Math.abs(b.y - o.y) < 45); if (b) { b.items.push(o); b.y = Math.min(b.y, o.y); } else bands.push({ y: o.y, items: [o] }); });
    const lines = it.filter(o => /_{2,}/.test(o.s) && /[<>]/.test(o.s));
    const probs = [];
    bands.sort((a, b) => b.y - a.y).forEach(b => {
      const v = readValues(b.items);
      if (v.length % 3) throw new Error('A row of fractions did not split into groups of three.');
      const top = Math.max.apply(null, b.items.map(o => o.y));
      const ln = lines.filter(l => l.y < b.y && top - l.y < 200 && l.y > b.y - 200).sort((p, q) => q.y - p.y);
      const lineY = ln.length ? ln[0].y : null;
      const syms = [];
      ln.filter(l => Math.abs(l.y - lineY) < 6).sort((p, q) => p.x - q.x).forEach(l => (l.s.match(/[<>]/g) || []).forEach(c => syms.push(c)));
      const groups = v.length / 3;
      for (let g = 0; g < groups; g++) {
        const dir = syms[g * 2];
        if (!dir) throw new Error('Could not read the > or < direction for one problem.');
        probs.push({ q: { v: v.slice(g * 3, g * 3 + 3).map(x => ({ w: x.w, n: x.n, d: x.d })), dir: dir } });
      }
    });
    return { kind: 'order3', problems: probs };
  }

  const fr = (a, b) => '<span class="ifr"><span>' + a + '</span><span>' + b + '</span></span>';
  const mix = (w, n, d) => '<span class="imx"><span class="iw">' + w + '</span>' + fr(n, d) + '</span>';
  const GCF_WHY = 'The GCF is the biggest number that divides both evenly.';

  /* Returns {slots:[{v}], steps:[{work, why, slot?}]}. A step with `slot: k` fills answer slot k. */

  /* ---------- column arithmetic (add / subtract) ----------
     solve returns { col: { op, lines, W, ansLen, frames }, slots: [], steps }.
     frames[k] is what the board shows after k steps (frames.length === steps.length + 1). */
  const PL = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions'];
  const PS = ['one', 'ten', 'hundred', 'thousand', 'ten thousand', 'hundred thousand', 'million'];
  const CAP = w => w.charAt(0).toUpperCase() + w.slice(1);
  const unit = (n, c) => n + ' ' + (n === 1 ? PS[c] : PL[c]);
  const fmtN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cellsOf = (n, W) => { const t = String(n), o = []; for (let c = 0; c < W; c++) o.push(c < t.length ? t[t.length - 1 - c] : ''); return o; };

  function solveAdd(q) {
    const A = q.addends, sum = A.reduce((x, y) => x + y, 0), W = String(sum).length;
    const maxLen = Math.max.apply(null, A.map(n => String(n).length));
    const lines = A.map(n => ({ cells: cellsOf(n, W) }));
    const blank = () => Array(W).fill('');
    let carry = 0, ans = blank(), cr = blank();
    const frames = [{ hi: -1, ans: ans.slice(), carry: cr.slice() }], steps = [];
    for (let c = 0; c < maxLen; c++) {
      const ds = lines.map(l => l.cells[c]).filter(x => x !== '').map(Number);
      const total = carry + ds.reduce((x, y) => x + y, 0), last = c === maxLen - 1;
      const terms = (carry ? [carry] : []).concat(ds);
      const put = (last || total < 10) ? String(total) : String(total % 10);
      for (let k = 0; k < put.length; k++) ans[c + k] = put[put.length - 1 - k];
      const out = (last || total < 10) ? 0 : Math.floor(total / 10);
      if (out && c + 1 < W) cr[c + 1] = String(out);
      let work = CAP(PL[c]) + ': ' + terms.join(' + ') + ' = ' + total + '<br>' + (out ? 'write <b>' + put + '</b>, carry <b>' + out + '</b>' : 'write <b>' + put + '</b>');
      let why;
      if (out) why = total + ' ' + PL[c] + ' is ' + unit(out, c + 1) + ' and ' + unit(total % 10, c) + ', so write ' + (total % 10) + ' and carry ' + out + '.';
      else if (last && total >= 10) why = 'There is no column to the left, so write all of ' + total + '.';
      else if (carry) why = 'Add the carried ' + carry + ' too. The total is under 10, so write it.';
      else why = 'The total is under 10, so just write it.';
      steps.push({ work: work, why: why });
      carry = out;
      frames.push({ hi: c, ans: ans.slice(), carry: cr.slice() });
    }
    steps.push({ work: 'Answer: <b>' + fmtN(sum) + '</b>', why: 'No more columns, so the answer is the number under the line.' });
    frames.push({ hi: -1, ans: ans.slice(), carry: cr.slice() });
    return { col: { op: '+', lines: lines, W: W, ansLen: W, frames: frames, answer: String(sum) }, slots: [], steps: steps };
  }

  function solveSub(q) {
    const a = q.a, b = q.b, diff = a - b, W = String(a).length, dl = String(diff).length;
    if (diff <= 0) throw new Error('Subtraction needs a bigger top number.');
    const top = cellsOf(a, W).map(Number), bot = cellsOf(b, W), cur = top.slice();
    const nv = Array(W).fill(''), st = Array(W).fill(false), ans = Array(W).fill('');
    const snap = hi => ({ hi: hi, ans: ans.slice(), top: nv.map((v, i) => ({ nv: v, st: st[i] })) });
    const frames = [snap(-1)], steps = [];
    for (let c = 0; c < W; c++) {
      const bd = bot[c] === '' ? 0 : Number(bot[c]);
      let regrouped = false;
      if (cur[c] < bd) {
        let j = c + 1; while (cur[j] === 0) j++;
        const before = cur.slice(), ch = [];
        cur[j] -= 1; for (let k = c + 1; k < j; k++) cur[k] = 9; cur[c] += 10;
        for (let k = j; k >= c; k--) { nv[k] = String(cur[k]); st[k] = true; ch.push(PL[k] + ' ' + before[k] + ' → <b>' + cur[k] + '</b>'); }
        const work = CAP(PL[c]) + ': ' + before[c] + ' is less than ' + bd + '<br>regroup: ' + ch.join(', ');
        const why = j === c + 1 ? 'Not enough ' + PL[c] + '. Trade 1 ' + PS[j] + ' for 10 ' + PL[c] + '.'
          : 'The next columns are 0, so borrow from the ' + PL[j] + '. Each 0 in between becomes 9.';
        steps.push({ work: work, why: why }); frames.push(snap(c));
        regrouped = true;
      }
      const r = cur[c] - bd, lead = c >= dl;
      if (!lead) ans[c] = String(r);
      let work, why;
      if (bot[c] === '') { work = CAP(PL[c]) + ': nothing to subtract<br>bring down <b>' + (lead ? '' : r) + '</b>'; why = 'There is no bottom digit here, so bring the top digit down.'; }
      else { work = CAP(PL[c]) + ': ' + cur[c] + ' − ' + bd + ' = <b>' + r + '</b>'; why = regrouped ? 'Now there are enough ' + PL[c] + ', so subtract.' : (nv[c] ? 'Use the new digit after trading, then subtract.' : 'Subtract the digits in the ' + PL[c] + ' column.'); }
      if (lead) { work = CAP(PL[c]) + ': ' + cur[c] + ' − ' + bd + ' = 0'; why = 'A zero at the front is not written.'; }
      steps.push({ work: work, why: why }); frames.push(snap(c));
    }
    steps.push({ work: 'Answer: <b>' + fmtN(diff) + '</b>', why: 'Check: ' + fmtN(diff) + ' + ' + fmtN(b) + ' = ' + fmtN(a) + '.' });
    frames.push(snap(-1));
    return { col: { op: '−', lines: [{ cells: cellsOf(a, W) }, { cells: cellsOf(b, W) }], W: W, ansLen: dl, frames: frames, answer: String(diff) }, slots: [], steps: steps };
  }

  function solveMul(q) {
    const a = q.a, b = q.b, prod = a * b, W = String(prod).length;
    const aD = String(a).split('').reverse().map(Number), bD = String(b).split('').reverse().map(Number);
    const n = aD.length, k = bD.length, blank = () => Array(W).fill('');
    let ans = blank(), cr = blank(), parts = []; for (let j = 0; j < (k > 1 ? k : 0); j++) parts.push(blank());
    const snap = hl => ({ hl: hl, ans: ans.slice(), carry: cr.slice(), parts: parts.map(p => p.slice()) });
    const frames = [snap({})], steps = [];
    for (let j = 0; j < k; j++) {
      const m = bD[j], tgt = k === 1 ? ans : parts[j];
      if (j > 0) {
        for (let z = 0; z < j; z++) tgt[z] = '0';
        cr = blank();
        steps.push({ work: 'Multiply by the ' + PL[j] + ' digit: <b>' + m + '</b><br>put ' + (j === 1 ? 'a <b>0</b>' : j + ' <b>0</b>s') + ' first',
          why: (j === 1 ? 'Tens' : j === 2 ? 'Hundreds' : CAP(PL[j])) + ' mean ' + (j === 1 ? 'ten' : j === 2 ? 'a hundred' : '10 × 10 × …') + ' times as much, so the ' + (j === 1 ? 'ones place holds a 0.' : 'places to the right hold 0s.') });
        frames.push(snap({ b: j }));
      }
      let carry = 0;
      for (let c = 0; c < n; c++) {
        const t = aD[c], p = t * m, total = p + carry, last = c === n - 1;
        const put = last ? String(total) : String(total % 10), out = last ? 0 : Math.floor(total / 10);
        for (let x = 0; x < put.length; x++) tgt[c + j + x] = put[put.length - 1 - x];
        if (out && c + 1 < W) cr[c + 1] = String(out);
        const calc = t + ' × ' + m + ' = ' + p + (carry ? ', plus ' + carry + ' = ' + total : '');
        const work = CAP(PL[c + j]) + ': ' + calc + '<br>' + (out ? 'write <b>' + put + '</b>, carry <b>' + out + '</b>' : 'write <b>' + put + '</b>');
        let why;
        if (out) why = total + ' ' + PL[c + j] + ' is ' + unit(out, c + j + 1) + ' and ' + unit(total % 10, c + j) + ', so write ' + (total % 10) + ' and carry ' + out + '.';
        else if (last && total >= 10) why = 'There are no more digits to multiply, so write all of ' + total + '.';
        else why = 'The total is under 10, so just write it.';
        steps.push({ work: work, why: why });
        carry = out;
        frames.push(snap({ a: c, b: j, ['p' + j]: c + j }));
      }
    }
    if (k > 1) {
      const rows = parts.map(p => Number(p.slice().reverse().join('')));
      ans = cellsOf(prod, W);
      steps.push({ work: 'Add the rows<br>' + rows.map(fmtN).join(' + ') + ' = <b>' + fmtN(prod) + '</b>', why: 'Add the partial products to get the total.' });
    } else {
      steps.push({ work: 'Answer: <b>' + fmtN(prod) + '</b>', why: 'No more digits to multiply, so the answer is under the line.' });
    }
    frames.push(snap({}));
    const lines = [{ cells: cellsOf(a, W) }, { cells: cellsOf(b, W) }];
    return { col: { op: '×', lines: lines, W: W, ansLen: W, parts: k > 1 ? k : 0, frames: frames, answer: String(prod) }, slots: [], steps: steps };
  }

  /* ---------- long division (divisor 1 digit) ----------
     col.kind === 'div'. Frames hold: q (quotient digit per column), rows (work rows under the bracket), hd (highlighted dividend columns), hr (highlighted row), rtxt. */
  function solveDiv(q) {
    const a = q.a, v = q.b, dg = String(a).split('').map(Number), n = dg.length;
    const Q = Math.floor(a / v), R = a % v;
    if (v < 1 || v > 9) throw new Error('One-digit divisors only.');
    const qd = Array(n).fill(''), rows = [];
    const snap = (hd, hr, rtxt) => ({ q: qd.slice(), rows: rows.map(r => ({ cells: r.cells.slice(), minus: r.minus, ul: r.ul })), hd: hd || [], hr: hr == null ? -1 : hr, rtxt: rtxt || '' });
    const frames = [snap()], steps = [];
    let s = 0, cur = dg[0]; while (cur < v && s < n - 1) { s++; cur = cur * 10 + dg[s]; }
    let prevRem = 0;
    const put = (str, col) => { const cells = Array(n).fill(''); for (let k = 0; k < str.length; k++) cells[col - k] = str[str.length - 1 - k]; return cells; };
    for (let i = s; i < n; i++) {
      const first = i === s, digit = Math.floor(cur / v), prod = digit * v, rem = cur - prod;
      const startCol = first ? 0 : (prevRem > 0 || String(cur).length > 1 ? i - 1 : i);
      const used = []; for (let c = startCol; c <= i; c++) used.push(c);
      qd[i] = String(digit);
      let work = String(cur) + ' ÷ ' + v + ' = <b>' + digit + '</b>';
      if (first && s > 0) work = dg.slice(0, s).join('') + ' is too small, so use ' + cur + '<br>' + work;
      const why = digit === 0 ? cur + ' is less than ' + v + ', so ' + v + ' fits 0 times. Write 0.'
        : 'How many ' + v + 's fit in ' + cur + '? ' + v + ' × ' + digit + ' = ' + prod + '. Any more would be too big.';
      steps.push({ work: work, why: why }); frames.push(snap(used, -1));
      rows.push({ cells: put(String(prod), i), minus: true, ul: true });
      steps.push({ work: v + ' × ' + digit + ' = <b>' + prod + '</b>', why: 'Write ' + prod + ' under ' + cur + ', lined up on the right.' });
      frames.push(snap([], rows.length - 1));
      rows.push({ cells: put(String(rem), i), minus: false, ul: false });
      steps.push({ work: cur + ' − ' + prod + ' = <b>' + rem + '</b>', why: i === n - 1 ? (rem ? 'This is what is left over, the remainder.' : 'Nothing is left over, so there is no remainder.') : 'What is left over must be less than ' + v + '. ' + rem + ' is, so the digit is right.' });
      frames.push(snap([], rows.length - 1));
      if (i < n - 1) {
        const nd = dg[i + 1], nxt = rem * 10 + nd;
        rows[rows.length - 1].cells[i + 1] = String(nd);
        steps.push({ work: 'Bring down <b>' + nd + '</b><br>new number: ' + nxt, why: 'Bring the next digit down next to the leftover.' });
        frames.push(snap([i + 1], rows.length - 1));
        prevRem = rem; cur = nxt;
      }
    }
    steps.push({ work: 'Answer: <b>' + Q + (R ? ' r ' + R : '') + '</b>', why: 'Check: ' + v + ' × ' + Q + (R ? ' + ' + R : '') + ' = ' + a + '.' });
    frames.push(snap([], -1, R ? 'r ' + R : ''));
    return { col: { kind: 'div', W: n, divisor: v, dividend: dg.map(String), lines: [], frames: frames, answer: Q + (R ? ' r ' + R : '') }, slots: [], steps: steps };
  }

  /* Quick facts: one equation, one hidden number. No steps; the slot is revealed in one press. */
  function solveFact(q) {
    const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[q.op], t = q.t, r = q.r, row = [];
    const v = x => ({ t: 'v', v: { w: x } }), op = s => ({ t: 'op', s: s });
    let hidden;
    if (q.miss === 'r') { t.forEach((x, i) => { if (i) row.push(op(sym)); row.push(v(x)); }); row.push(op('=')); row.push({ t: 'slot', k: 0 }); hidden = r; }
    else {
      const mi = q.miss === 'x' ? 0 : 1; hidden = t[mi];
      t.forEach((x, i) => { if (i) row.push(op(sym)); row.push(i === mi ? { t: 'slot', k: 0 } : v(x)); });
      row.push(op('=')); row.push(v(r));
    }
    return { row: row, slots: [{ v: { w: hidden } }], steps: [{ work: '', why: '', slot: 0 }], fact: true };
  }
  function solve(kind, q) {
    if (kind === 'fact') return solveFact(q);
    if (kind === 'div_cols') return solveDiv(q);
    if (kind === 'mul_cols') return solveMul(q);
    if (kind === 'add_cols') return solveAdd(q);
    if (kind === 'sub_cols') return solveSub(q);
    const n = q.num, d = q.den;
    if (kind === 'compare' || kind === 'compare_mixed') {
      const steps = [];
      let A, B, rowA, rowB;
      if (kind === 'compare') { A = { n: q.n1, d: q.d1 }; B = { n: q.n2, d: q.d2 }; rowA = { num: q.n1, den: q.d1 }; rowB = { num: q.n2, den: q.d2 }; }
      else {
        const side = v => v.n === 0 ? { w: v.w } : (v.w ? { w: v.w, num: v.n, den: v.d } : { num: v.n, den: v.d });
        rowA = side(q.a); rowB = side(q.b);
        A = toImp(q.a); B = toImp(q.b);
        const conv = [q.a, q.b].filter(v => v.w && v.n).map(v => mix(v.w, v.n, v.d) + ' = ' + fr('<b>' + (v.w * v.d + v.n) + '</b>', v.d));
        if (conv.length) steps.push({ work: conv.join('&nbsp;&nbsp;·&nbsp;&nbsp;'), why: 'Whole number × bottom + top, over the same bottom.' });
      }
      const a = A.n, b = A.d, c = B.n, d = B.d;
      const L = b * d / gcd(b, d), x = a * (L / b), y = c * (L / d);
      const sym = x < y ? '<' : x > y ? '>' : '=';
      const symH = sym === '<' ? '&lt;' : sym === '>' ? '&gt;' : '=';
      if (b === d) {
        steps.push({ work: 'Same bottom number: <b>' + b + '</b>', why: 'When the bottoms match, just compare the tops.' });
      } else {
        steps.push({ work: 'Common bottom number: <b>' + L + '</b>', why: 'Rewrite both fractions with the same bottom so they can be compared.' });
        if (L / b > 1) steps.push({ work: fr(a, b) + ' = ' + fr('<b>' + x + '</b>', L), why: 'Multiply top and bottom by ' + (L / b) + '.' });
        if (L / d > 1) steps.push({ work: fr(c, d) + ' = ' + fr('<b>' + y + '</b>', L), why: 'Multiply top and bottom by ' + (L / d) + '.' });
      }
      steps.push({
        work: fr(x, L) + ' <b>' + symH + '</b> ' + fr(y, L),
        why: x === y ? 'The tops are equal, so the fractions are equal.' : x + ' is ' + (x < y ? 'less' : 'greater') + ' than ' + y + ', so the first one is ' + (x < y ? 'smaller' : 'larger') + '.',
        slot: 0
      });
      return {
        row: [{ t: 'v', v: rowA }, { t: 'slot', k: 0 }, { t: 'v', v: rowB }],
        slots: [{ v: { sym: sym } }],
        steps: steps
      };
    }
    if (kind === 'fraction_of_set') {
      const a = q.a, b = q.b, N = q.N;
      const grp = N / b, ans = grp * a;
      const num = v => Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
      const steps = [{ work: N + ' ÷ ' + b + ' = <b>' + num(grp) + '</b>', why: 'The bottom number is how many equal groups. Each group has ' + num(grp) + '.' }];
      if (a === 1) steps.push({ work: 'Take <b>1</b> group = <b>' + num(ans) + '</b>', why: 'The top number is 1, so the answer is one group.', slot: 0 });
      else steps.push({ work: num(grp) + ' × ' + a + ' = <b>' + num(ans) + '</b>', why: 'The top number is ' + a + ', so take ' + a + ' groups.', slot: 0 });
      return {
        row: [{ t: 'v', v: { num: a, den: b } }, { t: 'op', s: 'of' }, { t: 'v', v: { w: N } }, { t: 'op', s: '=' }, { t: 'slot', k: 0 }],
        slots: [{ v: { w: Number(num(ans)) } }],
        steps: steps
      };
    }
    if (kind === 'order3') {
      const vs = q.v, desc = q.dir === '>';
      const imp = vs.map(toImp);
      const anyMixed = vs.some(v => v.w && v.n);
      const L = imp.reduce((acc, f) => acc * f.d / gcd(acc, f.d), 1);
      const tops = imp.map(f => f.n * (L / f.d));
      const orig = vs.map(v => v.n === 0 ? String(v.w) : (v.w ? mix(v.w, v.n, v.d) : fr(v.n, v.d)));
      const idx = [0, 1, 2].sort((i, j) => desc ? tops[j] - tops[i] : tops[i] - tops[j]);
      const symH = desc ? '&gt;' : '&lt;';
      const steps = [];
      if (anyMixed) steps.push({ work: vs.map((v, i) => (v.w && v.n) ? mix(v.w, v.n, v.d) + ' = ' + fr('<b>' + imp[i].n + '</b>', imp[i].d) : '').filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;'), why: 'Change each mixed number to an improper fraction first.' });
      const sameDen = imp.every(f => f.d === imp[0].d);
      if (sameDen) steps.push({ work: 'Same bottom number: <b>' + L + '</b>', why: 'The bottoms match, so compare the tops.' });
      else {
        steps.push({ work: 'Common bottom number: <b>' + L + '</b>', why: 'Rewrite all three fractions with the same bottom.' });
        steps.push({ work: imp.map((f, i) => fr(f.n, f.d) + ' = ' + fr('<b>' + tops[i] + '</b>', L)).join('&nbsp;&nbsp;·&nbsp;&nbsp;'), why: 'Multiply the top and bottom of each fraction by the same number.' });
      }
      steps.push({ work: 'Tops in order: <b>' + idx.map(i => tops[i]).join(' ' + symH + ' ') + '</b>', why: 'Put the tops in order. The bottoms are all ' + L + '.' });
      steps.push({ work: idx.map(i => orig[i]).join(' <b>' + symH + '</b> '), why: 'Write the original fractions in that order.' });
      const row = [];
      vs.forEach((v, i) => { if (i) row.push({ t: 'op', s: '·' }); row.push({ t: 'v', v: v.n === 0 ? { w: v.w } : (v.w ? { w: v.w, num: v.n, den: v.d } : { num: v.n, den: v.d }) }); });
      return { row: row, slots: [], steps: steps, hdr: desc ? 'ORDER: GREATEST → LEAST' : 'ORDER: LEAST → GREATEST' };
    }
    if (kind === 'complete_whole') {
      const W = q.target, total = W * d, m = total - n;
      if (m <= 0) throw new Error('Not a completing problem: ' + n + '/' + d + ' is already ' + W + ' or more.');
      return {
        row: [{ t: 'v', v: { num: n, den: d } }, { t: 'op', s: '+' }, { t: 'slot', k: 0 }, { t: 'op', s: '=' }, { t: 'v', v: { w: W } }],
        slots: [{ v: { num: m, den: d } }],
        steps: [
          { work: W + ' = ' + fr(total, d), why: 'Each whole is ' + d + '/' + d + ', so ' + W + ' wholes is ' + W + ' \u00d7 ' + d + ' = ' + total + ' pieces.' },
          { work: total + ' \u2212 ' + n + ' = <b>' + m + '</b>', why: 'Take away the pieces we already have to find the pieces still needed.' },
          { work: 'Missing fraction: ' + fr(m, d), why: 'The pieces are still ' + d + 'ths, so the bottom number stays ' + d + '.', slot: 0 },
          { work: 'Check: ' + fr(n, d) + ' + ' + fr(m, d) + ' = ' + fr(total, d) + ' = <b>' + W + '</b>', why: 'Add the tops, keep the bottom. ' + total + ' \u00f7 ' + d + ' = ' + W + '.' }
        ]
      };
    }
    if (kind === 'improper_to_mixed') {
      const w = Math.floor(n / d), r = n % d;
      if (r === 0) {
        return {
          slots: [{ v: { w: w } }],
          steps: [
            { work: n + ' ÷ ' + d + ' = <b>' + w + '</b>', why: 'The fraction bar means divide: top ÷ bottom.' },
            { work: 'Answer: <b>' + w + '</b>', why: 'No remainder, so it is a whole number. Check: ' + w + ' × ' + d + ' = ' + n + '.', slot: 0 }
          ]
        };
      }
      return {
        slots: [{ v: { w: w, num: r, den: d } }],
        steps: [
          { work: n + ' ÷ ' + d + ' = <b>' + w + '</b> r <b>' + r + '</b>', why: 'The fraction bar means divide: top ÷ bottom.' },
          { work: 'Whole number: <b>' + w + '</b>', why: w + ' × ' + d + ' = ' + (w * d) + ', so ' + w + ' whole groups of ' + d + ' fit inside ' + n + '.' },
          { work: 'Leftover: ' + fr(r, d), why: 'The remainder ' + r + ' goes on top. The pieces are still ' + d + 'ths, so the bottom stays ' + d + '.' },
          { work: 'Answer: ' + mix(w, r, d), why: 'Check: ' + w + ' × ' + d + ' + ' + r + ' = ' + n + ' ✓', slot: 0 }
        ]
      };
    }
    if (kind === 'mixed_to_improper') {
      const w = q.w, p = w * d, t = p + n;
      return {
        slots: [{ v: { num: t, den: d } }],
        steps: [
          { work: w + ' × ' + d + ' = <b>' + p + '</b>', why: 'Each whole is ' + d + ' pieces of size 1/' + d + '. Count the pieces in the wholes.' },
          { work: p + ' + ' + n + ' = <b>' + t + '</b>', why: 'Add the pieces from the fraction part to get the total number of pieces.' },
          { work: 'Answer: ' + fr(t, d), why: 'The pieces are still ' + d + 'ths, so the bottom number stays ' + d + '.', slot: 0 }
        ]
      };
    }
    const g = gcd(n, d), n2 = n / g, d2 = d / g;
    if (kind === 'simplify_proper') {
      if (g === 1) {
        return {
          slots: [{ v: { num: n, den: d } }],
          steps: [
            { work: 'GCF of ' + n + ' and ' + d + ' = <b>1</b>', why: GCF_WHY },
            { work: 'Answer: ' + fr(n, d), why: 'Only 1 divides both numbers, so it is already in lowest terms.', slot: 0 }
          ]
        };
      }
      return {
        slots: [{ v: { num: n2, den: d2 } }],
        steps: [
          { work: 'GCF of ' + n + ' and ' + d + ' = <b>' + g + '</b>', why: GCF_WHY },
          { work: 'Top: ' + n + ' ÷ ' + g + ' = <b>' + n2 + '</b>', why: 'Divide the numerator by the GCF.' },
          { work: 'Bottom: ' + d + ' ÷ ' + g + ' = <b>' + d2 + '</b>', why: 'Divide the denominator by the same number so the value stays equal.' },
          { work: 'Answer: ' + fr(n2, d2), why: 'Check: ' + n2 + ' and ' + d2 + ' share no factor except 1.', slot: 0 }
        ]
      };
    }
    // simplify_improper: simplify first, then change to a mixed number
    const steps = [];
    if (g === 1) {
      steps.push({ work: 'GCF of ' + n + ' and ' + d + ' = <b>1</b>', why: GCF_WHY });
      steps.push({ work: 'Already in lowest terms: ' + fr(n, d), why: 'Only 1 divides both numbers, so there is nothing to simplify.', slot: 0 });
    } else {
      steps.push({ work: 'GCF of ' + n + ' and ' + d + ' = <b>' + g + '</b>', why: GCF_WHY });
      steps.push({ work: 'Top: ' + n + ' ÷ ' + g + ' = <b>' + n2 + '</b>', why: 'Divide the numerator by the GCF.' });
      steps.push({
        work: 'Bottom: ' + d + ' ÷ ' + g + ' = <b>' + d2 + '</b>',
        why: d2 === 1 ? 'A bottom number of 1 means a whole number: ' + n2 + '.' : 'Divide the denominator by the same number so the value stays equal.',
        slot: 0
      });
    }
    if (d2 === 1) {
      return { slots: [{ v: { w: n2 } }], steps: steps };
    }
    const w = Math.floor(n2 / d2), r = n2 % d2;
    steps.push({ work: n2 + ' ÷ ' + d2 + ' = <b>' + w + '</b> r <b>' + r + '</b>', why: 'Now change the improper fraction to a mixed number: top ÷ bottom.' });
    steps.push({ work: 'Answer: ' + mix(w, r, d2), why: 'Whole number ' + w + ', remainder ' + r + ' over ' + d2 + '. Check: ' + w + ' × ' + d2 + ' + ' + r + ' = ' + n2 + ' ✓', slot: 1 });
    return { slots: [{ v: { num: n2, den: d2 } }, { v: { w: w, num: r, den: d2 } }], steps: steps };
  }


  /* ---------- generic worksheets (any subject) ---------- */
  function toLines(items) {
    let its = items.filter(o => o.str && o.str.trim()).map(o => Object.assign({}, o, { str: o.str.normalize('NFKC') }));
    // small stacked numbers inside a sentence (like 2 over 3) become "2/3"
    const numIts = its.filter(o => /^\d+$/.test(o.str.trim()));
    const gone = new Set(), merged = [];
    numIts.sort((a, b) => b.y - a.y).forEach(u => {
      if (gone.has(u)) return;
      const l = numIts.find(m => m !== u && !gone.has(m) && u.y - m.y > 6 && u.y - m.y < 24 && Math.abs(m.size - u.size) < 1 && Math.abs((m.x + m.width / 2) - (u.x + u.width / 2)) < 8);
      if (!l) return;
      gone.add(u); gone.add(l);
      const sz = u.size * 1.4;
      merged.push({ isFrac: true, str: u.str.trim() + '/' + l.str.trim(), x: Math.min(u.x, l.x), y: (u.y + l.y) / 2, size: sz, width: Math.max(u.width, l.width) * 2 });
    });
    its = its.filter(o => !gone.has(o)).concat(merged).sort((a, b) => b.y - a.y || a.x - b.x);
    const out = [];
    its.forEach(o => {
      const L = out.length ? out[out.length - 1] : null;
      if (L && Math.abs(L.y - o.y) < Math.max(2, 0.5 * Math.max(L.size, o.size))) L.parts.push(o);
      else out.push({ y: o.y, size: o.size, parts: [o] });
    });
    const res = [];
    out.forEach(L => {
      L.parts.sort((a, b) => a.x - b.x);
      let seg = [], prev = null;
      const flush = () => {
        if (!seg.length) return;
        let t = '', pv = null;
        seg.forEach(o => {
          if (pv) { const gap = o.x - (pv.x + pv.width); if ((gap > 0.2 * L.size || o.isFrac || pv.isFrac) && !/\s$/.test(t) && !/^\s/.test(o.str)) t += ' '; }
          t += o.str; pv = o;
        });
        t = t.replace(/\s+/g, ' ').trim();
        if (t) res.push({ y: L.y, x: seg[0].x, size: L.size, text: t });
        seg = [];
      };
      L.parts.forEach(o => {
        if (prev && o.x - (prev.x + prev.width) > 2.2 * L.size) flush();   // wide gap = another column
        seg.push(o); prev = o;
      });
      flush();
    });
    return res;
  }
  const LABEL = /^\(?(\d{1,3})\s*[.)]\s*(.*)$/;

  function parseGeneric(pages) {
    const items = [], answers = [];
    let inKey = false, ctx = [];
    pages.forEach(pg => {
      const lines = toLines(pg).filter(l => !/k5learning|^©|^(online )?reading (&|and) math/i.test(l.text));
      const labelX = lines.filter(l => LABEL.test(l.text)).map(l => l.x).sort((a, b) => a - b);
      // split into columns when numbered lines sit at clearly different x positions
      let cols = [lines];
      if (labelX.length >= 4) {
        const lo = labelX[0], hi = labelX[labelX.length - 1];
        if (hi - lo > 200) {
          const mid = (lo + hi) / 2;
          const right = lines.filter(l => l.x >= mid - 40), left = lines.filter(l => l.x < mid - 40);
          if (labelX.filter(x => x < mid).length >= 2 && labelX.filter(x => x >= mid).length >= 2) cols = [left, right];
        }
      }
      const sizes = lines.map(l => l.size).sort((a, b) => a - b), med = sizes.length ? sizes[sizes.length >> 1] : 12;
      let pending = [], cur = null;
      cols.forEach((col, ci) => {
        cur = null;
        col.forEach(l => {
          if (/^(answer\s*key|answers?|key)\b[\s:]*$/i.test(l.text) || /^answer\s*key\b/i.test(l.text)) { inKey = true; cur = null; return; }
          const m = l.text.match(LABEL);
          if (m) {
            if (!inKey && pending.length) { ctx = pending.slice(); pending = []; }
            cur = { n: +m[1], lines: m[2] ? [m[2]] : [], ctx: ctx.join(' ') };
            (inKey ? answers : items).push(cur);
          } else if (cur) {
            cur.lines.push(l.text);
          } else if (!inKey && ci === 0) {
            if (l.size > 1.1 * med) return;                       // title
            if (/^(name|date|class|period|score)\b|^page\s*\d|k5learning|^©|^(online )?reading (&|and) math|^grade \d/i.test(l.text)) return;
            pending.push(l.text);
          }
        });
      });
    });
    const clean = a => a.map(o => ({ n: o.n, text: o.lines.reduce((acc, t, i) => i === 0 ? t : acc + (/^\(?[A-Ha-h][.)]\s|^[•\-–]\s/.test(t) ? '\n' : ' ') + t, '').trim(), ctx: (o.ctx || '').slice(0, 700) }));
    const its = clean(items).filter(o => o.text && /[^\d\s]/.test(o.text)), ans = clean(answers);   // digits-only items are figures, not questions
    let hasKey = false;
    if (ans.length && its.length) {
      if (ans.length === its.length) { its.forEach((o, i) => { o.answer = ans[i].text; }); hasKey = true; }
      else {
        const byN = {}; ans.forEach(a => { (byN[a.n] = byN[a.n] || []).push(a); });
        const dup = its.some(o => (byN[o.n] || []).length !== 1) || new Set(its.map(o => o.n)).size !== its.length;
        if (!dup) { its.forEach(o => { o.answer = byN[o.n][0].text; }); hasKey = true; }
      }
    }
    return { items: its, hasKey: hasKey };
  }

  function lessonToItems(L) {
    if (!L || !Array.isArray(L.items) || !L.items.length) throw new Error('This lesson file has no items.');
    return L.items.map((it, i) => {
      const steps = Array.isArray(it.steps) ? it.steps.filter(s => s && s.work).map(s => ({ work: String(s.work), why: String(s.why || ''), mark: Array.isArray(s.mark) ? s.mark.map(String) : null })) : [];
      if (!steps.length && it.answer != null && String(it.answer) !== '') steps.push({ work: '<b>' + esc(String(it.answer)) + '</b>', why: '' });
      if (!it.prompt) throw new Error('Item ' + (i + 1) + ' has no prompt.');
      return { n: it.n || i + 1, text: String(it.prompt), ctx: it.context ? String(it.context) : '', steps: steps };
    });
  }
  /* a worksheet I already wrote a lesson for is recognized by its first question */
  function matchLesson(lib, items) {
    const norm = t => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!items || !items.length) return null;
    const first = norm(items[0].text);
    return (lib || []).find(L => L && L.match && norm(L.match.first) === first && L.match.count === items.length) || null;
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  g.DrillCore = { KINDS: KINDS, detect: detect, parsePage: parsePage, solve: solve, gcd: gcd, parseGeneric: parseGeneric, lessonToItems: lessonToItems, matchLesson: matchLesson, esc: esc };
})(typeof globalThis !== 'undefined' ? globalThis : window);
