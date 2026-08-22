/**
 * Strip the timestamp prefix from a blog post filename to get the URL slug.
 *
 * Filenames follow the convention `YYYY-MM-DD-HHMMSS-slug.mdx`, but the
 * blog-publisher and a handful of older manual posts used variants that the
 * original single-pattern regex missed (causing those posts to keep the full
 * timestamp in their URL). This helper accepts every variant we have seen in
 * the wild so the URL stays consistent across all posts.
 *
 * Recognised timestamp prefixes (one match is stripped, in order):
 *   - `2026-08-11-041500-`           canonical, per AGENTS.md
 *   - `20260811-041500-`             compact (no inner hyphens)
 *   - `2026-0811-041500-`            MMDD glued
 *   - `2026-08-07190415-`            DDHHMMSS glued
 *   - `20260811041500-`              fully compact
 *
 * If no timestamp prefix matches, the file is returned as-is (minus the
 * `.md`/`.mdx` extension), so already-short slugs keep working.
 */
const TIMESTAMP_PATTERNS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}-\d{6}-/,
  /^\d{8}-\d{6}-/,
  /^\d{4}-\d{4}-\d{6}-/,
  /^\d{4}-\d{2}-\d{8}-/,
  /^\d{14}-/,
];

export function getSlug(id: string): string {
  const base = id.replace(/\.mdx?$/, '');
  for (const pattern of TIMESTAMP_PATTERNS) {
    if (pattern.test(base)) {
      return base.replace(pattern, '');
    }
  }
  return base;
}
