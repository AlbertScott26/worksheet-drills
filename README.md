# Worksheet Drills

Turns a worksheet PDF into a one-question-at-a-time guided drill for a classroom TV.

- **Guided:** each step shown with a short reason.
- **Walk-through:** steps only, built on the board under the problem.
- **Live page:** https://albertscott26.github.io/worksheet-drills/ (served from `docs/`)

## Worksheet types with full step-by-step solving
Improper to mixed, mixed to improper, simplify proper, simplify improper, completing a whole number, comparing fractions, comparing with mixed numbers, fractional part of a set, ordering three fractions.

Word problems and any other PDF with numbered questions is shown one at a time, with answers from an answer key page if present.
A lesson file (`.json`, see `examples/`) gives reasoning steps for any subject.

## Layout
- `src/core.js` — worksheet detection, parsing, and the step engine (no DOM; also runs in Node)
- `src/ui.html` — the page (start screen, drill screen, progress bar, settings)
- `src/build.py` — bundles ui + core + pdf.js into one offline file at `docs/index.html`
- `tests/` — parser tests against sample worksheets (`SAMPLES=/path/to/pdfs npm test`)
- `lessons/` — hand-written lessons for worksheets that need reasoning steps (word problems); matched automatically when the PDF is dropped
- `examples/` — sample lesson files

## Build
```
npm install
python3 src/build.py          # writes docs/index.html
```

Worksheet PDFs are not stored in this repo (they belong to their publishers). Keep them locally in `samples/` for tests.

## Original sheet view
Press `O` to see any worksheet exactly as printed, one question at a time, with the answer revealed in place. Scope of supported worksheet families: `SCOPE.md`.

## Teacher toolbox
The page opens on a home screen: Worksheet to Presentation (drop a PDF) and Problem Generator (pick a K5 grade 4 topic, get fresh problems with steps). `R` makes a new set while presenting.
