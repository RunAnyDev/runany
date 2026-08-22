import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSlug } from '@/utils/slug';

const siteUrl = 'https://runany.dev';

const stripTimestampPrefix = getSlug;

const toIsoDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

// Escape XML special characters for safe XML output.
const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

interface ImageEntry {
  loc: string;
  title: string;
}

interface Entry {
  loc: string;
  lastmod: string | null;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
  images?: ImageEntry[];
}

const renderEntry = (entry: Entry): string => {
  // Per Google (Sept 2023), priority and changefreq are no longer used for
  // ranking. lastmod is the only field that materially affects crawl scheduling.
  const lines: string[] = ['  <url>'];
  lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);
  if (entry.lastmod) {
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  }
  lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  // Image sitemap extensions (xmlns:image declared on root). Posts with a
  // thumbnail in frontmatter get an <image:image> block — Google Images is
  // a meaningful traffic source for AI/dev blogs, and the namespace was
  // previously declared but never used. For posts without a thumbnail we
  // skip silently; categories/tags/static pages have no images either.
  for (const img of entry.images ?? []) {
    lines.push('    <image:image>');
    lines.push(`      <image:loc>${xmlEscape(img.loc)}</image:loc>`);
    if (img.title) {
      lines.push(`      <image:title>${xmlEscape(img.title)}</image:title>`);
    }
    lines.push('    </image:image>');
  }
  lines.push('  </url>');
  return lines.join('\n');
};

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  // Sort posts newest-first (matches blog index / homepage)
  const sortedPosts = posts.sort((a, b) => {
    const dateDiff =
      new Date(b.data.pubDate as string).getTime() -
      new Date(a.data.pubDate as string).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });

  // Derive per-URL lastmod from each post's frontmatter pubDate.
  // Without this, every URL would get the build timestamp, which is useless
  // for Google crawl scheduling.
  const blogEntries: Entry[] = sortedPosts.map((post) => {
    const slug = stripTimestampPrefix(post.id);
    const img = post.data.image;
    const imageUrl = img?.url
      ? (img.url.startsWith('http') ? img.url : `${siteUrl}${img.url}`)
      : null;
    return {
      loc: `${siteUrl}/blog/${slug}/`,
      lastmod: toIsoDate(post.data.updatedDate ?? post.data.pubDate),
      changefreq: 'monthly',
      priority: 0.9,
      images: imageUrl ? [{ loc: imageUrl, title: post.data.title }] : undefined,
    };
  });

  // Newest post date is a reasonable proxy for site-wide recency.
  const newestPostDate = sortedPosts[0]?.data.pubDate
    ? toIsoDate(sortedPosts[0].data.pubDate)
    : toIsoDate(new Date());

  const staticEntries: Entry[] = [
    { loc: `${siteUrl}/`, lastmod: newestPostDate, changefreq: 'daily', priority: 1.0 },
    { loc: `${siteUrl}/blog/`, lastmod: newestPostDate, changefreq: 'daily', priority: 0.9 },
    { loc: `${siteUrl}/about/`, lastmod: newestPostDate, changefreq: 'monthly', priority: 0.6 },
    { loc: `${siteUrl}/contact/`, lastmod: newestPostDate, changefreq: 'yearly', priority: 0.4 },
  ];

  // Discover category and tag pages from the post collection. The actual
  // /tags/[tag].astro and /category/[category].astro routes only generate
  // pages for tags with >= 2 posts and categories with >= 1 post. Mirroring
  // those filters here keeps the sitemap aligned with the live site so we
  // never publish URLs that 404.
  const categories = Array.from(
    new Set(posts.map((p) => (p.data.category ?? '').toString().toLowerCase()).filter(Boolean))
  );

  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      const normalized = tag.toString().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      if (!normalized) continue;
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    }
  }
  // Match the [tag].astro filter: only tags with at least 2 posts get a page.
  const tags = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([tag]) => tag)
    .sort();

  const categoryEntries: Entry[] = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat}/`,
    lastmod: newestPostDate,
    changefreq: 'weekly',
    priority: 0.7,
  }));

  const tagEntries: Entry[] = tags.map((tag) => ({
    loc: `${siteUrl}/tags/${tag}/`,
    lastmod: newestPostDate,
    changefreq: 'weekly',
    priority: 0.3,
  }));

  const allEntries = [
    ...staticEntries,
    ...blogEntries,
    ...categoryEntries,
    ...tagEntries,
  ];

  // Dedupe by <loc>. The blog collection can contain multiple .mdx files
  // that map to the same slug when filenames fail to follow the
  // YYYY-MM-DD-HHMMSS-slug convention, or when the same product is
  // re-reviewed and an earlier draft is not deleted. Astro's [slug] route
  // already picks one and warns about the rest; the sitemap must mirror
  // that — Google penalises sitemaps with duplicate URLs, so we keep the
  // first occurrence only and drop the shadowed ones.
  const seenLoc = new Set<string>();
  const uniqueEntries = allEntries.filter((entry) => {
    if (seenLoc.has(entry.loc)) return false;
    seenLoc.add(entry.loc);
    return true;
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...uniqueEntries.map(renderEntry),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
