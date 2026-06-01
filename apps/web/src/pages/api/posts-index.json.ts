import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const getSlug = (id: string) => id.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, '').replace(/\.mdx?$/, '');

export const GET: APIRoute = async () => {
  const allPosts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = allPosts.sort((a, b) => b.id.localeCompare(a.id));

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
