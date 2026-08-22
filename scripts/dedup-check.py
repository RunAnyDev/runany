#!/usr/bin/env python3
"""Dedup check for blog-publisher. Run before writing a new post.

Checks (in order):
1. written-repos.txt — exact domain match (handles www. and subdomain->parent)
2. Blog content directory — exact slug match + name-based name collision
3. Returns "NEW" only if all checks pass

Usage:
    python dedup-check.py video.golpoai.com bookmarksos.com
    echo 'twill.ai' | python dedup-check.py
    python dedup-check.py --batch < candidates.txt

The --batch mode prints tab-separated: domain<TAB>status<TAB>reason.
Exit code is 0 if all NEW, 1 if any ALREADY_WRITTEN.

Replaces the older version that used substring/domain-parts matching,
which falsely flagged any .io/.ai/.com tool as covered.
"""
import sys, os, re

repo_file = os.path.join(os.path.expanduser("~"), "personal/runany/.data/written-repos.txt")
blog_dir = os.path.join(os.path.expanduser("~"), "personal/runany/apps/web/src/content/blog")

def load_dedup():
    out = set()
    if not os.path.exists(repo_file):
        return out
    with open(repo_file) as f:
        for line in f:
            v = line.strip().lower()
            if v:
                out.add(v)
    return out

def load_blog_data():
    slugs = set()
    names = set()  # 4+ char words from titles for name-based dedup
    if not os.path.isdir(blog_dir):
        return slugs, names
    for fname in os.listdir(blog_dir):
        if not fname.endswith('.mdx'):
            continue
        slug = re.sub(r'^\d{4}-\d{2}-\d{2}-\d{6}-', '', fname).replace('.mdx', '').replace('.md', '').lower()
        slugs.add(slug)
        with open(os.path.join(blog_dir, fname)) as fp:
            head = fp.read(3000)
        m = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', head, re.M)
        if m:
            for word in re.findall(r'\b[a-zA-Z]{4,}\b', m.group(1).lower()):
                if word not in ('launch', 'show', 'hacker', 'news', 'built', 'made', 'open', 'free'):
                    names.add(word)
    return slugs, names

def normalize_domain(d):
    d = d.lower().strip()
    d = re.sub(r'^https?://', '', d)
    d = d.split('/')[0].split('?')[0]
    if d.startswith('www.'):
        d = d[4:]
    return d

def parent_domain(d):
    """video.golpoai.com -> golpoai.com. Returns '' for 2-part TLDs."""
    parts = d.split('.')
    if len(parts) >= 3:
        return '.'.join(parts[-2:])
    return ''

def slugify_domain(d):
    return d.replace('.', '-')

def check_one(domain, dedup, slugs, names):
    d = normalize_domain(domain)
    if not d:
        return "ALREADY_WRITTEN", "empty domain"

    # 1. Exact domain match
    if d in dedup:
        return "ALREADY_WRITTEN", f"exact domain '{d}' in written-repos.txt"

    # 2. Parent domain match (catches subdomains when parent is registered)
    parent = parent_domain(d)
    if parent and parent in dedup:
        return "ALREADY_WRITTEN", f"parent domain '{parent}' in written-repos.txt (subdomain)"

    # 3. Subdomain match (catches subdomain-registered case when HN returns parent)
    parts = d.split('.')
    if len(parts) >= 3:
        sub = '.'.join(parts[:-2]) + '.' + parent
        if sub in dedup:
            return "ALREADY_WRITTEN", f"subdomain '{sub}' in written-repos.txt"

    # 4. Slug match against existing post filenames
    slug = slugify_domain(d)
    if slug in slugs:
        return "ALREADY_WRITTEN", f"slug '{slug}' is an existing blog post"
    if any(slug in s for s in slugs):
        return "ALREADY_WRITTEN", f"slug '{slug}' is a substring of an existing post slug"

    # 5. Name-based collision (catches Stage code review vs Stagewise IDE)
    d_name = d.split('.')[0]
    if len(d_name) >= 4 and d_name in names:
        return "ALREADY_WRITTEN", f"domain root '{d_name}' appears in an existing post title"

    return "NEW", ""

def main():
    args = sys.argv[1:]
    batch_mode = False
    if '--batch' in args:
        batch_mode = True
        args = [a for a in args if a != '--batch']

    if not args and not sys.stdin.isatty():
        args = [line.strip() for line in sys.stdin if line.strip()]

    if not args:
        print("Usage: python dedup-check.py domain [domain ...]", file=sys.stderr)
        print("       python dedup-check.py --batch < candidates.txt", file=sys.stderr)
        sys.exit(2)

    dedup = load_dedup()
    slugs, names = load_blog_data()

    all_new = True
    for d in args:
        status, reason = check_one(d, dedup, slugs, names)
        if batch_mode:
            print(f"{d}\t{status}\t{reason}")
        else:
            icon = "✅" if status == "NEW" else "🔄"
            print(f"{icon} {status}: {d}")
            if reason:
                print(f"   -> {reason}")
        if status != "NEW":
            all_new = False

    sys.exit(0 if all_new else 1)

if __name__ == "__main__":
    main()
