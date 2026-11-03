# Scope: K5 Learning Grade 4 math (and similar sheets)

Source index: https://www.k5learning.com/free-math-worksheets/fourth-grade-4
PDF pattern: `https://www.k5learning.com/worksheets/math/grade-4-<topic-slug>-<a..f>.pdf`
Layout: page 1 = questions, last page = the same layout with answers filled in. Questions are labelled `1)` or `1.`.
Some sets are members-only; those PDFs cannot be fetched by Claude. Send them in chat to test.

## How a dropped PDF is handled (in order)
1. **Engine** (exact steps, reasoning, board view): detected by title/content, solved in `core.js`, checked against the sheet's own key.
2. **Lesson library** (`lessons/*.json`): hand-written steps for word problems, matched by first question + count.
3. **Generic text**: questions plus answer-key text, any subject.
4. **Original sheet (image mode)**: crops each numbered question (and its key cell) from the PDF and shows it large. Used automatically when no text can be read; press `O` any time to switch. Works for any K5-style sheet with numbered cells, including pictures, shapes, graphs and clocks.

So every Grade 4 sheet can be shown one question at a time with a reveal. Steps and reasoning need an engine or a lesson.

## Topic families

| K5 category | Topics | Status |
|---|---|---|
| Fractions | convert improper/mixed, simplify, complete a whole, compare (proper, improper/mixed), fraction of a set, order 3 fractions | **Engines done** (9 kinds) |
| Fractions | word problems | **Lessons** (2 sets); more need a lesson each |
| Fractions | add/subtract like and unlike, equivalent fractions, fraction models | Image mode now; engine next |
| Fractions & Decimals | fractions to/from decimals, decimals | Image mode now; engine next |
| 4 Operations | Addition, Subtraction (column) | Image mode now; column engine next |
| 4 Operations | Multiply in columns, Mental multiplication | Image mode now; column engine next |
| 4 Operations | Mental division, Long division | Image mode now; long-division engine next |
| 4 Operations | Order of operations | Image mode now; expression engine next |
| 4 Operations | Place value & rounding, Factoring | Image mode now; engine next |
| Other | Measurement, Roman numerals | Image mode now; conversion tables next |
| Other | Geometry, Data & graphing | Image mode (visual by nature) |
| Other | Word problems (all topics) | Lessons, one per set |

## Build order for new engines
Each engine = `KINDS` entry, `detect` rule, parser, `solve` branch, tested against that sheet's key (see CLAUDE.md).
1. Column arithmetic (add, subtract, multiply): carries and borrows shown step by step.
2. Long division.
3. Order of operations.
4. Fraction add/subtract, equivalent fractions.
5. Place value, rounding, factoring.
6. Decimals and measurement conversions.

An engine needs a real sample of that topic. Send one sheet per topic and it is built and verified against its key.

## Teacher toolbox structure
- **Home** (`#home`): launcher tiles. Tool 1 = Worksheet to Presentation (PDF drop). Tool 2 = Problem Generator.
- **Catalog** (`catalog/k5-grade4.json`): K5 Grade 4 subject > topic > sub-topic tree. Math 17 topics / 230 sub-topics; reading, vocabulary, spelling, grammar & writing are listed by name only. Same crawl works for other grades by changing the index URL.
- **Generators** (`src/generators.js`): one random-problem generator per engine kind; `COVERAGE` maps a K5 slug to `{kind, level}`. A sub-topic is READY when it has an entry, otherwise SOON.
- **Adding a topic family** = add the engine (core.js) + a generator (generators.js) + `COVERAGE` entries. Then both tools get it.
- Currently READY: 48 of 230 math sub-topics: 13 fractions, 11 column addition, 9 column subtraction, 7 multiplication in columns (1x2 up to 3x3 digits), 8 long division (1-digit divisor; 'single-digit division' appears under both Mental and Long Division).
- Column arithmetic shows a stacked problem on the left with per-column frames (`col.frames` from `solve`) and steps on the right.
