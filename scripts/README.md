# scripts/

Data collection and analysis tooling for the 4D matrix project.

## Why two scripts

`fetch_magnum.py` must run on a machine with normal internet access. The
Claude Code sandbox blocks lottery domains at the network gateway (403 on
CONNECT for `magnum4d.my`, `check4d.org`, `4dnumber.net` and others), so
fetching has to happen on your side. Analysis has no such constraint and
runs anywhere.

## 1. Collect the data (your machine)

```bash
pip install requests
python3 scripts/fetch_magnum.py --draws 10
```

Options:

| Flag | Meaning |
|---|---|
| `--draws N` | keep walking backwards until N actual draws are collected (default 10) |
| `--days N` | scan the last N calendar days instead |
| `--start / --end` | explicit date range, `YYYY-MM-DD` |
| `--date-format` | strftime format for `?date=` (default `%Y-%m-%d`) |
| `--sleep` | seconds between requests (default 1.5) |
| `--force` | re-fetch dates already cached |

Magnum draws Wed / Sat / Sun plus occasional special draws, so most calendar
dates legitimately have no result — `--days 10` yields roughly 4 draws, while
`--draws 10` walks back about three weeks to find 10.

Outputs:

- `data/raw/magnum_<date>.html` — raw page per date, kept so the parser can be
  corrected later without re-fetching
- `data/magnum_results.csv` — `DrawDate,DrawNo,PrizeCode,Digit`

If the site's `?date=` format differs, pages come back empty. Try
`--date-format '%d-%m-%Y'` or `'%d/%m/%Y'`. If parsing fails the script says so
and leaves the HTML in `data/raw/` — send one of those files over and the
selectors can be fixed.

### Prize codes

```
1 = 1st prize      2 = 2nd prize      3 = 3rd prize
S = Special      (10 numbers)
C = Consolation  (10 numbers)
```

23 numbers per draw. This matches the reference Singapore Pools dataset
schema, so the analyser runs unchanged on either file.

## 2. Analyse it (anywhere)

```bash
pip install pandas numpy scipy
python3 scripts/analyze_4d.py data/magnum_results.csv
```

| Test | Question |
|---|---|
| 0 | Data integrity — wrong prize counts, duplicates, predictions stored as actuals |
| 1 | **Statistical power** — what effect size *this* sample can actually detect |
| 2 | Digit uniformity (chi-square) |
| 3 | Pattern mix vs combinatorial truth |
| 4 | Pattern Markov matrix — is it rank-one, i.e. i.i.d.? |
| 5 | Hazard function — are dormant numbers "overdue"? |
| 6 | Tier carry-over — Special(t) → top-3(t+k), k = 1,2,3 |
| 7 | Hot/cold backtest vs random picking |
| 8 | Money simulation |

Skip tests with `--skip 5,8`.

### Read TEST 1 first

It reports the smallest edge the sample can distinguish from noise, against
the 56% edge needed to overcome Magnum's 36% house edge. Roughly **52 draws**
is the minimum for a 3-sigma answer; 10 draws can only detect a 128% effect,
so nothing else in the report can support a betting decision either way.

Tests 4, 5 and 7 disable themselves on small samples rather than print
meaningless numbers.

## What the reference data already showed

Run against 4,356 real Singapore Pools draws (1986–2018, 100,119 winning
numbers — structurally the same game: 10,000 numbers, 23 prizes, physical
ball draw):

| Test | Result |
|---|---|
| Digit uniformity | chi-square p = 0.63, max deviation 0.91% |
| Digits 0–3 share | 40.053% vs 40.000% expected |
| Top-3 containing a 0/1/2/3 | 87.16% vs 87.04% base rate (z = +0.41) |
| Number-level uniformity | p = 0.36 across all 10,000 |
| Pattern Markov | p = 0.46 — matrix is rank-one |
| Hazard at dormancy 1→500 | flat at ≈0.23%, the constant-hazard prediction |
| Special → top-3 at lags 1/2/3 | ratios 0.92 / 0.84 / 0.84 |
| Hot-number backtest | no edge at K = 5, 10, 15, 30 |
| Money simulation, 4,356 draws | −32% (random picks) / −35% (hot picks) |

Out-of-sample pattern mining: 229 candidate rules fitted on the first 2,178
draws, tested on the second 2,178. Correlation of training edge to holdout
edge, r = +0.19. Best rule found (+2.85 sigma in training) delivered +0.01%
out of sample.

A perfect pattern-class oracle still loses: covering all 5,040 ABCD numbers
costs RM5,040 and returns RM4,466 expected, because the 36% house edge lives
in the payout table rather than in your uncertainty.

These scripts exist so the same tests can be re-run on Magnum's own data
rather than taken on trust.
