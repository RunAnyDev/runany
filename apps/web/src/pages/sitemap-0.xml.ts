import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSlug } from '@/utils/slug';
import { sortPostsByDateDesc } from '@/utils/posts';
import { INDEXABLE_TAG_MIN_POSTS } from '@/utils/tags';
import { POSTS_PER_PAGE, getPageItems, getPagePath, getTotalPages } from '@/utils/pagination';

const siteUrl = 'https://runany.dev';

/**
 * Minimum number of posts a tag must have to earn a place in the sitemap.
 *
 * The site reached 1300 distinct tags and 507 of them cleared the "2 posts"
 * threshold used by `/tags/[tag].astro` — 21% of the whole sitemap was thin
 * tag listings holding 2-5 posts each. Google spent crawl budget on those
 * pages instead of on the articles, and the pages themselves were
 * near-duplicates of each other. Only substantial hubs enter the sitemap now;
 * the thin ones stay reachable through the articles but are not advertised.
 */
const SITEMAP_MIN_TAG_POSTS = INDEXABLE_TAG_MIN_POSTS;

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
  const sortedPosts = sortPostsByDateDesc(posts);

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

  // /about/ and /contact/ are hand-written pages that do not change with
  // every publish. Claiming the newest post date for them made Google
  // re-crawl two dead pages on every deploy, so they carry no lastmod.
  const staticEntries: Entry[] = [
    { loc: `${siteUrl}/`, lastmod: newestPostDate, changefreq: 'daily', priority: 1.0 },
    { loc: `${siteUrl}/blog/`, lastmod: newestPostDate, changefreq: 'daily', priority: 0.9 },
    { loc: `${siteUrl}/about/`, lastmod: null, changefreq: 'monthly', priority: 0.6 },
    { loc: `${siteUrl}/contact/`, lastmod: null, changefreq: 'yearly', priority: 0.4 },
  ];

  // Pagination pages. These are the crawlable list pages that give every
  // article a link path from /blog/ — without them Google only ever saw the
  // first handful of posts on the index page.
  const totalPages = getTotalPages(sortedPosts.length);
  const paginationEntries: Entry[] = [];
  for (let page = 2; page <= totalPages; page += 1) {
    const pagePosts = getPageItems(sortedPosts, page);
    if (pagePosts.length === 0) continue;
    paginationEntries.push({
      loc: `${siteUrl}${getPagePath(page)}`,
      // Newest-first ordering: the first post on the page is the freshest.
      lastmod: toIsoDate(pagePosts[0].data.updatedDate ?? pagePosts[0].data.pubDate),
      changefreq: 'weekly',
      priority: 0.5,
    });
  }

  // Discover category and tag pages from the post collection. The actual
  // /tags/[tag].astro and /category/[category].astro routes only generate
  // pages for tags with >= 2 posts and categories with >= 1 post. Mirroring
  // those filters here keeps the sitemap aligned with the live site so we
  // never publish URLs that 404.
  const categories = Array.from(
    new Set(posts.map((p) => (p.data.category ?? '').toString().toLowerCase()).filter(Boolean))
  );

  const normalizeTag = (tag: unknown): string =>
    String(tag ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');

  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) {
      const normalized = normalizeTag(tag);
      if (!normalized) continue;
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    }
  }
  // Only substantial tag hubs enter the sitemap. The pages themselves still
  // exist for every tag with >= 2 posts, they are just not advertised here.
  const tags = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= SITEMAP_MIN_TAG_POSTS)
    .map(([tag]) => tag)
    .sort();

  /**
   * Newest modification date inside a group of posts. Tag and category
   * pages only change when a post inside them changes, so their lastmod has
   * to reflect that group instead of the site-wide newest post — otherwise
   * every listing page claims to be edited on every deploy and Google keeps
   * re-crawling low-value URLs.
   */
  const groupLastmod = (matches: (post: (typeof posts)[number]) => boolean): string | null => {
    let newestTime = -Infinity;
    let newestValue: string | null = null;
    for (const post of posts) {
      if (!matches(post)) continue;
      const value = (post.data.updatedDate ?? post.data.pubDate) as string;
      const time = new Date(value).valueOf();
      if (Number.isNaN(time)) continue;
      if (time > newestTime) {
        newestTime = time;
        newestValue = value;
      }
    }
    return newestValue ? toIsoDate(newestValue) : null;
  };

  const categoryEntries: Entry[] = categories.map((cat) => ({
    loc: `${siteUrl}/category/${cat}/`,
    lastmod: groupLastmod((post) => (post.data.category ?? '').toString().toLowerCase() === cat),
    changefreq: 'weekly',
    priority: 0.7,
  }));

  const tagEntries: Entry[] = tags.map((tag) => ({
    loc: `${siteUrl}/tags/${tag}/`,
    lastmod: groupLastmod((post) => (post.data.tags ?? []).some((t) => normalizeTag(t) === tag)),
    changefreq: 'weekly',
    priority: 0.3,
  }));

  const allEntries = [
    ...staticEntries,
    ...blogEntries,
    ...paginationEntries,
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
