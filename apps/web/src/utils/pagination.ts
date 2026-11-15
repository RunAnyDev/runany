/**
 * Server-rendered pagination for the blog index.
 *
 * Why this exists:
 *   `/blog/` used to render only the newest 6 posts into HTML and let
 *   JavaScript append the rest from `/api/posts-index.json`. Crawlers that
 *   do not execute JavaScript (Googlebot included) therefore saw 6 post
 *   links on the strongest list page of the site — 1850 posts were reachable
 *   only through the sitemap, and Google left them in the "Discovered –
 *   currently not indexed" bucket.
 *
 *   Server-rendered pages give every post a crawlable HTML link path from
 *   `/blog/`, and give Google a stable, deduplicated set of list URLs.
 *
 * Page size: 24 (8 rows of the 3-column post grid on desktop).
 */
export const POSTS_PER_PAGE = 24;

/** Total number of list pages for a given number of published posts. */
export const getTotalPages = (total: number, perPage: number = POSTS_PER_PAGE): number =>
  Math.max(1, Math.ceil(total / perPage));

/**
 * Posts that belong to a 1-based page number.
 * Out-of-range pages return an empty array instead of throwing, so a stale
 * pagination link degrades to an empty list rather than a build failure.
 */
export const getPageItems = <T>(items: T[], page: number, perPage: number = POSTS_PER_PAGE): T[] => {
  if (!Number.isFinite(page) || page < 1) return [];
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
};

/**
 * Canonical URL of a list page. Page 1 keeps the historical `/blog/` path so
 * existing links and the canonical tag on the index page stay valid.
 */
export const getPagePath = (page: number): string => (page <= 1 ? '/blog/' : `/blog/page/${page}/`);

/**
 * Page numbers to render in the pagination nav: always the first and the
 * last page, plus a window around the current page. Keeps the nav short even
 * when the corpus grows past a hundred pages.
 */
export const getPageWindow = (currentPage: number, totalPages: number, span = 1): number[] => {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages]);
  for (let page = currentPage - span; page <= currentPage + span; page += 1) {
    if (page >= 1 && page <= totalPages) pages.add(page);
  }

  return [...pages].sort((a, b) => a - b);
};
