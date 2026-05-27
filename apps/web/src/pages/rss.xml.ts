import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => {
    const aDate = typeof a.data.pubDate === 'string' ? new Date(a.data.pubDate) : a.data.pubDate;
    const bDate = typeof b.data.pubDate === 'string' ? new Date(b.data.pubDate) : b.data.pubDate;
    return bDate.valueOf() - aDate.valueOf();
  });

  const siteUrl = 'https://runany.dev';
  
  const rssItems = sortedPosts.map(post => {
    const { Content } = post.render();
    // Get first ~500 chars of content as summary for RSS
    const plainText = post.body.replace(/[#*`\[\]]/g, '').replace(/\n+/g, ' ').trim();
    const summary = plainText.slice(0, 500) + (plainText.length > 500 ? '...' : '');
    
    return `
    <item>
      <title><![CDATA[${post.data.title}]]></title>
      <link>${siteUrl}/blog/${post.slug}/</link>
      <guid isPermaLink="true">${siteUrl}/blog/${post.slug}/</guid>
      <description><![CDATA[${post.data.description || summary}]]></description>
      <content:encoded><![CDATA[
        <h1>${post.data.title}</h1>
        <p><strong>${post.data.description || ''}</strong></p>
        <p>Tags: ${post.data.tags.map(t => `#${t}`).join(', ')} | Category: ${post.data.category}</p>
        <hr/>
        ${post.body}
      ]]></content:encoded>
      <pubDate>${new Date(post.data.pubDate).toUTCString()}</pubDate>
      <author>${post.data.author || 'Du'}</author>
      <category>${post.data.category}</category>
      ${post.data.tags.map(tag => `<category>${tag}</category>`).join('\n        ')}
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>runany.dev</title>
    <link>${siteUrl}</link>
    <description>Chia sẻ kiến thức tech, AI, setup tools cho developers. Tối ưu cho AI crawlers.</description>
    <language>vi</language>
    <managingEditor>du@runany.dev (Du)</managingEditor>
    <webMaster>du@runany.dev (Du)</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteUrl}/favicon.svg</url>
      <title>runany.dev</title>
      <link>${siteUrl}</link>
    </image>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}