#!/usr/bin/env python3
"""
Pre-commit check for MDX build-breakers in runany.dev blog drafts.

Catches patterns MDX/Astro refuses to parse:
  - Literal {var} outside code fences → ReferenceError at build time
  - <N or <[0-9] in body text → parsed as JSX tag
  - <br> outside code fences → parsed as JSX element
  - Uppercase tags in frontmatter
  - Bare `<` operator in body text → MDX 3 still opens JSX tag parse

Note: inline `![]()` markdown images are now ALLOWED in body (per visual
density rules in cron skills, 2026-09-13). They must use https://cdn.runany.dev/
URLs and have alt text.

Depth tier (files published on or after DEPTH_START): a new post must be a
researched article, not a summary. Same thresholds as the CI validator in
scripts/validate-blog-posts.test.mjs, so `mdx_lint.py` and CI never disagree.

Usage:
  python3 scripts/mdx_lint.py [file ...]
  python3 scripts/mdx_lint.py apps/web/src/content/blog/  # scans all MDX files

Exit codes:
  0 = clean
  1 = build-breaker(s) found (prints each, line-numbered)
  2 = file not found
"""
import re
import sys
from pathlib import Path

ROOT = Path("apps/web/src/content/blog")

# Depth tier: files published before this date are grandfathered.
DEPTH_START = "2026-11-16"
MIN_WORDS = 1100
MIN_H2 = 5
MIN_CODE_BLOCKS = 2
MIN_TABLE_LINES = 3
MIN_INLINE_IMAGES = 1
MIN_SOURCE_URLS = 3

# Patterns that break MDX/Astro builds. Order matters: more specific first.
CHECKS = [
    # (name, regex, description)
    (
        "literal-jsx-expression",
        re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}"),
        "Literal {var} outside a code fence — MDX parses as JSX expression. "
        "Use [var], `` `{var}` ``, or &#123;var&#125;.",
    ),
    (
        "jsx-tag-numeric",
        re.compile(r"<[0-9]"),
        "<N pattern — MDX parses as JSX tag. Spell out: 'under 250ms'.",
    ),
    (
        # Standalone `<` between punctuation/operators — MDX 3 still opens a JSX
        # tag parse even when `<` is followed by space + non-letter. Real failure
        # 2026-08-06 on Mathesar post: '=, !=, >, <, LIKE, IN' on a single line
        # tripped 'Unexpected character `,` before name' at L104:40. Fix: wrap
        # the symbol in a backtick code span: `=`, `!=`, `>`, `<`, ...
        "less-than-operator",
        re.compile(r"\b<\b\s*[,)]|<\s+[A-Z]"),
        "Bare `<` operator in body text — MDX parses as JSX tag open even when "
        "followed by space/comma. Wrap in a backtick code span (`<`) or spell out "
        "('less than').",
    ),
    (
        "br-tag",
        re.compile(r"<br\s*/?>"),
        "<br> tag — MDX parses as JSX element. Use blank lines between paragraphs.",
    ),
]


def strip_code_fences(text: str) -> str:
    """Remove ```fenced``` blocks and `inline` code from text."""
    # Fenced blocks
    text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
    # Inline code
    text = re.sub(r"`[^`\n]+`", "", text)
    return text


def publish_date(path: Path) -> str:
    """Date prefix of an MDX filename (YYYY-MM-DD), or '' when absent."""
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", path.name)
    return match.group(1) if match else ""


def lint_depth(path: Path, body: str) -> list[tuple[int, str, str]]:
    """Depth and illustration checks for posts published on or after DEPTH_START."""
    findings = []

    def add(check: str, message: str) -> None:
        findings.append((0, check, message))

    words = len(body.split())
    if words < MIN_WORDS:
        add("too-short", f"post must be at least {MIN_WORDS} words ({words})")

    headings = re.findall(r"^##\s+.+$", body, flags=re.MULTILINE)
    if len(headings) < MIN_H2:
        add("too-few-sections", f"post must have at least {MIN_H2} H2 sections ({len(headings)})")

    code_blocks = re.findall(r"```[^\n]*\n[\s\S]*?```", body)
    if len(code_blocks) < MIN_CODE_BLOCKS:
        add("too-few-code-blocks", f"post must have at least {MIN_CODE_BLOCKS} code blocks ({len(code_blocks)})")

    table_lines = re.findall(r"^\|.+\|\s*$", body, flags=re.MULTILINE)
    if len(table_lines) < MIN_TABLE_LINES:
        add(
            "no-table",
            f"post must contain at least one table with two data rows ({len(table_lines)} table lines)",
        )

    images = re.findall(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", body)
    if len(images) < MIN_INLINE_IMAGES:
        add("no-illustration", f"post must contain at least {MIN_INLINE_IMAGES} inline illustration ({len(images)})")
    for alt, url in images:
        if not alt.strip():
            add("image-missing-alt", f"inline image is missing alt text: {url}")
        if not url.startswith("https://cdn.runany.dev/"):
            add("image-not-hosted", f"inline image must be hosted on cdn.runany.dev ({url})")

    without_images = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", body)
    urls = {
        u.rstrip(".,;:")
        for u in re.findall(r"https?://[^\s)\]<>\"']+", without_images)
    }
    if len(urls) < MIN_SOURCE_URLS:
        add("too-few-sources", f"post must cite at least {MIN_SOURCE_URLS} distinct source pages ({len(urls)})")

    return findings


def lint_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_number, check_name, message) for each finding."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        return [(0, "read-error", f"{e}")]

    findings = []
    # Skip frontmatter for code-fence-aware checks
    parts = text.split("---\n", 2)
    if len(parts) >= 3:
        frontmatter, body = parts[1], parts[2]
    else:
        frontmatter, body = "", text

    body_no_fences = strip_code_fences(body)

    for check_name, pattern, message in CHECKS:
        for m in pattern.finditer(body_no_fences):
            line_no = body[: m.start()].count("\n") + 1
            findings.append((line_no, check_name, message))

    # Frontmatter-only checks
    if frontmatter:
        # Uppercase tags
        for m in re.finditer(r"^tags:\s*\[(.*?)\]", frontmatter, flags=re.MULTILINE):
            tags_str = m.group(1)
            for tag in re.findall(r'"([^"]+)"', tags_str):
                if tag != tag.lower():
                    line_no = frontmatter[: m.start()].count("\n") + 1
                    findings.append(
                        (line_no, "uppercase-tag", f"Tag '{tag}' must be lowercase.")
                    )

    # Depth tier: only for posts published on or after DEPTH_START.
    if publish_date(path) >= DEPTH_START:
        findings.extend(lint_depth(path, body))

    return findings


def main():
    if len(sys.argv) < 2:
        # Default: scan all MDX in the blog dir
        if not ROOT.exists():
            print(f"ERROR: {ROOT} not found. Run from repo root.", file=sys.stderr)
            return 2
        files = sorted(ROOT.glob("*.mdx"))
    else:
        files = []
        for arg in sys.argv[1:]:
            path = Path(arg)
            if path.is_dir():
                # The usage line documents directory arguments, so expand them
                # instead of failing with "Is a directory".
                files.extend(sorted(path.glob("*.mdx")))
            else:
                files.append(path)

    if not files:
        print("No files to check.", file=sys.stderr)
        return 0

    total_findings = 0
    for path in files:
        if not path.exists():
            print(f"ERROR: {path} not found.", file=sys.stderr)
            return 2
        findings = lint_file(path)
        if findings:
            print(f"\n{path}:")
            for line_no, check_name, message in findings:
                print(f"  L{line_no:>4}  [{check_name}]  {message}")
            total_findings += len(findings)

    if total_findings:
        print(
            f"\n{total_findings} build-breaker(s) found across {len(files)} file(s).",
            file=sys.stderr,
        )
        return 1
    print(f"OK: {len(files)} file(s) clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
