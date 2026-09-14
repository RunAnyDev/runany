import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getSlug } from '@/utils/slug';
import { sortPostsByDateDesc } from '@/utils/posts';

export const GET: APIRoute = async () => {
  const allPosts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = sortPostsByDateDesc(allPosts);

  const posts = sortedPosts.map((post) => ({
    title: post.data.title,
    description: post.data.description || '',
    pubDate: post.data.pubDate,
    slug: getSlug(post.id),
    category: post.data.category,
    tags: post.data.tags,
    image: post.data.image || null,
    featured: post.data.featured || false,
  }));

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
