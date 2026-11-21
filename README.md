# makefun-csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/edwinibnu97/makefun-csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/edwinibnu97/makefun-csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's own csv-reader 1.0.0
([csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)):
`run(input)` returns exactly csv-reader's answer for every `{text, header}`
input — the JSON value `{columns, rows, errors}` — only faster.

## Run it

```sh
node test/check.mjs   # correctness vs csv-reader 1.0.0 + expected.json
node test/bench.mjs   # CPU time of this solve.js vs the house baseline
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=q17yfxs8&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>

## How it is fast

- The text is scanned with `indexOf`/`slice`, never one character at a time.
- A record line with no quote and no stray CR is split in one call.
- A quoted field with no doubled quote and no line break is one slice.
- The rare broken constructs (stray CR, quote junk, unterminated quote,
  quoted line breaks) go through slow paths that stay exact.
- Every `indexOf` is bounded to the field or segment it decides, so no
  scan ever runs past the text it needs.

## Files

- `solve.js` — the reader (`run(input)`), dependency-free ES module.
- `main.ts` — the house driver, kept as the kit ships it: reads every case
  from `/input/cases.json`, answers each with `run`, writes
  `/output/answers.json`.
