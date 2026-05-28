import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  const site = context.site ?? new URL('https://runany.dev');
  const sitemapIndexUrl = new URL('/sitemap-0.xml', site).toString();

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${sitemapIndexUrl}</loc></sitemap></sitemapindex>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
