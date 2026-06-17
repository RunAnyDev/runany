import type { APIContext } from 'astro';

// Sitemap index. Currently a single sitemap-0.xml holds every URL.
// When the URL count grows past Google's 50,000-URL soft limit, split
// the loop into multiple sitemap-N.xml files and list them here.
export function GET(context: APIContext) {
  const site = context.site ?? new URL('https://runany.dev');
  const sitemapUrl = new URL('/sitemap-0.xml', site).toString();

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${sitemapUrl}</loc>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
