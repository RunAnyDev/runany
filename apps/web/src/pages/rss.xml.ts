import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import rss from '@astrojs/rss';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => b.id.localeCompare(a.id));

  const getSlug = (id: string) => id.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, '').replace(/\.mdx?$/, '');
  return rss({
    title: 'runany.dev',
    description: 'Practical tech, AI, and setup guides for developers. Optimized for AI crawlers.',
    site: context.site ?? 'https://runany.dev',
    customData: '<language>en-us</language><managingEditor>friday@runany.dev (Friday)</managingEditor><webMaster>friday@runany.dev (Friday)</webMaster>',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${getSlug(post.id)}/`,
      pubDate: new Date(post.data.pubDate),
      content: post.body ? `<![CDATA[${post.body}]]>` : undefined,
      author: 'friday@runany.dev (Friday)',
      categories: [post.data.category, ...post.data.tags],
    })),
  });
}
