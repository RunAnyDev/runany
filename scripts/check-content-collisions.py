#!/usr/bin/env python3
"""Check the blog content directory for slug collisions.

Two posts are considered a collision when their URLs would resolve to the
same `/blog/<slug>/` page. The URL slug is computed by
`apps/web/src/utils/slug.ts` — every timestamp variant we have seen in
the wild is stripped, so a post with a malformed filename still collides
with a post using the canonical format if their base slug is the same.

Exits with code 1 if any collision is found, 0 if clean. Designed to be
wired into a pre-commit hook (or run manually before pushing) so the
content directory can never regress into the 59-collision state we just
cleaned up on 2026-08-22.

Usage:
    python3 scripts/check-content-collisions.py
    python3 scripts/check-content-collisions.py --json   # machine-readable
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

# Mirror the patterns in apps/web/src/utils/slug.ts. If you change one,
# change the other.
TIMESTAMP_PATTERNS = [
    re.compile(r"^\d{4}-\d{2}-\d{2}-\d{6}-"),
    re.compile(r"^\d{8}-\d{6}-"),
    re.compile(r"^\d{4}-\d{4}-\d{6}-"),
    re.compile(r"^\d{4}-\d{2}-\d{8}-"),
    re.compile(r"^\d{14}-"),
]


def get_slug(filename: str) -> str:
    base = filename[:-4] if filename.endswith(".mdx") else filename
    for pattern in TIMESTAMP_PATTERNS:
        m = pattern.match(base)
        if m:
            return base[m.end():]
    return base


def parse_frontmatter(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            head = f.read(4096)
    except OSError:
        return {}
    if not head.startswith("---"):
        return {}
    end = head.find("\n---", 3)
    if end < 0:
        return {}
    out = {}
    for line in head[3:end].splitlines():
        m = re.match(r"^(\w+):\s*(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2).strip().strip('"')
    return out


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    blog_dir = os.path.join(here, "..", "apps", "web", "src", "content", "blog")
    blog_dir = os.path.normpath(blog_dir)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    if not os.path.isdir(blog_dir):
        print(f"error: blog dir not found: {blog_dir}", file=sys.stderr)
        return 2

    groups: dict = defaultdict(list)
    for fn in sorted(os.listdir(blog_dir)):
        if not fn.endswith(".mdx"):
            continue
        fm = parse_frontmatter(os.path.join(blog_dir, fn))
        if fm.get("draft", "false").lower() == "true":
            continue
        groups[get_slug(fn)].append({
            "file": fn,
            "pubDate": fm.get("pubDate", ""),
            "title": fm.get("title", ""),
        })

    collisions = {slug: files for slug, files in groups.items() if len(files) > 1}

    if args.json:
        print(json.dumps({
            "totalFiles": sum(len(v) for v in groups.values()),
            "totalSlugs": len(groups),
            "collisionCount": len(collisions),
            "collisions": collisions,
        }, indent=2))
    else:
        total = sum(len(v) for v in groups.values())
        print(f"Total .mdx files: {total}")
        print(f"Unique slugs:     {len(groups)}")
        print(f"Collisions:       {len(collisions)}")
        if collisions:
            print()
            for slug, files in sorted(collisions.items()):
                print(f"  CONFLICT /blog/{slug}/  ({len(files)} files)")
                for f in files:
                    print(f"    - {f['pubDate']:<12} {f['file']}")
            print()
            print("Fix: keep the newest file, delete or rename the others.")
            print("See apps/web/scripts/dedup-2026-08-22.json for an example.")
        else:
            print()
            print("✓ no collisions")

    return 1 if collisions else 0


if __name__ == "__main__":
    sys.exit(main())
