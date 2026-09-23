#!/usr/bin/env python3
"""
fetch_magnum.py - pull Magnum 4D past results into a clean CSV.

Run this on your OWN machine. The Claude Code sandbox blocks lottery domains
at the network gateway (403 on CONNECT for magnum4d.my and every mirror), so
collection has to happen client-side; analysis runs anywhere.

STEP 1 - probe the endpoint (do this first, it answers what the API returns)

    python3 scripts/fetch_magnum.py --probe

  Fetches once, reports HTTP status / content-type / payload shape, saves the
  raw body under data/raw/, and prints a preview. Send that file over and the
  parser can be pinned exactly.

STEP 2 - collect

    python3 scripts/fetch_magnum.py --draws 10
    python3 scripts/fetch_magnum.py --draws 200 --end 2026-09-12

Two sources are supported:

  between-dates  (default)  ONE request for N draws, via
                 /results/past/between-dates/{start}/{end}/{count}
                 Far preferable: no per-date scraping, no guessing at HTML.

  per-date       (--source per-date)  the older page-scraping path,
                 /en/results/past-results?date=YYYY-MM-DD, one request per
                 calendar date. Kept as a fallback.

Output
------
  data/raw/...              raw payloads, kept so the parser can be corrected
                            without re-fetching
  data/magnum_results.csv   DrawDate,DrawNo,PrizeCode,Digit

PrizeCode matches the reference Singapore Pools dataset so analyze_4d.py runs
unchanged on either file:

    1 = 1st prize   2 = 2nd prize   3 = 3rd prize
    S = Special (10)                C = Consolation (10)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Install it with:  pip install requests")

HOST = "https://www.magnum4d.my"
BETWEEN_URL = HOST + "/results/past/between-dates/{start}/{end}/{count}"
PERDATE_URL = HOST + "/en/results/past-results"

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_CSV = ROOT / "data" / "magnum_results.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
}

FOUR_DIGIT = re.compile(r"(?<!\d)(\d{4})(?!\d)")
DRAW_NO = re.compile(r"(?<!\d)(\d{3,4}/\d{2})(?!\d)")
ISO_DATE = re.compile(r"(\d{4}-\d{2}-\d{2})")
DMY_DATE = re.compile(r"(\d{2})[/-](\d{2})[/-](\d{4})")

EXPECTED = {"1": 1, "2": 1, "3": 1, "S": 10, "C": 10}

# Key-name patterns for locating prize fields inside arbitrary JSON.
KEY_PATTERNS = [
    ("1", re.compile(r"first|1st|prize_?0?1$|^p1$", re.I)),
    ("2", re.compile(r"second|2nd|prize_?0?2$|^p2$", re.I)),
    ("3", re.compile(r"third|3rd|prize_?0?3$|^p3$", re.I)),
    ("S", re.compile(r"special|istimewa|starter", re.I)),
    ("C", re.compile(r"consol|saguhati", re.I)),
]
DATE_KEY = re.compile(r"draw_?date|^date$|result_?date", re.I)
DRAWNO_KEY = re.compile(r"draw_?no|draw_?num|^no$|draw_?id", re.I)

# Text anchors for the HTML fallback (English + Malay).
ANCHORS = [
    ("1", r"(?:1st|first|pertama)\s*prize|hadiah\s*pertama"),
    ("2", r"(?:2nd|second|kedua)\s*prize|hadiah\s*kedua"),
    ("3", r"(?:3rd|third|ketiga)\s*prize|hadiah\s*ketiga"),
    ("S", r"special|istimewa"),
    ("C", r"consolation|saguhati"),
]


class Blocked(Exception):
    """The network refuses this host outright - retrying cannot help."""


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
def get(session: requests.Session, url: str, retries: int = 4):
    """GET a URL. Returns (status, content_type, body) or (None, None, None)."""
    delay = 2.0
    for attempt in range(1, retries + 1):
        try:
            r = session.get(url, headers=HEADERS, timeout=45)
        except requests.exceptions.ProxyError as exc:
            raise Blocked(str(exc)) from exc
        except requests.RequestException as exc:
            print(f"    network error ({exc.__class__.__name__}), "
                  f"retry {attempt}/{retries} in {delay:.0f}s")
            time.sleep(delay)
            delay *= 2
            continue
        if r.status_code == 200:
            return r.status_code, r.headers.get("content-type", ""), r.text
        if r.status_code == 404:
            return 404, r.headers.get("content-type", ""), None
        if r.status_code in (429, 500, 502, 503, 504):
            print(f"    HTTP {r.status_code}, retry {attempt}/{retries} "
                  f"in {delay:.0f}s")
            time.sleep(delay)
            delay *= 2
            continue
        return r.status_code, r.headers.get("content-type", ""), r.text
    return None, None, None


# --------------------------------------------------------------------------
# JSON parsing
# --------------------------------------------------------------------------
def digits_in(value) -> list[str]:
    """All 4-digit tokens inside any JSON value, order preserved."""
    if value is None:
        return []
    if isinstance(value, (str, int)):
        return FOUR_DIGIT.findall(str(value))
    return FOUR_DIGIT.findall(json.dumps(value))


def normalise_date(node) -> str | None:
    """Pull an ISO date out of a draw record, accepting dd/mm/yyyy too."""
    blob = json.dumps(node) if not isinstance(node, str) else node
    m = ISO_DATE.search(blob)
    if m:
        return m.group(1)
    m = DMY_DATE.search(blob)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo}-{d}"
    return None


def harvest_draw(node: dict) -> tuple[str | None, str | None, list[tuple[str, str]]] | None:
    """
    If this dict looks like one draw record, return (date, draw_no, rows).
    A record qualifies when it has exactly one each of 1st/2nd/3rd prize and
    some Special and Consolation numbers. Special/Consolation may be short:
    Magnum marks an empty slot with a placeholder such as "----", and such a
    draw is still a real draw - dropping it would silently skew the data.
    """
    rows: list[tuple[str, str]] = []
    for code, pat in KEY_PATTERNS:
        for key, val in node.items():
            if pat.search(str(key)):
                nums = digits_in(val)[:EXPECTED[code]]
                rows.extend((code, n) for n in nums)
    counts = {c: sum(1 for k, _ in rows if k == c) for c in EXPECTED}
    if not (all(counts[c] == 1 for c in "123")
            and 1 <= counts["S"] <= EXPECTED["S"]
            and 1 <= counts["C"] <= EXPECTED["C"]):
        return None

    drawdate = None
    drawno = None
    for key, val in node.items():
        if drawdate is None and DATE_KEY.search(str(key)):
            drawdate = normalise_date(val)
        if drawno is None and DRAWNO_KEY.search(str(key)):
            m = DRAW_NO.search(str(val))
            drawno = m.group(1) if m else str(val).strip()
    if drawdate is None:
        drawdate = normalise_date(node)
    return drawdate, drawno, rows


def parse_json_draws(data) -> list[tuple[str | None, str | None, list[tuple[str, str]]]]:
    """Walk arbitrary JSON and collect every draw record found."""
    out = []
    seen: set[int] = set()

    def walk(node):
        if isinstance(node, dict):
            if id(node) not in seen:
                seen.add(id(node))
                got = harvest_draw(node)
                if got:
                    out.append(got)
                    return  # don't descend into a record already harvested
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    return out


# --------------------------------------------------------------------------
# HTML parsing (fallback)
# --------------------------------------------------------------------------
def strip_html(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>", "\n", html)
    html = re.sub(r"(?i)</(tr|div|p|li|td|th|h\d|section)>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    text = (text.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&#39;", "'").replace("&quot;", '"'))
    return re.sub(r"[ \t\r\f\v]+", " ", text)


def embedded_json(html: str):
    """Extract any inlined framework payload (__NEXT_DATA__ etc.)."""
    for blob in re.findall(
        r'(?is)<script[^>]*(?:id="__NEXT_DATA__"|type="application/json")[^>]*>(.*?)</script>',
        html,
    ):
        try:
            yield json.loads(blob.strip())
        except (json.JSONDecodeError, ValueError):
            continue


def parse_text_anchors(text: str) -> list[tuple[str, str]]:
    spans = []
    for code, pattern in ANCHORS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            spans.append((m.start(), m.end(), code))
    spans.sort()
    out: list[tuple[str, str]] = []
    for i, (_, end, code) in enumerate(spans):
        stop = spans[i + 1][0] if i + 1 < len(spans) else len(text)
        nums = FOUR_DIGIT.findall(text[end:stop])
        out.extend((code, n) for n in nums[:EXPECTED[code]])
    return out


def parse_body(body: str):
    """
    Parse a response of unknown type. Returns (draws, method) where draws is
    a list of (date, draw_no, rows).
    """
    stripped = body.lstrip()
    if stripped[:1] in "[{":
        try:
            draws = parse_json_draws(json.loads(stripped))
            if draws:
                return draws, "json-api"
        except (json.JSONDecodeError, ValueError):
            pass

    for payload in embedded_json(body):
        draws = parse_json_draws(payload)
        if draws:
            return draws, "embedded-json"

    text = strip_html(body)
    rows = parse_text_anchors(text)
    if rows:
        dn = DRAW_NO.search(text)
        return [(normalise_date(text), dn.group(1) if dn else None, rows)], "text-anchor"
    return [], "none"


def validate(rows) -> tuple[bool, str]:
    """Accept full draws, and draws whose only gap is empty Special/Consolation slots."""
    counts = {c: sum(1 for k, _ in rows if k == c) for c in EXPECTED}
    if counts == EXPECTED:
        return True, "ok"
    if (all(counts[c] == 1 for c in "123")
            and counts["S"] <= EXPECTED["S"] and counts["C"] <= EXPECTED["C"]):
        blanks = (EXPECTED["S"] - counts["S"]) + (EXPECTED["C"] - counts["C"])
        return True, f"{blanks} empty prize slot(s)"
    return False, f"expected {EXPECTED}, got {counts}"


# --------------------------------------------------------------------------
# probe
# --------------------------------------------------------------------------
def do_probe(session, url: str) -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Probing: {url}\n")
    try:
        status, ctype, body = get(session, url)
    except Blocked as exc:
        print(f"NETWORK BLOCKED: this machine's proxy refuses {HOST}.\n  {exc}")
        return 2
    if body is None:
        print(f"HTTP {status} - no body returned.")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = RAW_DIR / f"probe_{stamp}.txt"
    out.write_text(body, encoding="utf-8")

    print(f"HTTP status   : {status}")
    print(f"Content-Type  : {ctype or '(none)'}")
    print(f"Body size     : {len(body):,} bytes")

    stripped = body.lstrip()
    if stripped[:1] in "[{":
        try:
            data = json.loads(stripped)
            kind = type(data).__name__
            print(f"Payload       : valid JSON ({kind})")
            if isinstance(data, list):
                print(f"Top-level list length: {len(data)}   <-- compare to your"
                      f" count parameter")
            elif isinstance(data, dict):
                print(f"Top-level keys: {list(data.keys())[:12]}")
        except (json.JSONDecodeError, ValueError) as exc:
            print(f"Payload       : starts like JSON but failed to parse ({exc})")
    else:
        print("Payload       : looks like HTML/text, not JSON")

    draws, method = parse_body(body)
    print(f"\nParser result : {len(draws)} draw(s) via '{method}'")
    for i, (d, no, rows) in enumerate(draws[:3]):
        ok, why = validate(rows)
        print(f"  draw {i+1}: date={d} no={no} rows={len(rows)} valid={ok} ({why})")
        by: dict[str, list[str]] = {}
        for c, n in rows:
            by.setdefault(c, []).append(n)
        for c in ["1", "2", "3", "S", "C"]:
            if c in by:
                print(f"      {c}: {by[c]}")
    if len(draws) > 3:
        print(f"  ... and {len(draws)-3} more")

    print(f"\nRaw body saved to {out.relative_to(ROOT)}")
    if not draws:
        print("\nParser found nothing. Send that file over and the parser can be"
              " written against the real shape.")
    print("\nTo confirm the trailing number is a draw count, compare:")
    print("  --probe --draws 2   vs   --probe --draws 25")
    print("and check the reported draw count tracks it.")
    return 0


# --------------------------------------------------------------------------
# collection
# --------------------------------------------------------------------------
def collect_between(session, end: date, count: int, start: str) -> tuple[list, list]:
    url = BETWEEN_URL.format(start=start, end=end.isoformat(), count=count)
    print(f"Requesting {count} draw(s): {url}\n")
    status, _, body = get(session, url)
    if body is None:
        print(f"  HTTP {status} - nothing returned")
        return [], []
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache = RAW_DIR / f"between_{end.isoformat()}_{count}.txt"
    cache.write_text(body, encoding="utf-8")

    draws, method = parse_body(body)
    rows_out, bad = [], []
    for d, no, rows in draws:
        ok, why = validate(rows)
        if not ok:
            bad.append(f"{d or '?'}: {why}")
            continue
        if not d:
            bad.append(f"{no or '?'}: record has no parseable date")
            continue
        note = "" if why == "ok" else f"  ({why})"
        print(f"  {d}  draw {(no or '?'):>8}  {len(rows)} numbers  [{method}]{note}")
        rows_out.extend((d, no or "", c, n) for c, n in rows)
    return rows_out, bad


def collect_per_date(session, dates: list[date], date_format: str,
                     sleep: float, target: int | None, force: bool):
    rows_out, bad, ok_count = [], [], 0
    for d in dates:
        if target and ok_count >= target:
            break
        iso = d.isoformat()
        cache = RAW_DIR / f"magnum_{iso}.html"
        if cache.exists() and not force:
            body = cache.read_text(encoding="utf-8", errors="replace")
            src = "cache"
        else:
            _, _, body = get(session, f"{PERDATE_URL}?"
                             + urlencode({"date": d.strftime(date_format)}))
            src = "web"
            time.sleep(sleep)
            if body:
                RAW_DIR.mkdir(parents=True, exist_ok=True)
                cache.write_text(body, encoding="utf-8")
        if not body:
            continue
        draws, method = parse_body(body)
        for _, no, rows in draws:
            ok, why = validate(rows)
            if not ok:
                bad.append(f"{iso}: {why}")
                continue
            ok_count += 1
            note = "" if why == "ok" else f"  ({why})"
            print(f"  {iso}  draw {(no or iso):>8}  {len(rows)} numbers "
                  f"[{method}/{src}]{note}")
            rows_out.extend((iso, no or "", c, n) for c, n in rows)
    return rows_out, bad


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["between-dates", "per-date"],
                    default="between-dates",
                    help="which endpoint to use (default between-dates)")
    ap.add_argument("--probe", action="store_true",
                    help="fetch once, report shape, save body, do not write CSV")
    ap.add_argument("--draws", type=int, default=10,
                    help="number of draws to request (default 10)")
    ap.add_argument("--end", help="end date YYYY-MM-DD (default today)")
    ap.add_argument("--start-param", default="null",
                    help="value for the {start} path segment (default 'null')")
    ap.add_argument("--days", type=int,
                    help="per-date mode: scan the last N calendar days")
    ap.add_argument("--date-format", default="%Y-%m-%d",
                    help="per-date mode: strftime for ?date= (default %%Y-%%m-%%d)")
    ap.add_argument("--sleep", type=float, default=1.5,
                    help="per-date mode: seconds between requests")
    ap.add_argument("--force", action="store_true",
                    help="per-date mode: re-fetch cached dates")
    args = ap.parse_args()

    end = (datetime.strptime(args.end, "%Y-%m-%d").date()
           if args.end else date.today())
    session = requests.Session()

    if args.probe:
        url = (BETWEEN_URL.format(start=args.start_param, end=end.isoformat(),
                                  count=args.draws)
               if args.source == "between-dates"
               else f"{PERDATE_URL}?" + urlencode({"date": end.strftime(args.date_format)}))
        return do_probe(session, url)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    try:
        if args.source == "between-dates":
            rows, bad = collect_between(session, end, args.draws, args.start_param)
        else:
            span = args.days or (args.draws * 4 + 40)
            dates = [end - timedelta(days=i) for i in range(span)]
            target = None if args.days else args.draws
            rows, bad = collect_per_date(session, dates, args.date_format,
                                         args.sleep, target, args.force)
    except Blocked as exc:
        print(f"\nNETWORK BLOCKED: this machine's proxy refuses {HOST}.")
        print(f"  {exc}")
        print("\nRun this from a machine with normal internet access, then copy")
        print("data/magnum_results.csv back for analysis.")
        return 2

    if not rows:
        print("\nNo results parsed. Run with --probe to inspect what the")
        print("endpoint actually returns, then send the saved body over.")
        return 1

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["DrawDate", "DrawNo", "PrizeCode", "Digit"])
        w.writerows(sorted(set(rows)))

    n_draws = len({r[0] for r in rows})
    print(f"\nCollected {n_draws} draws / {len(rows)} numbers")
    print(f"Wrote {OUT_CSV.relative_to(ROOT)}")
    if n_draws != args.draws and args.source == "between-dates":
        print(f"\nNOTE: requested {args.draws} but got {n_draws} draws - the"
              " trailing\n  path number may not be a simple count. Worth"
              " checking with --probe.")
    if bad:
        print(f"\n{len(bad)} record(s) failed validation:")
        for b in bad[:6]:
            print(f"  {b}")
    print(f"\nNext:  python3 scripts/analyze_4d.py {OUT_CSV.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
