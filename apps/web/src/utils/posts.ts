import type { CollectionEntry } from 'astro:content';

/**
 * Newest-first sort for blog posts.
 *
 * Why this exists:
 *   Sorting by `post.id` (the filename) is unreliable because filenames mix
 *   timestamp formats — see `utils/slug.ts` for the canonical `YYYY-MM-DD-HHMMSS-`
 *   prefix AND the legacy compact variants (`20260824030318-…`). With ASCII,
 *   `-` (45) < `0` (48), so a compact file like `20260824…` (Aug 24) sorts
 *   BEFORE a dashed file like `2026-09-13…` (Sep 13) when compared with
 *   `b.id.localeCompare(a.id)` — even though Sep 13 is the newer post.
 *
 *   That bug surfaces as "older articles appear before newer ones" on the
 *   homepage, tag/category pages, RSS, llms-full.txt, and the homepage search
 *   JSON endpoints.
 *
 *   Sort by `pubDate` (the actual publish date in frontmatter) first, then
 *   fall back to `id` as a deterministic tiebreaker so two posts published
 *   on the same second still get a stable order. Mirrors the proven pattern
 *   already used in `pages/blog/index.astro` and `pages/sitemap-0.xml.ts`.
 *
 *   Pure / non-mutating: returns a new array, so the original
 *   `await getCollection(...)` result is left intact for any subsequent use.
 */
export const sortPostsByDateDesc = <T extends CollectionEntry<'blog'>>(posts: T[]): T[] =>
  posts.slice().sort((a, b) => {
    const aTime = new Date(a.data.pubDate).valueOf();
    const bTime = new Date(b.data.pubDate).valueOf();
    const dateDiff = bTime - aTime;
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });
