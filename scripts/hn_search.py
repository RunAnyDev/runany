#!/usr/bin/env python3
"""
Search HN Algolia for non-GitHub trending tools.

Lean mode for cron:
- fewer queries
- smaller hitsPerPage
- domain-level dedup first
- optional shortlist JSON for direct agent consumption

Recency:
By default only stories published in the last --max-age-days days are
considered, and the search runs against Algolia's search_by_date endpoint.
The old behaviour (sort every query by points, no age bound) made the
shortlist a fixed set of classic launches that the blog had already
covered, so the pipeline returned nothing new forever. Pass
--max-age-days 0 to restore the unbounded, points-sorted search.

Usage:
  python3 scripts/hn_search.py
  python3 scripts/hn_search.py --min-points 80 --top 12
  python3 scripts/hn_search.py --shortlist --top 6
  python3 scripts/hn_search.py --max-age-days 0 --shortlist

Output: JSONL by default, one object per line.
"""
import urllib.request, json, sys, argparse, time
from urllib.parse import urlparse

QUERIES = [
    "show+hn+AI+agent+tool",
    "show+hn+launch+developer+tool",
    "YC+W26+launch",
    "browser+automation+agent+YC+launch",
    "self-hosted+server+tool+launch",
    "MCP+server+tool+show+hn",
    "Show+HN",
    "Launch+HN",
    "AI+tool",
    "developer+tool",
    "CLI+tool",
    "self-hosted",
    "MCP+server",
    "open+source+tool",
    "app+for+developers",
    "terminal+tool",
    "agent+framework",
    "SDK+for+developers",
    # Niche queries added 2026-10-30: the original 18 queries were fully
    # exhausted (every hit already in written-repos.txt), so widen the net.
    "show+hn+privacy+tool",
    "show+hn+database+server",
    "show+hn+observability+monitoring",
    "show+hn+local+first+sync",
    "show+hn+password+manager",
    "show+hn+file+sharing+tool",
    "show+hn+api+client+gui",
    "show+hn+data+visualization+dashboard",
    "show+hn+terminal+app+cli",
    "show+hn+automation+workflow",
    "show+hn+developer+editor+ide",
    "show+hn+static+site+generator",
    "show+hn+proxy+networking+tool",
    "show+hn+search+engine+tool",
    "show+hn+note+taking+app",
    "show+hn+media+transcoder",
    "show+hn+remote+desktop",
    "show+hn+email+client+tool",
    "show+hn+open+source+alternative",
    "show+hn+crypto+wallet+tool",
    "show+hn+task+manager+tool",
    "show+hn+calendar+tool",
    "show+hn+code+review+tool",
    "show+hn+testing+framework+tool",
    "show+hn+rag+tool",
    "show+hn+llm+inference+server",
    "show+hn+vector+database",
    "show+hn+model+evaluation+tool",
    "show+hn+transcription+tool",
    "show+hn+screenshot+tool",
    "show+hn+markdown+tool",
    "show+hn+docker+kubernetes+tool",
    "show+hn+backup+tool",
    "show+hn+email+newsletter+tool",
]

# Domains that mostly publish news, opinion or lore rather than a runnable
# tool. Kept small and explicit so a real launch on a big domain is not lost.
NEWS_DOMAINS = {
    "reuters.com", "www.reuters.com", "apnews.com", "arstechnica.com",
    "techspot.com", "phoronix.com", "www.phoronix.com", "theguardian.com",
    "bbc.com", "www.bbc.com", "cnn.com", "www.cnn.com", "nytimes.com",
    "www.nytimes.com", "washingtonpost.com", "www.washingtonpost.com",
    "bloomberg.com", "www.bloomberg.com", "axios.com", "www.axios.com",
    "linkedin.com", "www.linkedin.com", "medium.com", "substack.com",
    "reddit.com", "www.reddit.com", "news.ycombinator.com",
    "spectrum.ieee.org", "ieee.org", "www.ieee.org", "eff.org",
    "acm.org", "dl.acm.org", "arxiv.org", "www.arxiv.org", "wikipedia.org",
    "en.wikipedia.org", "github.blog", "blog.google", "opensource.google",
    "blogs.windows.com", "news.sky.com", "cpr.dk", "discuss.grapheneos.org",
    "judgments.fedcourt.gov.au", "ipinfo.io", "www.ipinfo.io",
}


def fetch_query(q, timeout=10, hits_per_page=12, min_created_at=None):
    """Fetch one query. Uses search_by_date when a recency bound is given so
    Algolia returns recent stories instead of all-time top scorers."""
    try:
        if min_created_at:
            url = (
                f"https://hn.algolia.com/api/v1/search_by_date?query={q}&tags=story"
                f"&numericFilters=created_at_i>{min_created_at}&hitsPerPage={hits_per_page}"
            )
        else:
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
    parser.add_argument("--max-age-days", type=int, default=45,
                        help="Only consider stories published in the last N days (0 = no age bound)")
    parser.add_argument("--include-news", action="store_true",
                        help="Keep news/opinion domains (default: filter out)")
    args = parser.parse_args()

    min_created_at = None
    if args.max_age_days and args.max_age_days > 0:
        min_created_at = int(time.time()) - (args.max_age_days * 86400)

    all_hits = []
    seen_ids = set()
    seen_domains = set()

    for q in QUERIES:
        for raw in fetch_query(q, hits_per_page=args.hits_per_query, min_created_at=min_created_at):
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
            if not args.include_news and dom in NEWS_DOMAINS:
                continue
            if dom and dom in seen_domains:
                continue
            if dom:
                seen_domains.add(dom)
            all_hits.append(hit)

    # Newest first among ties, then highest score wins (stable sort idiom).
    all_hits.sort(key=lambda x: x["created"], reverse=True)
    all_hits.sort(key=lambda x: (-x["points"], -x["num_comments"]))
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
