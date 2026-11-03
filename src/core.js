/* Fraction Drills core: worksheet detection, problem parsing, and the step engine.
   Pure functions, no DOM. Works in the browser and in Node (used for testing). */
(function (g) {
  const KINDS = {
    improper_to_mixed: { label: 'IMPROPER → MIXED NUMBER', title: 'Converting Fractions · Improper to Mixed', whole: false, firstEq: false },
    mixed_to_improper: { label: 'MIXED NUMBER → IMPROPER', title: 'Converting Fractions · Mixed to Improper', whole: true, firstEq: false },
    simplify_proper: { label: 'SIMPLIFY TO LOWEST TERMS', title: 'Simplifying Proper Fractions', whole: false, firstEq: false },
    simplify_improper: { label: 'SIMPLIFY, THEN MIXED NUMBER', title: 'Simplifying Improper Fractions', whole: false, firstEq: true },
    complete_whole: { label: 'COMPLETE THE WHOLE NUMBER', title: 'Completing a Whole Number', whole: false, firstEq: false },
    compare: { label: 'COMPARING FRACTIONS', title: 'Comparing Fractions', whole: false, firstEq: false }
  };

  function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

  function detect(text) {
    const t = String(text).toLowerCase().replace(/\s+/g, ' ');
    if (t.includes('simplifying improper')) return 'simplify_improper';
    if (t.includes('simplifying proper')) return 'simplify_proper';
    if (t.includes('completing a whole number')) return 'complete_whole';
    if (/compar(e|ing) (proper |improper |unlike |like )?fractions/.test(t)) return 'compare';
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
    if (kind === 'compare') return parseCompare(it);

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

  const fr = (a, b) => '<span class="ifr"><span>' + a + '</span><span>' + b + '</span></span>';
  const mix = (w, n, d) => '<span class="imx"><span class="iw">' + w + '</span>' + fr(n, d) + '</span>';
  const GCF_WHY = 'The GCF is the biggest number that divides both evenly.';

  /* Returns {slots:[{v}], steps:[{work, why, slot?}]}. A step with `slot: k` fills answer slot k. */
  function solve(kind, q) {
    const n = q.num, d = q.den;
    if (kind === 'compare') {
      const a = q.n1, b = q.d1, c = q.n2, d = q.d2;
      const L = b * d / gcd(b, d), x = a * (L / b), y = c * (L / d);
      const sym = x < y ? '<' : x > y ? '>' : '=';
      const symH = sym === '<' ? '&lt;' : sym === '>' ? '&gt;' : '=';
      const steps = [];
      if (b === d) {
        steps.push({ work: 'Same bottom number: <b>' + b + '</b>', why: 'When the bottoms match, just compare the tops.' });
      } else {
        steps.push({ work: 'Common bottom number: <b>' + L + '</b>', why: 'Rewrite both fractions with the same bottom so they can be compared.' });
        if (L / b > 1) steps.push({ work: fr(a, b) + ' = ' + fr('<b>' + x + '</b>', L), why: 'Multiply top and bottom by ' + (L / b) + '.' });
        if (L / d > 1) steps.push({ work: fr(c, d) + ' = ' + fr('<b>' + y + '</b>', L), why: 'Multiply top and bottom by ' + (L / d) + '.' });
      }
      steps.push({
        work: fr(x, L) + ' <b>' + symH + '</b> ' + fr(y, L),
        why: x === y ? 'The tops are equal, so the fractions are equal.' : x + ' is ' + (x < y ? 'less' : 'greater') + ' than ' + y + ', so the first fraction is ' + (x < y ? 'smaller' : 'larger') + '.',
        slot: 0
      });
      return {
        row: [{ t: 'v', v: { num: a, den: b } }, { t: 'slot', k: 0 }, { t: 'v', v: { num: c, den: d } }],
        slots: [{ v: { sym: sym } }],
        steps: steps
      };
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
          { work: n + ' ÷ ' + d + ' = <b>' + w + '</b> R <b>' + r + '</b>', why: 'The fraction bar means divide: top ÷ bottom.' },
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
    steps.push({ work: n2 + ' ÷ ' + d2 + ' = <b>' + w + '</b> R <b>' + r + '</b>', why: 'Now change the improper fraction to a mixed number: top ÷ bottom.' });
    steps.push({ work: 'Answer: ' + mix(w, r, d2), why: 'Whole number ' + w + ', remainder ' + r + ' over ' + d2 + '. Check: ' + w + ' × ' + d2 + ' + ' + r + ' = ' + n2 + ' ✓', slot: 1 });
    return { slots: [{ v: { num: n2, den: d2 } }, { v: { w: w, num: r, den: d2 } }], steps: steps };
  }


  /* ---------- generic worksheets (any subject) ---------- */
  function toLines(items) {
    const its = items.filter(o => o.str && o.str.trim()).slice().sort((a, b) => b.y - a.y || a.x - b.x);
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
          if (pv) { const gap = o.x - (pv.x + pv.width); if (gap > 0.2 * L.size && !/\s$/.test(t) && !/^\s/.test(o.str)) t += ' '; }
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
    let inKey = false;
    pages.forEach(pg => {
      const lines = toLines(pg);
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
      let ctx = [], cur = null;
      cols.forEach((col, ci) => {
        cur = null;
        col.forEach(l => {
          if (/^(answer\s*key|answers?|key)\b[\s:]*$/i.test(l.text) || /^answer\s*key\b/i.test(l.text)) { inKey = true; cur = null; return; }
          const m = l.text.match(LABEL);
          if (m) {
            cur = { n: +m[1], lines: m[2] ? [m[2]] : [], ctx: ctx.join(' ') };
            (inKey ? answers : items).push(cur);
          } else if (cur) {
            cur.lines.push(l.text);
          } else if (!inKey && ci === 0) {
            if (l.size > 1.25 * med) return;                       // title
            if (/^(name|date|class|period|score)\b|^page\s*\d/i.test(l.text)) return;
            ctx.push(l.text);
          }
        });
      });
      if (!inKey) ctx = [];
    });
    const clean = a => a.map(o => ({ n: o.n, text: o.lines.reduce((acc, t, i) => i === 0 ? t : acc + (/^\(?[A-Ha-h][.)]\s|^[•\-–]\s/.test(t) ? '\n' : ' ') + t, '').trim(), ctx: (o.ctx || '').slice(0, 260) }));
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
      const steps = Array.isArray(it.steps) ? it.steps.filter(s => s && s.work).map(s => ({ work: String(s.work), why: String(s.why || '') })) : [];
      if (!steps.length && it.answer != null && String(it.answer) !== '') steps.push({ work: '<b>' + esc(String(it.answer)) + '</b>', why: '' });
      if (!it.prompt) throw new Error('Item ' + (i + 1) + ' has no prompt.');
      return { n: it.n || i + 1, text: String(it.prompt), ctx: it.context ? String(it.context) : '', steps: steps };
    });
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  g.DrillCore = { KINDS: KINDS, detect: detect, parsePage: parsePage, solve: solve, gcd: gcd, parseGeneric: parseGeneric, lessonToItems: lessonToItems, esc: esc };
})(typeof globalThis !== 'undefined' ? globalThis : window);
