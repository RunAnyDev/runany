#!/usr/bin/env python3
"""Scrape github.com/trending and return trending repositories as JSON.

Default: daily trending, all languages (~25 repos on the main page).
Flags:
  --since {daily|weekly|monthly}   # default: daily
  --language <name>                # e.g. python, typescript, go
  --spoken-language <name>         # e.g. en, zh (for descriptions)
  --top N                          # cap output (default: 25)
  --output {json|paths}            # default: json (full metadata)

Output (JSON): array of objects with fields
  full_name, owner, name, url, description, language,
  stars_total, stars_period, period, lang_filter

Exit code: 0 success, 1 network/parse failure.

Usage (cron):
  python3 scripts/gh_trending.py
  python3 scripts/gh_trending.py --since weekly --language python
"""
import argparse
import json
import re
import sys
import urllib.request
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
BASE = "https://github.com/trending"


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")


def parse_stars_today_text(text):
    """Parse '3,440 stars today' / '120 stars this week' → integer."""
    m = re.search(r"([\d,]+)\s+stars?\s+(today|this\s+week|this\s+month)", text, re.I)
    if not m:
        return 0
    return int(m.group(1).replace(",", ""))


def parse_int(text):
    m = re.search(r"([\d,]+)", text)
    return int(m.group(1).replace(",", "")) if m else 0


def parse_page(html, period, lang_filter):
    soup = BeautifulSoup(html, "html.parser")
    repos = []
    for article in soup.find_all("article", class_="Box-row"):
        h2 = article.find("h2")
        if not h2:
            continue
        a = h2.find("a", href=True)
        if not a:
            continue
        href = a["href"].strip()
        if not href.startswith("/") or href.count("/") < 2:
            continue
        parts = [p for p in href.split("/") if p]
        if len(parts) < 2:
            continue
        owner, name = parts[0], parts[1]
        full_name = f"{owner}/{name}"

        p = article.find("p")
        description = p.get_text(" ", strip=True) if p else ""

        lang_span = article.find("span", itemprop="programmingLanguage")
        language = lang_span.get_text(strip=True) if lang_span else ""

        # total stars: the first <a href="/.../stargazers">
        stars_total = 0
        star_links = article.find_all("a", href=re.compile(r"/stargazers$"))
        if star_links:
            stars_total = parse_int(star_links[0].get_text(" ", strip=True))

        # stars in period: span containing "stars today/this week/this month"
        stars_period = 0
        for span in article.find_all("span"):
            t = span.get_text(" ", strip=True)
            if "star" in t.lower() and ("today" in t.lower() or "this week" in t.lower() or "this month" in t.lower()):
                stars_period = parse_stars_today_text(t)
                break

        repos.append({
            "full_name": full_name,
            "owner": owner,
            "name": name,
            "url": f"https://github.com/{full_name}",
            "description": description,
            "language": language,
            "stars_total": stars_total,
            "stars_period": stars_period,
            "period": period,
            "lang_filter": lang_filter,
        })
    return repos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", choices=["daily", "weekly", "monthly"], default="daily")
    ap.add_argument("--language", default="")
    ap.add_argument("--spoken-language", default="")
    ap.add_argument("--top", type=int, default=25)
    ap.add_argument("--output", choices=["json", "paths"], default="json")
    args = ap.parse_args()

    since = {"daily": "daily", "weekly": "weekly", "monthly": "monthly"}[args.since]
    url = BASE
    qp = []
    if since != "daily":
        qp.append(f"since={since}")
    if args.language:
        qp.append(args.language)
    if args.spoken_language:
        qp.append(args.spoken_language)
    if qp:
        url = f"{BASE}?{'&'.join(qp)}"

    try:
        html = fetch(url)
    except Exception as e:
        print(f"Fetch failed: {url}: {e}", file=sys.stderr)
        sys.exit(1)

    repos = parse_page(html, period=args.since, lang_filter=args.language)[: args.top]
    if not repos:
        print(f"No repos parsed from {url}", file=sys.stderr)
        sys.exit(1)

    if args.output == "paths":
        for r in repos:
            print(r["full_name"])
    else:
        print(json.dumps(repos, indent=2))


if __name__ == "__main__":
    main()
