#!/usr/bin/env python3
"""
analyze_4d.py - run the full randomness test battery on a 4D results CSV.

    python3 scripts/analyze_4d.py data/magnum_results.csv

Accepts any CSV with columns DrawDate, PrizeCode, Digit (a DrawNo column is
used when present but is optional), so it runs unchanged on both the Magnum
file produced by fetch_magnum.py and the reference Singapore dataset.

PrizeCode alphabet:  1 / 2 / 3 = top three,  S = Special,  C = Consolation.

Tests performed
---------------
  0  Data integrity      - wrong counts per draw, duplicates, prediction
                            columns accidentally stored as actuals
  1  Statistical power    - what effect size THIS sample can actually detect
  2  Digit uniformity     - chi-square over drawn digits
  3  Pattern mix          - observed vs combinatorial truth (ABCD/AABC/...)
  4  Pattern Markov       - is the transition matrix rank-one (i.i.d.)?
  5  Hazard function      - are dormant numbers "overdue"?
  6  Tier carry-over      - Special(t) -> top-3(t+k) for k = 1,2,3
  7  Hot / cold backtest  - do recent numbers predict the next draw?
  8  Money simulation     - what the strategy actually returns

Every test prints the observed value, the value expected under randomness,
and whether the difference is distinguishable from noise. A small sample
will say so rather than pretending otherwise.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter, defaultdict
from itertools import combinations_with_replacement, permutations
from math import comb, factorial, sqrt
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    from scipy import stats
except ImportError:
    sys.exit("Missing dependencies. Install with:  pip install pandas numpy scipy")

TOP = ["1", "2", "3"]
EXPECTED_PER_DRAW = {"1": 1, "2": 1, "3": 1, "S": 10, "C": 10}
# Magnum Big-bet payout per RM1 staked.
PAYOUT = {"1": 2500, "2": 1000, "3": 500, "S": 180, "C": 60}
PATTERNS = ["ABCD", "AABC", "AABB", "AAAB", "AAAA"]
SHAPE = {"4": "AAAA", "31": "AAAB", "22": "AABB", "211": "AABC", "1111": "ABCD"}


def pattern_of(code: str) -> str:
    counts = sorted(Counter(code).values(), reverse=True)
    return SHAPE["".join(map(str, counts))]


def rule(title: str) -> None:
    print("\n" + "=" * 74)
    print(title)
    print("=" * 74)


def verdict(z: float, threshold: float = 3.0) -> str:
    return "consistent with randomness" if abs(z) < threshold else "DEVIATION"


# --------------------------------------------------------------------------
def load(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str)
    missing = {"DrawDate", "PrizeCode", "Digit"} - set(df.columns)
    if missing:
        sys.exit(f"CSV is missing required column(s): {', '.join(sorted(missing))}")
    df["Digit"] = df["Digit"].str.strip().str.zfill(4)
    df = df[df.Digit.str.fullmatch(r"\d{4}")]
    return df.drop_duplicates(subset=["DrawDate", "PrizeCode", "Digit"])


def test_integrity(df: pd.DataFrame) -> list[str]:
    rule("TEST 0 - DATA INTEGRITY")
    dates = sorted(df.DrawDate.unique())
    print(f"  draws: {len(dates)}   numbers: {len(df)}   "
          f"range: {dates[0]} -> {dates[-1]}")

    problems = []
    for d, sub in df.groupby("DrawDate"):
        got = {c: int((sub.PrizeCode == c).sum()) for c in EXPECTED_PER_DRAW}
        if got != EXPECTED_PER_DRAW:
            problems.append(f"{d}: {got}")
    if problems:
        print(f"\n  {len(problems)} draw(s) with unexpected prize counts:")
        for p in problems[:8]:
            print(f"    {p}")
    else:
        print("  every draw has the full 1/1/1/10/10 structure")

    # The exact bug found in Prediction_Analysis.xlsx: a prediction column
    # stored where an actual result belongs shows up as an implausibly large
    # overlap between neighbouring draws.
    by_date = {d: set(sub.Digit) for d, sub in df.groupby("DrawDate")}
    print("\n  neighbour overlap (a spike here means a prediction column got"
          "\n  saved as an actual result - expect 0-2 shared numbers):")
    flagged = []
    for a, b in zip(dates, dates[1:]):
        ov = len(by_date[a] & by_date[b])
        if ov >= 5:
            flagged.append((a, b, ov))
    if flagged:
        for a, b, ov in flagged[:8]:
            print(f"    SUSPICIOUS  {a} -> {b}: {ov} shared numbers")
        print("    ^ verify these against the official site before analysing.")
    else:
        print("    all neighbour overlaps within normal range")
    return problems


def test_power(n_draws: int, covered: int = 240) -> None:
    """
    Can this sample distinguish a break-even edge from noise?

    The decision metric is prize-hit concentration on the number set you
    actually bet, NOT single-digit frequency. Betting `covered` numbers, a
    draw awards 23 prizes, so under randomness the expected number of hits
    over n draws is mu = n * 23 * covered/10000. The smallest relative lift
    on that count detectable at 3 sigma is 3/sqrt(mu). Break-even against a
    36% house edge requires a lift of 1/0.64 - 1 = 56.25%.
    """
    rule("TEST 1 - STATISTICAL POWER OF THIS SAMPLE")
    need_lift = 1 / 0.64 - 1                      # 0.5625
    mu = n_draws * 23 * covered / 10000
    detect = 3 / sqrt(mu) if mu > 0 else float("inf")
    min_draws = 9 / (need_lift ** 2 * 23 * covered / 10000)

    print(f"  betting {covered} numbers per draw over {n_draws} draw(s):")
    print(f"    expected prize hits under randomness : {mu:.1f}")
    print(f"    smallest lift detectable at 3 sigma  : {detect*100:.0f}%"
          if mu > 0 else "    smallest lift detectable: n/a")
    print(f"    lift required to break even          : {need_lift*100:.0f}%")

    if detect > need_lift:
        print("\n  THIS SAMPLE CANNOT DETECT A PROFITABLE EDGE EVEN IF ONE EXISTS.")
        print(f"  Minimum for that: ~{int(min_draws)+1} draws "
              f"({(int(min_draws)+1)/156:.1f} years at 3 draws/week).")
        print("  Any 'pattern' visible in a sample this size is noise by")
        print("  construction - it cannot be anything else.")
    else:
        print(f"\n  Sample can detect a break-even-sized edge in the prize-hit")
        print(f"  rate (needs ~{int(min_draws)+1} draws; you have {n_draws}).")

    # Reported separately: informative, but not the betting decision metric.
    n_digits = n_draws * 23 * 4
    if n_digits:
        dig = 3 * sqrt(0.1 * 0.9 / n_digits) / 0.1
        print(f"\n  (separately: {n_digits:,} drawn digits give 3-sigma"
              f" sensitivity to a {dig*100:.1f}% single-digit bias -")
        print("   a much more powerful test, but a digit bias is not by itself")
        print("   a profitable edge.)")


def test_digits(df: pd.DataFrame) -> None:
    rule("TEST 2 - DIGIT UNIFORMITY")
    c = Counter("".join(df.Digit))
    n = sum(c.values())
    obs = np.array([c[str(d)] for d in range(10)])
    chi, p = stats.chisquare(obs)
    print(f"  {n:,} digits")
    print(f"  counts   : {dict(zip(range(10), obs.tolist()))}")
    print(f"  expected : {n/10:,.1f} each")
    print(f"  chi-square = {chi:.2f}, dof = 9, p = {p:.4f}")
    print(f"  largest deviation: {np.abs(obs - n/10).max() / (n/10) * 100:.2f}%")
    print(f"  -> {'uniform' if p > 0.05 else 'deviation detected'}")

    share = obs[:4].sum() / n
    se = sqrt(0.4 * 0.6 / n)
    print(f"\n  digits 0-3 share: {share*100:.3f}% (expected 40.000%), "
          f"z = {(share-0.4)/se:+.2f}")

    top = df[df.PrizeCode.isin(TOP)]
    has = top.Digit.apply(lambda s: any(ch in "0123" for ch in s))
    k, N = int(has.sum()), len(has)
    if N:
        z = (k/N - 0.8704) / sqrt(0.8704 * 0.1296 / N)
        print(f"  top-3 numbers containing a 0/1/2/3: {k}/{N} = {k/N*100:.2f}% "
              f"(base rate 87.04%), z = {z:+.2f}")
        print(f"  -> {verdict(z)}")


def test_pattern_mix(df: pd.DataFrame) -> np.ndarray:
    rule("TEST 3 - PATTERN MIX vs COMBINATORIAL TRUTH")
    theo = Counter(pattern_of(f"{i:04d}") for i in range(10000))
    obs = Counter(df.Digit.apply(pattern_of))
    n = sum(obs.values())
    print(f"  {'pattern':8s} {'observed':>10s} {'expected':>10s} {'z':>8s}")
    for p in PATTERNS:
        pt = theo[p] / 10000
        o = obs[p] / n if n else 0
        se = sqrt(pt * (1 - pt) / n) if n else float("inf")
        print(f"  {p:8s} {o*100:9.2f}% {pt*100:9.2f}% {(o-pt)/se:+8.2f}")
    print("\n  the mix is fixed by how many such numbers exist, not by a regime")
    return np.array([obs[p] for p in PATTERNS])


def test_markov(df: pd.DataFrame) -> None:
    rule("TEST 4 - PATTERN MARKOV TRANSITION MATRIX")
    print("  For an i.i.d. process the true matrix is RANK-ONE: every row")
    print("  equals the marginal distribution. Testing for any dependence.\n")
    firsts = (df[df.PrizeCode == "1"].sort_values("DrawDate").Digit.tolist())
    if len(firsts) < 30:
        print(f"  only {len(firsts)} draws - too few for a transition test")
        return
    pats = [pattern_of(f) for f in firsts]
    M = np.zeros((5, 5))
    for a, b in zip(pats, pats[1:]):
        M[PATTERNS.index(a), PATTERNS.index(b)] += 1
    print("  " + f"{'from/to':10s}" + "".join(f"{p:>8s}" for p in PATTERNS))
    for i, p in enumerate(PATTERNS):
        print("  " + f"{p:10s}" + "".join(f"{int(M[i,j]):8d}" for j in range(5)))
    keep = M[M.sum(1) > 0][:, M.sum(0) > 0]
    if min(keep.shape) < 2:
        print("\n  not enough distinct states to test")
        return
    chi, p, dof, _ = stats.chi2_contingency(keep)
    print(f"\n  chi-square independence: chi2 = {chi:.2f}, dof = {dof}, p = {p:.4f}")
    print(f"  -> {'no dependence; matrix is rank-one (i.i.d.)' if p > 0.05 else 'dependence found'}")


def test_hazard(df: pd.DataFrame) -> None:
    rule("TEST 5 - HAZARD FUNCTION ('overdue' numbers)")
    print("  A memoryless process has CONSTANT hazard, by definition.\n")
    dates = sorted(df.DrawDate.unique())
    idx = {d: i for i, d in enumerate(dates)}
    pos = defaultdict(list)
    for d, sub in df.groupby("DrawDate"):
        for x in set(sub.Digit):
            pos[x].append(idx[d])
    gaps = np.array([g for v in pos.values() for g in np.diff(sorted(v))])
    if gaps.size < 200:
        print(f"  only {gaps.size} repeat gaps observed - need a longer history")
        return
    print(f"  {gaps.size:,} gaps, mean {gaps.mean():.1f} draws "
          f"(theory {10000/23:.1f})")
    print(f"\n  {'dormancy':>10s} {'at risk':>10s} {'appeared':>9s} {'hazard':>9s}")
    for k in [1, 5, 10, 25, 50, 100, 200, 300, 500]:
        at_risk = int((gaps >= k).sum())
        if at_risk < 30:
            continue
        ev = int((gaps == k).sum())
        print(f"  {k:10d} {at_risk:10,d} {ev:9,d} {ev/at_risk*100:8.3f}%")
    print(f"\n  constant-hazard prediction: {23/10000*100:.3f}% at EVERY dormancy")
    print("  -> flat means 'overdue' has no mathematical meaning here")


def test_carryover(df: pd.DataFrame) -> None:
    rule("TEST 6 - TIER CARRY-OVER  Special(t) -> top-3(t+k)")
    dates = sorted(df.DrawDate.unique())
    g = {d: sub for d, sub in df.groupby("DrawDate")}
    star = [set(g[d][g[d].PrizeCode == "S"].Digit) for d in dates]
    top = [set(g[d][g[d].PrizeCode.isin(TOP)].Digit) for d in dates]
    print(f"\n  {'lag':>5s} {'observed':>9s} {'expected':>9s} {'ratio':>7s} {'z':>7s}")
    for lag in (1, 2, 3):
        if len(dates) <= lag:
            continue
        obs = sum(len(star[i] & top[i + lag]) for i in range(len(dates) - lag))
        exp = sum(len(star[i]) * len(top[i + lag]) / 10000
                  for i in range(len(dates) - lag))
        if exp <= 0:
            continue
        z = (obs - exp) / sqrt(exp)
        print(f"  {lag:5d} {obs:9d} {exp:9.2f} {obs/exp:7.3f} {z:+7.2f}")
    print("\n  ratio near 1.0 means promotion probability equals the")
    print("  unconditional rate - i.e. no 'warming chamber' effect")


def test_backtest(df: pd.DataFrame) -> None:
    rule("TEST 7 - HOT / COLD BACKTEST")
    dates = sorted(df.DrawDate.unique())
    allsets = [set(sub.Digit) for _, sub in df.groupby("DrawDate")]
    rng = np.random.default_rng(42)
    print("  Pick the 10 most frequent numbers from the last K draws, then")
    print("  count hits in the NEXT draw. Compare against random picks.\n")
    ran_any = False
    for K in (5, 10, 15, 30):
        if len(dates) <= K + 5:
            continue
        ran_any = True
        hot = rnd = trials = 0
        for i in range(K, len(dates)):
            win = Counter()
            for j in range(i - K, i):
                win.update(allsets[j])
            picks = [x for x, _ in win.most_common(10)]
            hot += sum(1 for x in picks if x in allsets[i])
            rnd += sum(1 for x in (f"{v:04d}" for v in rng.integers(0, 10000, 10))
                       if x in allsets[i])
            trials += 1
        exp = trials * 10 * 23 / 10000
        z = (hot - exp) / sqrt(exp) if exp > 0 else 0
        print(f"  K={K:2d}: hot {hot:4d} | random {rnd:4d} | chance {exp:6.1f} "
              f"| z {z:+5.2f}  {verdict(z)}")
    if not ran_any:
        print("  not enough draws for a backtest (need ~20+)")


def test_money(df: pd.DataFrame) -> None:
    rule("TEST 8 - MONEY SIMULATION")
    dates = sorted(df.DrawDate.unique())
    g = {d: sub for d, sub in df.groupby("DrawDate")}
    abcd = ["".join(c) for c in combinations_with_replacement("0123456789", 4)
            if len(set(c)) == 4]
    rng = np.random.default_rng(7)
    staked = won = 0
    for d in dates:
        picks = [abcd[k] for k in rng.integers(0, len(abcd), 10)]
        nums = set()
        for c in picks:
            nums |= {"".join(p) for p in permutations(c)}
        staked += len(nums)
        sub = g[d]
        for code, amt in PAYOUT.items():
            won += len(nums & set(sub[sub.PrizeCode == code].Digit)) * amt
    if staked == 0:
        print("  no draws to simulate")
        return
    print(f"  strategy: 10 random ABCD permutation classes (240 numbers) per draw")
    print(f"  draws simulated : {len(dates)}")
    print(f"  total staked    : RM{staked:,}")
    print(f"  total won       : RM{won:,}")
    print(f"  net             : RM{won-staked:,}  (ROI {(won-staked)/staked*100:+.1f}%)")
    print(f"\n  theoretical expectation: RM0.64 returned per RM1 -> ROI -36.0%")
    print("  this figure is identical for ANY selection of 240 numbers;")
    print("  filtering changes variance, not expectation")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path, help="results CSV")
    ap.add_argument("--skip", default="", help="comma-separated test numbers to skip")
    args = ap.parse_args()

    if not args.csv.exists():
        sys.exit(f"No such file: {args.csv}")
    skip = {s.strip() for s in args.skip.split(",") if s.strip()}

    df = load(args.csv)
    if df.empty:
        sys.exit("No valid 4-digit rows found in that CSV.")
    n_draws = df.DrawDate.nunique()

    print("#" * 74)
    print(f"# 4D RANDOMNESS TEST BATTERY - {args.csv.name}")
    print("#" * 74)

    runners = [
        ("0", lambda: test_integrity(df)),
        ("1", lambda: test_power(n_draws)),
        ("2", lambda: test_digits(df)),
        ("3", lambda: test_pattern_mix(df)),
        ("4", lambda: test_markov(df)),
        ("5", lambda: test_hazard(df)),
        ("6", lambda: test_carryover(df)),
        ("7", lambda: test_backtest(df)),
        ("8", lambda: test_money(df)),
    ]
    for key, fn in runners:
        if key not in skip:
            fn()

    rule("SUMMARY")
    print(f"  {n_draws} draws analysed.")
    print("  Read TEST 1 first: if this sample cannot detect a profitable edge,")
    print("  no result below it can support a betting decision either way.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
