#!/usr/bin/env python3
"""
serve.py - run the web tool locally, with one-click Magnum result fetching.

    python3 scripts/serve.py
    then open http://localhost:8000

Why this exists
---------------
Browsers only let a page read data from another website if that site
explicitly allows it (CORS). Magnum does not, so the web tool's
"Fetch Magnum results" button cannot read magnum4d.my directly - even though
the same address opens fine in a browser tab.

This helper serves the web tool AND fetches Magnum's results on the page's
behalf. The browser only ever talks to localhost, so the restriction never
applies. It uses only the Python standard library - nothing to install.

Only Magnum's past-results addresses are forwarded; it is not a general
proxy, and it listens on localhost only, so nothing else on your network
can use it.

Options
-------
    --port 8000      port to listen on
    MAGNUM_BASE=...  (environment variable) override the upstream address,
                     used for testing against a local copy of the data
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM = os.environ.get("MAGNUM_BASE", "https://www.magnum4d.my").rstrip("/")
PROXY_PREFIX = "/api/magnum/"
ALLOWED_PREFIX = "results/past/"

UPSTREAM_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self.proxy(self.path[len(PROXY_PREFIX):])
        else:
            super().do_GET()

    def send_json(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def proxy(self, path: str) -> None:
        path = path.split("?", 1)[0]
        if not path.startswith(ALLOWED_PREFIX) or ".." in path:
            self.send_json(403, {"error": "Only Magnum past-results addresses are forwarded."})
            return

        url = f"{UPSTREAM}/{path}"
        req = urllib.request.Request(url, headers=UPSTREAM_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                body = resp.read()
                status = resp.status
                ctype = resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as exc:
            self.send_json(exc.code, {"error": f"Magnum answered HTTP {exc.code}", "url": url})
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            self.send_json(502, {"error": f"Could not reach Magnum: {reason}", "url": url})
            return

        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Keep the console readable: only log the proxied calls and errors.
        line = fmt % args
        if PROXY_PREFIX in line or " 4" in line or " 5" in line:
            sys.stderr.write(f"{self.log_date_time_string()}  {line}\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Web tool:  http://localhost:{args.port}")
    print(f"Fetching Magnum results via: {UPSTREAM}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
