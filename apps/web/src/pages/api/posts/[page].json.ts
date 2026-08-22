import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getSlug } from '@/utils/slug';

const LIMIT = 9;

export async function getStaticPaths() {
  const allPosts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = allPosts.sort((a, b) => b.id.localeCompare(a.id));
  const totalPages = Math.ceil(sortedPosts.length / LIMIT);

  return Array.from({ length: totalPages }, (_, i) => ({
    params: { page: String(i + 1) },
  }));
}

export const GET: APIRoute = async ({ params }) => {
  const page = parseInt(params.page || '1', 10);
  const allPosts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = allPosts.sort((a, b) => b.id.localeCompare(a.id));
  const total = sortedPosts.length;
  const start = (page - 1) * LIMIT;
  const pagePosts = sortedPosts.slice(start, start + LIMIT);

  const posts = pagePosts.map((post) => ({
    title: post.data.title,
    description: post.data.description || '',
    pubDate: post.data.pubDate,
    slug: getSlug(post.id),
    category: post.data.category,
    tags: post.data.tags,
    image: post.data.image || null,
    featured: post.data.featured || false,
  }));

  return new Response(
    JSON.stringify({ posts, total, page, limit: LIMIT, hasMore: start + LIMIT < total }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
