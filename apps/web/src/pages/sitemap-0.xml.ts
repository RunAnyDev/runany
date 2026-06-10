import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { buildTagCountMap } from '@/utils/tags';

const SITE = 'https://runany.dev';

type Entry = {
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
};

const iso = (d: Date | string | undefined | null): string => {
  if (!d) return new Date().toISOString();
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const renderEntry = (e: Entry): string => {
  // Only emit priority / changefreq when they differ from defaults to keep the file compact
  const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`, `    <lastmod>${e.lastmod}</lastmod>`];
  if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
  if (typeof e.priority === 'number') parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
};

export async function GET(_context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).filter(
    (p) => !p.id.startsWith('drafts/'),
  );

  const tagCounts = buildTagCountMap(posts);

  // Top 30 tags by post count — bumped to priority 0.5 so Google treats them as
  // first-class indexable keyword surfaces. Others stay at 0.3.
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag]) => tag);

  const topTagSet = new Set(topTags);
  const tagCount = (tag: string): number => tagCounts.get(tag) ?? 0;

  const categories = [...new Set(posts.map((p) => p.data.category.toLowerCase()))];

  const entries: Entry[] = [];

  // Homepage
  entries.push({
    loc: `${SITE}/`,
    lastmod: iso(posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate),
    changefreq: 'daily',
    priority: 1.0,
  });

  // Blog index
  entries.push({
    loc: `${SITE}/blog/`,
    lastmod: iso(posts[0]?.data.updatedDate ?? posts[0]?.data.pubDate),
    changefreq: 'daily',
    priority: 0.8,
  });

  // Static pages
  for (const path of ['/about/', '/contact/']) {
    entries.push({
      loc: `${SITE}${path}`,
      lastmod: iso(new Date()),
      changefreq: 'monthly',
      priority: 0.5,
    });
  }

  // Posts
  for (const post of posts) {
    const slug = post.id.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, '').replace(/\.mdx?$/, '');
    entries.push({
      loc: `${SITE}/blog/${slug}/`,
      lastmod: iso(post.data.updatedDate ?? post.data.pubDate),
      changefreq: 'weekly',
      priority: 0.9,
    });
  }

  // Categories
  for (const cat of categories) {
    const catPosts = posts.filter((p) => p.data.category.toLowerCase() === cat);
    const lastPost = catPosts[0];
    entries.push({
      loc: `${SITE}/category/${cat}/`,
      lastmod: iso(lastPost?.data.updatedDate ?? lastPost?.data.pubDate),
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  // Tags
  for (const [tag, count] of tagCounts.entries()) {
    if (count < 2) continue; // matches getStaticPaths filter on the [tag].astro page
    const isTop = topTagSet.has(tag);
    const tagPosts = posts.filter((p) => p.data.tags.map((t) => t.toLowerCase()).includes(tag));
    const lastPost = tagPosts[0];
    entries.push({
      loc: `${SITE}/tags/${tag}/`,
      lastmod: iso(lastPost?.data.updatedDate ?? lastPost?.data.pubDate),
      changefreq: 'weekly',
      priority: isTop ? 0.5 : 0.3,
    });
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(renderEntry).join('\n') +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
