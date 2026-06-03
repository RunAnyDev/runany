export function buildTagCountMap(posts: { data: { tags: string[] } }[]) {
  return posts.reduce((acc, post) => {
    for (const tag of post.data.tags) {
      const normalizedTag = tag.toLowerCase();
      acc.set(normalizedTag, (acc.get(normalizedTag) ?? 0) + 1);
    }
    return acc;
  }, new Map<string, number>());
}

export function getIndexableTags(posts: { data: { tags: string[] } }[], minPosts = 2) {
  const tagCounts = buildTagCountMap(posts);
  return [...tagCounts.entries()]
    .filter(([, count]) => count >= minPosts)
    .map(([tag]) => tag)
    .sort();
}
