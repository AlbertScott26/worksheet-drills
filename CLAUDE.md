# Worksheet Drills: notes for Claude

Owner: Andrew, 4th grade teacher (Paideia School, Tampa). The page runs on a classroom TV, so it must be readable from the back of a room and work with a clicker (arrow keys, Space, Enter).

## Rules
- After any change to `src/`, run `python3 src/build.py` so `docs/index.html` (the live page) is current. Commit both.
- Run `npm test` with `SAMPLES` pointing at the sample worksheets before pushing. Never commit worksheet PDFs.
- Add each new worksheet type as: a `KINDS` entry, a `detect` rule, a parser, a `solve` branch in `core.js`; then test against that sheet's own answer key.
- Keep the page one self-contained offline file: classic inline scripts only (no module imports or Blob workers; Safari fails on them). Polyfills for older Safari live in `ui.html` `polyfills()`.
- Palette: bg #141B36, panels #243058, borders #3A4772, gold #C9A227 (answers only), cream #E8E4D4.
- Acronyms (GCF etc.) are spelled out in parentheses on first use per worksheet, then shown short; see `ACRONYMS` in `ui.html`.
- Reasoning lines: 4th-grade vocabulary, one short sentence.

## Lesson library (word problems and other non-formula worksheets)
- `lessons/*.json` hold hand-written lessons (steps, reasoning, `mark` phrases highlighted in the story). `build.py` embeds them in the page.
- A dropped PDF is matched to a lesson by its first question text and item count (`match` in the lesson file). When matched, the lesson's steps replace the plain answer-key display.
- To add one: parse the PDF with the generic reader, write steps that (1) name the numbers to use, (2) set up the problem, (3) solve, (4) answer. Verify every answer against the sheet's key before committing.
- Step `work` is HTML (`<b>` for answers, `.ifr` spans for stacked fractions); `why` is one short sentence.

## Original-sheet (image) mode
- `buildImageData` in `ui.html` renders PDF pages to canvas, crops each numbered cell and its matching key cell, and shows them on a white panel (`#pic`). `O` toggles it; it is automatic when the generic parser finds 0 items.
- Label rule: text item matching `^\d{1,3}\s*[.)]$`, size <= 16. A page is a key page if it has "Answers" or all its labels repeat earlier ones. Fewer than 2 labels = page mode.
- Scope and build order for K5 grade 4: see `SCOPE.md`.

## Home + generator
- `ui.html` screens: `#home`, `#gen`, `#start` (PDF drop), `#drill`. `showHome/showGen/showStart/showDrill` hide the others. `S.origin` = 'pdf' | 'gen' (Esc goes back to where the drill came from; `R` makes a new set).
- `build.py` embeds `src/generators.js` (`/*__GEN__*/`) and `catalog/k5-grade4.json` (`/*__CATALOG__*/`).
- New engine checklist now also needs: a generator, `COVERAGE` slugs, and `tests/gentest.mjs` passing (it solves ~48k generated problems).
- `catalog/` is crawled from k5learning.com with the built-in browser (WebFetch cannot list sub-topics). PDFs cannot be downloaded from the sandbox.
- CSS gotcha: the drill equation container is `.row`. Do not reuse generic class names (`.row`, `.n`, `.d`) for new screens; the generator list uses `.grow`/`.gn`.
- Layout guard: `guard()` in `ui.html` runs after every render (equal numerator/denominator size, row fits both ways, steps never spill) and logs repairs to `S.guardLog`. `tests/e2e_layout.py` (Playwright) sweeps every ready generator topic and injects hostile CSS; run it before pushing. Fraction sizes are also locked in CSS (`.frac>.n,.frac>.d`).
- Stale copies: every build stamps `<meta name="build-id">` (timestamp-sha). The page compares itself to the live file on load and auto-reloads (idle) or shows an update banner on Home. The build id shows bottom-right on Home.
