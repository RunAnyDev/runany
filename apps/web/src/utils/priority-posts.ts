/**
 * Single source of truth for "Popular starting points" — the curated list of
 * posts that surface on the homepage hero carousel AND on the 404 fallback.
 *
 * Sync rule (see AGENTS.md → "Sync priority-posts list"):
 *   - When a new post is promoted into the popular list (sponsored, top GSC
 *     performer, or otherwise hand-picked), append its slug here.
 *   - Both `pages/index.astro` and `pages/404.astro` consume this list, so a
 *     single edit propagates everywhere.
 *
 * Order: sponsor first, then GSC top performers by 28-day impressions (desc).
 * Re-evaluate when GSC search-performance report shows a new clear winner.
 */
export const prioritySlugs: string[] = [
  'aqua-voice',
  'anarlog-open-source-ai-meeting-notetaker',
  'anysearch-mcp-server-unified-search',
  'openmonoagent-ai-setup-guide-open-source-c-ai-tool',
  'aimx-self-hosted-email-ai-agents',
  'vibesearchbench-ai-search-benchmark',
];

export interface ResolvedPriorityPost {
  slug: string;
  title: string;
  description: string;
  sponsored: boolean;
}

interface RawBlogEntry {
  id: string;
  data: {
    title?: string;
    description?: string;
    sponsored?: boolean;
  };
}

/**
 * Resolve a slug list against the blog collection. Slugs that no longer
 * correspond to a published post are silently dropped (e.g. a post got
 * renamed or taken down), but a runtime console.warn fires so stale entries
 * don't rot unnoticed.
 */
export function resolvePriorityPosts(
  allPosts: RawBlogEntry[],
  getSlug: (id: string) => string,
): ResolvedPriorityPost[] {
  const resolved: ResolvedPriorityPost[] = [];
  for (const slug of prioritySlugs) {
    const post = allPosts.find((p) => getSlug(p.id) === slug);
    if (!post) {
      // eslint-disable-next-line no-console
      console.warn(`[priority-posts] slug "${slug}" listed but no published post matches — remove it from prioritySlugs.`);
      continue;
    }
    resolved.push({
      slug,
      title: post.data.title ?? slug,
      description: post.data.description ?? '',
      sponsored: post.data.sponsored === true,
    });
  }
  return resolved;
}
