import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const siteUrl = 'https://runany.dev';
const getSlug = (id: string) => id.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, '').replace(/\.mdx?$/, '');

const normalizeText = (value: string) => value
  .replace(/^---[\s\S]*?---/m, ' ')
  .replace(/^## TL;DR[\s\S]*?(?=\n##\s|$)/im, ' ')
  .replace(/^## Source and Accuracy Notes[\s\S]*?(?=\n##\s|$)/im, ' ')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^>\s?/gm, '')
  .replace(/[*_~]/g, '')
  .replace(/\bTL;DR:\s*/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

const excerptWords = (value: string, limit: number) => {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return value;
  return `${words.slice(0, limit).join(' ')}…`;
};

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => b.id.localeCompare(a.id));

  const body = [
    '# runany.dev — Full AI-readable content index',
    '',
    '> Full-content companion to llms.txt for AI agents, search assistants, and research workflows.',
    '',
    `- Site: ${siteUrl}`,
    `- Blog index: ${siteUrl}/blog/`,
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    `- llms.txt: ${siteUrl}/llms.txt`,
    `- Total posts: ${sortedPosts.length}`,
    '',
    '## Posts',
    '',
    ...sortedPosts.flatMap((post) => {
      const slug = getSlug(post.id);
      const url = `${siteUrl}/blog/${slug}/`;
      const content = normalizeText(post.body ?? '');
      const excerpt = excerptWords(content, 160);
      const pubDate = post.data.pubDate instanceof Date
        ? post.data.pubDate.toISOString().slice(0, 10)
        : String(post.data.pubDate);

      return [
        `### ${post.data.title}`,
        `- URL: ${url}`,
        `- Published: ${pubDate}`,
        `- Category: ${post.data.category}`,
        `- Tags: ${post.data.tags.join(', ')}`,
        `- Summary: ${post.data.description ?? ''}`,
        `- Excerpt: ${excerpt}`,
        '',
      ];
    }),
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
};
