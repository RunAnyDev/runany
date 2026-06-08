import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  const site = context.site ?? new URL('https://runany.dev');
  const siteUrl = (typeof site === 'string' ? site : site.toString()).replace(/\/$/, '');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>runany.dev</ShortName>
  <Description>Search runany.dev blog posts by title and keyword</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Language>en-us</Language>
  <AdultContent>false</AdultContent>
  <Image width="16" height="16" type="image/svg+xml">${siteUrl}/favicon.svg</Image>
  <Url type="text/html" method="get" template="${siteUrl}/blog/?q={searchTerms}" />
  <Url type="application/opensearchdescription+xml" rel="self" template="${siteUrl}/opensearch.xml" />
  <Developer>Du</Developer>
  <Attribution>Search data from runany.dev</Attribution>
  <Tags>ai setup dev tools local llm self hosted mcp</Tags>
</OpenSearchDescription>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
