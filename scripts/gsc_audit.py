#!/usr/bin/env python3
"""End-to-end GSC audit for runany.dev.

Three jobs, all using the GSC Webmasters API v3 + the refresh token from
.env (set by scripts/gsc_auth.py):

1. Re-submit the sitemap so Google re-crawls the cleaned-up URL set.
2. Run urlInspection.index.inspect on the top N most recent posts and
   dump a coverage report (indexed / not indexed / reason).
3. Pull 28-day searchanalytics broken down by query and by page and
   write two CSVs to .data/.

Requires:
- GSC_REFRESH_TOKEN in .env (run scripts/gsc_auth.py first)
- The Astro blog content collection (for picking the top-N posts)

Usage:
    python3 scripts/gsc_audit.py                       # do everything
    python3 scripts/gsc_audit.py --only sitemap        # sitemap only
    python3 scripts/gsc_audit.py --only coverage       # coverage only
    python3 scripts/gsc_audit.py --only analytics      # analytics only
    python3 scripts/gsc_audit.py --top 20              # first 20 posts (default 30)
"""
import argparse
import csv
import glob
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
DATA_DIR = Path(__file__).resolve().parent.parent / ".data"
DATA_DIR.mkdir(exist_ok=True)

DEFAULT_PROPERTY = "sc-domain:runany.dev"
DEFAULT_SITEMAP = "https://runany.dev/sitemap.xml"
BLOG_DIR = Path(__file__).resolve().parent.parent / "apps/web/src/content/blog"

TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}-")
TIMESTAMP_PATTERNS = [
    re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}-"),
    re.compile(r"^\d{8}-\d{6}-"),
    re.compile(r"^\d{4}-\d{4}-\d{6}-"),
    re.compile(r"^\d{4}-\d{2}-\d{8}-"),
    re.compile(r"^\d{14}-"),
]


def get_slug(filename: str) -> str:
    base = filename[:-4] if filename.endswith(".mdx") else filename
    for p in TIMESTAMP_PATTERNS:
        m = p.match(base)
        if m:
            return base[m.end():]
    return base


def get_client() -> dict:
    candidates = sorted(glob.glob(os.path.expanduser("~/client_secret_*.json")))
    if not candidates:
        sys.exit("error: no client_secret_*.json in $HOME")
    return json.load(open(candidates[0]))["installed"]


def get_refresh_token() -> str:
    if not ENV_PATH.exists():
        sys.exit("error: .env not found")
    for line in ENV_PATH.read_text().splitlines():
        if line.startswith("GSC_REFRESH_TOKEN="):
            return line.split("=", 1)[1].strip()
    sys.exit("error: GSC_REFRESH_TOKEN not in .env (run scripts/gsc_auth.py first)")


def access_token(refresh_token: str, client: dict) -> str:
    data = urllib.parse.urlencode({
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(client["token_uri"], data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        body = json.loads(r.read())
    if "error" in body:
        sys.exit(f"error: token refresh failed: {body['error']}")
    return body["access_token"]


def gsc_request(path: str, access: str, body: dict | None = None, method: str = "POST") -> dict:
    url = f"https://www.googleapis.com/webmasters/v3/{path}"
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"GSC {method} {path} -> HTTP {e.code}: {body_text}") from e


def gsc_search_console_request(path: str, access: str, body: dict | None = None, method: str = "POST") -> dict:
    """URL Inspection lives on the Search Console API v1, not Webmasters v3."""
    url = f"https://searchconsole.googleapis.com/v1/{path}"
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"GSC {method} {path} -> HTTP {e.code}: {body_text}") from e


def submit_sitemap(access: str, property: str, sitemap_url: str) -> None:
    print(f"--- sitemaps.submit ({sitemap_url}) ---")
    gsc_request(
        f"sites/{urllib.parse.quote(property, safe='')}/sitemaps/{urllib.parse.quote(sitemap_url, safe='')}",
        access, body=None, method="PUT",
    )
    print(f"  ✓ submitted")


def load_recent_posts(top: int) -> list[str]:
    """Return the top N most recent post URLs from the blog content dir."""
    posts = []
    for fn in sorted(os.listdir(BLOG_DIR)):
        if not fn.endswith(".mdx"):
            continue
        fm_path = BLOG_DIR / fn
        try:
            head = fm_path.read_text()[:3000]
        except OSError:
            continue
        if not head.startswith("---"):
            continue
        end = head.find("\n---", 3)
        if end < 0:
            continue
        meta = {}
        for line in head[3:end].splitlines():
            m = re.match(r"^(\w+):\s*(.*)$", line)
            if m:
                meta[m.group(1)] = m.group(2).strip().strip('"')
        if meta.get("draft", "false").lower() == "true":
            continue
        if not meta.get("pubDate"):
            continue
        posts.append({
            "slug": get_slug(fn),
            "pubDate": meta["pubDate"],
            "title": meta.get("title", ""),
        })
    posts.sort(key=lambda p: p["pubDate"], reverse=True)
    return [f"https://runany.dev/blog/{p['slug']}/" for p in posts[:top]]


def coverage_audit(access: str, property: str, urls: list[str]) -> list[dict]:
    print(f"--- urlInspection.index.inspect ({len(urls)} URLs) ---")
    results = []
    for i, url in enumerate(urls, 1):
        body = {"inspectionUrl": url, "siteUrl": property}
        try:
            resp = gsc_search_console_request(
                # NOTE: the path uses / not . between urlInspection and inspect
                # (unlike most Google APIs which use :). Easy to get wrong.
                f"urlInspection/index:inspect",
                access, body=body,
            )
        except RuntimeError as e:
            print(f"  [{i}/{len(urls)}] ✗ {url}: {e}")
            results.append({"url": url, "verdict": "ERROR", "error": str(e)})
            time.sleep(0.5)
            continue
        idx = resp.get("inspectionResult", {}).get("indexStatusResult", {})
        verdict = idx.get("verdict", "UNKNOWN")
        coverage = idx.get("coverageState", "")
        last_crawl = idx.get("lastCrawlTime", "")
        referring = idx.get("pageFetchState", "")
        robots = idx.get("robotsTxtState", "")
        indexing = idx.get("indexingState", "")
        results.append({
            "url": url,
            "verdict": verdict,
            "coverage": coverage,
            "lastCrawl": last_crawl,
            "robots": robots,
            "indexing": indexing,
        })
        flag = "✓" if verdict in ("PASS", "PARTIAL") else "✗"
        print(f"  [{i}/{len(urls)}] {flag} {verdict:<8} ({coverage})  {url}")
        time.sleep(0.3)  # polite rate limit
    return results


def write_coverage_csv(results: list[dict]) -> Path:
    out = DATA_DIR / f"gsc-coverage-{date.today().isoformat()}.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["url", "verdict", "coverage", "lastCrawl", "robots", "indexing"])
        w.writeheader()
        for r in results:
            w.writerow({k: r.get(k, "") for k in w.fieldnames})
    return out


def analytics_query(access: str, property: str, dimensions: list[str], start: str, end: str, limit: int) -> list[dict]:
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": dimensions,
        "rowLimit": limit,
    }
    resp = gsc_request(
        f"sites/{urllib.parse.quote(property, safe='')}/searchAnalytics/query",
        access, body=body,
    )
    return resp.get("rows", [])


def write_analytics_csv(rows: list[dict], dimensions: list[str], out_name: str) -> Path:
    out = DATA_DIR / out_name
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow([*dimensions, "clicks", "impressions", "ctr", "position"])
        for r in rows:
            w.writerow([
                *r["keys"],
                r["clicks"],
                r["impressions"],
                f"{r['ctr']:.4f}",
                f"{r['position']:.1f}",
            ])
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["sitemap", "coverage", "analytics"],
                        help="Run only one job (default: all)")
    parser.add_argument("--property", default=DEFAULT_PROPERTY)
    parser.add_argument("--sitemap", default=DEFAULT_SITEMAP)
    parser.add_argument("--top", type=int, default=30,
                        help="Number of recent posts to inspect (default 30)")
    parser.add_argument("--days", type=int, default=28,
                        help="Lookback days for analytics (default 28)")
    args = parser.parse_args()

    client = get_client()
    refresh = get_refresh_token()
    access = access_token(refresh, client)

    print(f"Property: {args.property}")
    print(f"Refreshed access token (len={len(access)})\n")

    do_sitemap = args.only in (None, "sitemap")
    do_coverage = args.only in (None, "coverage")
    do_analytics = args.only in (None, "analytics")

    if do_sitemap:
        try:
            submit_sitemap(access, args.property, args.sitemap)
        except RuntimeError as e:
            print(f"  ✗ {e}")

    if do_coverage:
        urls = load_recent_posts(args.top)
        if not urls:
            print("no posts found in content dir")
        else:
            results = coverage_audit(access, args.property, urls)
            out = write_coverage_csv(results)
            passed = sum(1 for r in results if r.get("verdict") in ("PASS", "PARTIAL"))
            print(f"\n  coverage: {passed}/{len(results)} URLs passing")
            print(f"  written: {out}\n")

    if do_analytics:
        end_d = date.today() - timedelta(days=2)  # GSC has 2-day data lag
        start_d = end_d - timedelta(days=args.days - 1)
        start = start_d.isoformat()
        end = end_d.isoformat()
        print(f"--- searchanalytics.query ({start} → {end}, {args.days} days) ---")
        for dims, name in [(["query"], "gsc-top-queries"), (["page"], "gsc-top-pages")]:
            rows = analytics_query(access, args.property, dims, start, end, limit=50)
            if not rows:
                print(f"  (no data for {dims[0]})")
                continue
            out = write_analytics_csv(rows, dims, f"{name}-{date.today().isoformat()}.csv")
            total_clicks = sum(r["clicks"] for r in rows)
            total_impr = sum(r["impressions"] for r in rows)
            print(f"  {dims[0]:<6} top {len(rows):<3}  {total_clicks} clicks, {total_impr} impr  → {out}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
