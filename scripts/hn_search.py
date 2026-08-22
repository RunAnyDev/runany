#!/usr/bin/env python3
"""
Search HN Algolia for non-GitHub trending tools.

Lean mode for cron:
- fewer queries
- smaller hitsPerPage
- domain-level dedup first
- optional shortlist JSON for direct agent consumption

Usage:
  python3 scripts/hn_search.py
  python3 scripts/hn_search.py --min-points 80 --top 12
  python3 scripts/hn_search.py --shortlist --top 6

Output: JSONL by default, one object per line.
"""
import urllib.request, json, sys, argparse
from urllib.parse import urlparse

QUERIES = [
    "show+hn+AI+agent+tool",
    "show+hn+launch+developer+tool",
    "YC+W26+launch",
    "browser+automation+agent+YC+launch",
    "self-hosted+server+tool+launch",
    "MCP+server+tool+show+hn",
]


def fetch_query(q, timeout=10, hits_per_page=12):
    try:
        url = f"https://hn.algolia.com/api/v1/search?query={q}&tags=story&hitsPerPage={hits_per_page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read()).get("hits", [])
    except Exception as e:
        print(f"Query failed: {q}: {e}", file=sys.stderr)
        return []


def is_github_url(u):
    if not u:
        return False
    u = u.lower()
    return "github.com" in u or "github.io" in u


def norm_domain(u):
    if not u:
        return ""
    try:
        host = (urlparse(u).netloc or "").lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def title_text(h):
    return (h.get("title") or h.get("story_title") or "").strip()


def to_hit(h, q):
    return {
        "id": h.get("objectID") or "",
        "title": title_text(h),
        "url": h.get("url") or "",
        "points": h.get("points", 0) or 0,
        "created": (h.get("created_at") or "")[:10],
        "query": q,
        "domain": norm_domain(h.get("url") or ""),
        "num_comments": h.get("num_comments", 0) or 0,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-points", type=int, default=60, help="Drop hits below this score")
    parser.add_argument("--include-github", action="store_true", help="Include GitHub URLs (default: filter out)")
    parser.add_argument("--top", type=int, default=12, help="Number of top hits to print")
    parser.add_argument("--hits-per-query", type=int, default=12, help="Algolia hits per query")
    parser.add_argument("--human", action="store_true", help="Human-readable output")
    parser.add_argument("--shortlist", action="store_true", help="Emit one compact JSON object with top candidates")
    args = parser.parse_args()

    all_hits = []
    seen_ids = set()
    seen_domains = set()

    for q in QUERIES:
        for raw in fetch_query(q, hits_per_page=args.hits_per_query):
            hit = to_hit(raw, q)
            oid = hit["id"]
            if not oid or oid in seen_ids:
                continue
            seen_ids.add(oid)
            if not hit["title"] or not hit["url"]:
                continue
            if not args.include_github and is_github_url(hit["url"]):
                continue
            if hit["points"] < args.min_points:
                continue
            dom = hit["domain"]
            if dom and dom in seen_domains:
                continue
            if dom:
                seen_domains.add(dom)
            all_hits.append(hit)

    all_hits.sort(key=lambda x: (-x["points"], -x["num_comments"], x["created"]))
    top_hits = all_hits[:args.top]

    if args.shortlist:
        payload = {
            "queries": len(QUERIES),
            "hits_per_query": args.hits_per_query,
            "returned": len(top_hits),
            "candidates": [
                {
                    "title": h["title"],
                    "url": h["url"],
                    "domain": h["domain"],
                    "points": h["points"],
                    "created": h["created"],
                }
                for h in top_hits
            ],
        }
        print(json.dumps(payload, ensure_ascii=False))
        return

    if args.human:
        for h in top_hits:
            print(f"{h['points']:>5} | {h['title'][:80]}")
            print(f"        URL: {h['url'][:90]}")
            print(f"        DOMAIN: {h['domain']} | {h['created']} | {h['query']}")
            print()
    else:
        for h in top_hits:
            print(json.dumps(h, ensure_ascii=False))


if __name__ == "__main__":
    main()
