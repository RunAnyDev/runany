#!/usr/bin/env python3
"""Submit URLs to the IndexNow API for instant indexing.

IndexNow is supported by Bing, Yandex, DuckDuckGo, Seznam, Naver, Ecosia.
Google is NOT a direct IndexNow consumer (it crawls the sitemap and links
instead), but Bing indexing propagates to many downstream services and
helps with discovery latency for the rest of the open web.

The site already hosts the IndexNow key file at
    /c9249bca604d975c9bea6cda8c933688.txt
(per AGENTS.md + BaseLayout.astro). The key is read from .env (INDEXNOW_KEY)
or, if missing, falls back to that filename so the API can verify ownership.

Usage:
    # Submit every public post (slow — use sparingly)
    python3 scripts/indexnow_submit.py --all

    # Submit a specific list of URLs
    python3 scripts/indexnow_submit.py https://runany.dev/blog/foo/ https://runany.dev/blog/bar/

    # Submit the diff vs. the previous commit (used by the post-commit hook)
    python3 scripts/indexnow_submit.py --since HEAD~1
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
DEFAULT_KEY_FILE = "c9249bca604d975c9bea6cda8c933688"
DEFAULT_HOST = "https://runany.dev"
BLOG_DIR = Path(__file__).resolve().parent.parent / "apps/web/src/content/blog"
ENDPOINT = "https://api.indexnow.org/indexnow"

# Reuse the slug logic so the URL we submit matches the sitemap.
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


def get_key() -> str:
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            if line.startswith("INDEXNOW_KEY="):
                return line.split("=", 1)[1].strip()
    # Fall back to the key file on disk (the key is the filename itself)
    key_path = Path(__file__).resolve().parent.parent / "apps/web/public" / f"{DEFAULT_KEY_FILE}.txt"
    if key_path.exists():
        return DEFAULT_KEY_FILE
    sys.exit("error: no INDEXNOW_KEY in .env and no key file on disk")


def all_post_urls() -> list[str]:
    urls: list[str] = []
    for fn in sorted(os.listdir(BLOG_DIR)):
        if not fn.endswith(".mdx"):
            continue
        try:
            head = (BLOG_DIR / fn).read_text()[:3000]
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
                v = m.group(2).strip().strip('"')
                meta[m.group(1)] = v
        if meta.get("draft", "false").lower() == "true":
            continue
        urls.append(f"{DEFAULT_HOST}/blog/{get_slug(fn)}/")
    return urls


def diff_urls_since(ref: str) -> list[str]:
    """Return URLs for .mdx files that changed between <ref> and HEAD."""
    out = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=AM", ref, "HEAD", "--",
         "apps/web/src/content/blog/"],
        capture_output=True, text=True, check=False,
    )
    if out.returncode != 0:
        print(f"git diff failed: {out.stderr.strip()}", file=sys.stderr)
        return []
    urls: list[str] = []
    for line in out.stdout.splitlines():
        fn = os.path.basename(line)
        if not fn.endswith(".mdx"):
            continue
        # Filter out deletions — for those, the URL no longer exists, so
        # IndexNow would 404. (IndexNow supports removal via the same API
        # but that's a separate workflow; skipped here.)
        diff_kind = subprocess.run(
            ["git", "diff", "--name-status", ref, "HEAD", "--", line],
            capture_output=True, text=True, check=False,
        ).stdout.splitlines()
        if diff_kind and diff_kind[0].startswith("D"):
            continue
        try:
            head = (BLOG_DIR / fn).read_text()[:3000]
        except OSError:
            continue
        if not head.startswith("---"):
            continue
        end = head.find("\n---", 3)
        if end < 0:
            continue
        meta = {}
        for l in head[3:end].splitlines():
            m = re.match(r"^(\w+):\s*(.*)$", l)
            if m:
                meta[m.group(1)] = m.group(2).strip().strip('"')
        if meta.get("draft", "false").lower() == "true":
            continue
        urls.append(f"{DEFAULT_HOST}/blog/{get_slug(fn)}/")
    return urls


def submit(urls: list[str], key: str) -> dict:
    if not urls:
        return {"submitted": 0, "note": "no URLs to submit"}
    if len(urls) > 10000:
        # IndexNow API caps at 10k URLs per request
        urls = urls[:10000]
    body = {
        "host": DEFAULT_HOST.replace("https://", "").replace("http://", ""),
        "key": key,
        "keyLocation": f"{DEFAULT_HOST}/{key}.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return {
                "submitted": len(urls),
                "status": r.status,
                "body": r.read().decode("utf-8", errors="ignore")[:200],
            }
    except urllib.error.HTTPError as e:
        return {
            "submitted": len(urls),
            "status": e.code,
            "body": e.read().decode("utf-8", errors="ignore")[:200],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", nargs="*", help="Explicit URLs to submit")
    parser.add_argument("--all", action="store_true", help="Submit every public post")
    parser.add_argument("--since", metavar="REF",
                        help="Submit URLs for .mdx files changed since <REF> (e.g. HEAD~1)")
    parser.add_argument("--dry-run", action="store_true", help="Print URLs without submitting")
    args = parser.parse_args()

    key = get_key()
    print(f"IndexNow key: {key[:8]}…{key[-4:]}  ({len(key)} chars)")

    if args.urls:
        urls = args.urls
    elif args.all:
        urls = all_post_urls()
    elif args.since:
        urls = diff_urls_since(args.since)
    else:
        parser.error("Provide URLs, --all, or --since REF")

    print(f"URLs to submit: {len(urls)}")
    if args.dry_run:
        for u in urls[:20]:
            print(f"  {u}")
        if len(urls) > 20:
            print(f"  … and {len(urls) - 20} more")
        return 0

    result = submit(urls, key)
    print(f"Submitted: {result['submitted']}")
    print(f"Status:    {result.get('status', '?')}")
    if result.get("body"):
        print(f"Body:      {result['body']}")
    return 0 if result.get("status", 200) in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main())
