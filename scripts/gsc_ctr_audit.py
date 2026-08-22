#!/usr/bin/env python3
"""CTR optimization audit for runany.dev.

Pulls the (query, page) joint breakdown from GSC searchanalytics for the
last N days, then surfaces posts with the worst CTR — i.e. pages that
Google is showing (high impressions) but readers skip (low clicks).

For each opportunity the script:
- looks up the post's current title and description from MDX frontmatter
- computes position bucket (top-3 / top-10 / page-2 / buried)
- ranks by wasted-impression cost (impressions × expected-CTR gap)

Output: a markdown report at .data/gsc-ctr-audit-<date>.md plus the raw
CSV at .data/gsc-query-page-<date>.csv.

Why a separate script from gsc_audit.py: that one uses dimension=["query"]
or ["page"] alone (the GSC API rejects combining them with rowLimit > 0
on large sites). For the join, the API supports dimensions=["query","page"]
in one call — we just have to ask.

Usage:
    python3 scripts/gsc_ctr_audit.py                # 28d, top 50 query+page rows
    python3 scripts/gsc_ctr_audit.py --days 90
    python3 scripts/gsc_ctr_audit.py --min-impr 5  # tighter filter
"""
import argparse
import csv
import glob
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
DATA_DIR = Path(__file__).resolve().parent.parent / ".data"
DATA_DIR.mkdir(exist_ok=True)

DEFAULT_PROPERTY = "sc-domain:runany.dev"
BLOG_DIR = Path(__file__).resolve().parent.parent / "apps/web/src/content/blog"

# Realistic CTR baselines (position → expected CTR). Source: aggregated
# industry click-through studies. Used to compute the "expected clicks"
# baseline; the gap from actual clicks is the optimization opportunity.
POSITION_CTR = {
    1: 0.30, 2: 0.15, 3: 0.10, 4: 0.07, 5: 0.05,
    6: 0.04, 7: 0.03, 8: 0.025, 9: 0.02, 10: 0.015,
}

TS_PATTERNS = [
    re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}-"),
    re.compile(r"^\d{8}-\d{6}-"),
    re.compile(r"^\d{4}-\d{4}-\d{6}-"),
    re.compile(r"^\d{4}-\d{2}-\d{8}-"),
    re.compile(r"^\d{14}-"),
]


def get_slug(filename: str) -> str:
    base = filename[:-4] if filename.endswith(".mdx") else filename
    for p in TS_PATTERNS:
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


def gsc_request(path: str, access: str, body: dict) -> dict:
    url = f"https://www.googleapis.com/webmasters/v3/{path}"
    headers = {"Authorization": f"Bearer {access}", "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                  headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or "{}")


def position_bucket(pos: float) -> str:
    if pos <= 3:
        return "top-3"
    if pos <= 10:
        return "top-10"
    if pos <= 20:
        return "page-2"
    return "buried"


def load_post_meta() -> dict[str, dict]:
    """Map `/blog/<slug>/` URL → {title, description, category, tags, pubDate}."""
    out: dict = {}
    for fn in os.listdir(BLOG_DIR):
        if not fn.endswith(".mdx"):
            continue
        slug = get_slug(fn)
        url = f"https://runany.dev/blog/{slug}/"
        try:
            head = (BLOG_DIR / fn).read_text()[:4096]
        except OSError:
            continue
        if not head.startswith("---"):
            continue
        end = head.find("\n---", 3)
        if end < 0:
            continue
        meta: dict = {}
        for line in head[3:end].splitlines():
            m = re.match(r"^(\w+):\s*(.*)$", line)
            if m:
                v = m.group(2).strip().strip('"')
                meta[m.group(1)] = v
        if meta.get("draft", "false").lower() == "true":
            continue
        out[url] = {
            "title": meta.get("title", ""),
            "description": meta.get("description", ""),
            "category": meta.get("category", ""),
            "tags": meta.get("tags", ""),
            "pubDate": meta.get("pubDate", ""),
        }
    return out


def expected_ctr(pos: float) -> float:
    """Interpolate from POSITION_CTR table for fractional positions."""
    p = max(1.0, min(10.0, pos))
    lo = int(p)
    hi = min(10, lo + 1)
    frac = p - lo
    if lo == hi:
        return POSITION_CTR[lo]
    return POSITION_CTR[lo] * (1 - frac) + POSITION_CTR[hi] * frac


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--property", default=DEFAULT_PROPERTY)
    parser.add_argument("--days", type=int, default=28)
    parser.add_argument("--min-impr", type=int, default=0,
                        help="Min impressions to surface (default 0 — for low-traffic sites)")
    parser.add_argument("--min-gap", type=float, default=0.05,
                        help="Min expected-CTR gap to surface (default 0.05 — for low-traffic)")
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()
    # The GSC API drops 0-impression rows automatically, but be explicit
    # about the join ordering for human readers.
    print(f"Min impressions: {args.min_impr}  Min CTR-gap: {args.min_gap}")

    client = get_client()
    refresh = get_refresh_token()
    access = access_token(refresh, client)
    end_d = date.today() - timedelta(days=2)
    start_d = end_d - timedelta(days=args.days - 1)
    start, end = start_d.isoformat(), end_d.isoformat()
    print(f"Property: {args.property}")
    print(f"Range:    {start} → {end} ({args.days} days)")

    print(f"\n--- searchanalytics.query (dimensions=[query, page]) ---")
    resp = gsc_request(
        f"sites/{urllib.parse.quote(args.property, safe='')}/searchAnalytics/query",
        access,
        body={
            "startDate": start,
            "endDate": end,
            "dimensions": ["query", "page"],
            "rowLimit": 1000,  # big bucket; we filter locally
        },
    )
    rows = resp.get("rows", [])
    print(f"  {len(rows)} (query, page) rows")

    # Save raw CSV
    raw_csv = DATA_DIR / f"gsc-query-page-{date.today().isoformat()}.csv"
    with open(raw_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["query", "page", "clicks", "impressions", "ctr", "position"])
        for r in rows:
            w.writerow([*r["keys"], r["clicks"], r["impressions"],
                        f"{r['ctr']:.4f}", f"{r['position']:.1f}"])
    print(f"  raw: {raw_csv}")

    # Build the opportunity index: for each (page), aggregate wasted impressions
    # across all the queries that hit it, and find the top-CTR-gap rows.
    opportunities = []
    for r in rows:
        query, page = r["keys"]
        clicks = r["clicks"]
        impr = r["impressions"]
        pos = r["position"]
        if impr < args.min_impr:
            continue
        if clicks > 0:
            continue  # already gets clicks
        exp = expected_ctr(pos)
        expected_clicks = impr * exp
        gap = expected_clicks - clicks  # clicks we're "missing"
        if gap < args.min_gap:
            continue
        opportunities.append({
            "query": query,
            "page": page,
            "clicks": clicks,
            "impressions": impr,
            "ctr": r["ctr"],
            "position": pos,
            "expected_clicks": round(expected_clicks, 1),
            "wasted_clicks": round(gap, 1),
            "bucket": position_bucket(pos),
        })

    opportunities.sort(key=lambda o: o["wasted_clicks"], reverse=True)

    posts = load_post_meta()

    # Markdown report
    md = DATA_DIR / f"gsc-ctr-audit-{date.today().isoformat()}.md"
    lines: list[str] = []
    lines.append(f"# GSC CTR Audit — runany.dev")
    lines.append(f"")
    lines.append(f"**Range:** {start} → {end} ({args.days} days)  ")
    lines.append(f"**Property:** `{args.property}`  ")
    lines.append(f"**Generated:** {date.today().isoformat()}")
    lines.append(f"")
    lines.append(f"## Method")
    lines.append(f"")
    lines.append(f"- Pulls every (query, page) row from GSC searchanalytics")
    lines.append(f"- Filters to rows with impressions ≥ {args.min_impr} AND clicks = 0")
    lines.append(f"- Computes *expected CTR* from position via industry baselines")
    lines.append(f"- Ranks by *wasted clicks* = expected − actual (i.e. potential gain)")
    lines.append(f"")
    lines.append(f"## Top 20 opportunities (by potential clicks/month)")
    lines.append(f"")
    if not opportunities:
        lines.append(f"_No zero-click rows above {args.min_impr} impressions. Site may be too new or all queries already convert._")
    else:
        lines.append(f"| # | Query | Page | Impr | Pos | Bucket | Wasted clicks/mo |")
        lines.append(f"|---|---|---|---:|---:|---|---:|")
        for i, o in enumerate(opportunities[:20], 1):
            page_short = o["page"].replace("https://runany.dev", "")
            lines.append(f"| {i} | `{o['query']}` | `{page_short}` | {o['impressions']} | {o['position']:.1f} | {o['bucket']} | **{o['wasted_clicks']:.1f}** |")
    lines.append(f"")
    lines.append(f"## Per-post breakdown (current title/description)")
    lines.append(f"")
    lines.append(f"For each unique page that has ≥ 1 zero-click query above the impression threshold:")
    lines.append(f"")

    by_page: dict = defaultdict(list)
    for o in opportunities:
        by_page[o["page"]].append(o)

    for page, opps in sorted(by_page.items(), key=lambda kv: -sum(o["wasted_clicks"] for o in kv[1])):
        meta = posts.get(page, {})
        if not meta:
            # legacy URL or unknown slug
            lines.append(f"### `{page}`")
            lines.append(f"_⚠ No matching MDX file (likely legacy URL or slug mismatch). Review after dedup settles._")
            lines.append(f"")
            continue
        top_q = opps[0]
        total_waste = sum(o["wasted_clicks"] for o in opps)
        lines.append(f"### {meta['title']}")
        lines.append(f"")
        lines.append(f"- URL: `{page}`")
        lines.append(f"- Category: `{meta.get('category', '?')}` · Pub: `{meta.get('pubDate', '?')}`")
        # Use single-quoted outer f-strings to allow " inside (Python < 3.12 compat)
        zero_q = ", ".join("`" + o["query"] + "`" for o in opps[:5])
        lines.append(f"- Zero-click queries ({len(opps)}): {zero_q}")
        if len(opps) > 5:
            lines.append(f"  … and {len(opps) - 5} more")
        lines.append(f"- Top opportunity: `{top_q['query']}` (pos {top_q['position']:.1f}, {top_q['impressions']} impr)")
        lines.append(f"- Total wasted clicks/mo: **{total_waste:.1f}**")
        lines.append(f"")
        lines.append(f"**Current title:** {meta.get('title', '_missing_')}")
        lines.append(f"")
        lines.append(f"**Current description ({len(meta.get('description', ''))} chars):**")
        lines.append(f"> {meta.get('description', '_missing_')}")
        lines.append(f"")
        # Heuristic suggestions
        suggestions: list[str] = []
        title = meta.get("title", "").lower()
        desc = meta.get("description", "").lower()
        for o in opps[:5]:
            q_tokens = [t for t in re.findall(r"\w+", o["query"].lower())
                        if len(t) > 2 and t not in {"the", "and", "for", "with", "how", "what", "best", "top", "open", "source"}]
            for token in q_tokens:
                if token not in title:
                    suggestions.append(f"Query `{o['query']}` → consider adding **{token}** to title/description (currently absent)")
                    break
        if o["position"] <= 10 and o["impressions"] >= 5:
            suggestions.append("Page ranks in top-10 but loses 100% of clicks — title or description is likely mismatched to search intent; rewrite to mirror the query wording.")
        if len(meta.get("description", "")) > 200:
            suggestions.append(f"Description is {len(meta['description'])} chars — Google may rewrite in SERPs; tighten to 140-160 and lead with the main keyword.")
        if meta.get("description", "").endswith("…") or meta.get("description", "").endswith("..."):
            suggestions.append("Description was truncated by the 160-char limit in BaseLayout.rewrite; consider tightening the source description.")
        if suggestions:
            seen = set()
            lines.append(f"**Heuristic suggestions:**")
            for s in suggestions:
                if s in seen:
                    continue
                seen.add(s)
                lines.append(f"- {s}")
            lines.append(f"")
    lines.append(f"---")
    lines.append(f"_Generated by `scripts/gsc_ctr_audit.py` against live GSC API._")
    md.write_text("\n".join(lines))
    print(f"\nReport: {md}")
    print(f"\nTop opportunity:")
    if opportunities:
        o = opportunities[0]
        print(f"  {o['query']!r} → {o['page']}")
        print(f"  {o['impressions']} impr, pos {o['position']:.1f}, {o['wasted_clicks']:.1f} wasted clicks/mo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
