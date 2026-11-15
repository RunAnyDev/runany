export function buildTagCountMap(posts: { data: { tags: string[] } }[]) {
  return posts.reduce((acc, post) => {
    for (const tag of post.data.tags) {
      const normalizedTag = tag.toLowerCase();
      acc.set(normalizedTag, (acc.get(normalizedTag) ?? 0) + 1);
    }
    return acc;
  }, new Map<string, number>());
}

/**
 * Minimum number of posts a tag needs before it is treated as a real landing
 * page.
 *
 * The blog reached 1300 distinct tags; 507 of them had 2+ posts and were
 * published as pages. Those thin listings were 21% of the sitemap and the
 * dominant source of internal links on `/blog/`, so Google spent crawl
 * budget on 2-5 post listings instead of on the articles themselves. Tag
 * pages below this threshold are now:
 *   - left out of the sitemap,
 *   - not linked from the blog index or from post cards,
 *   - served with `noindex, follow` so Google stops spending budget on them.
 *
 * A tag that grows past the threshold becomes indexable again on the next
 * build — the rule is evaluated from the post collection at build time.
 */
export const INDEXABLE_TAG_MIN_POSTS = 5;

export function getIndexableTags(posts: { data: { tags: string[] } }[], minPosts = INDEXABLE_TAG_MIN_POSTS) {
  const tagCounts = buildTagCountMap(posts);
  return [...tagCounts.entries()]
    .filter(([, count]) => count >= minPosts)
    .map(([tag]) => tag)
    .sort();
}
