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
