import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import rss from '@astrojs/rss';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sortedPosts = posts.sort((a, b) => {
    const aDate = typeof a.data.pubDate === 'string' ? new Date(a.data.pubDate) : a.data.pubDate;
    const bDate = typeof b.data.pubDate === 'string' ? new Date(b.data.pubDate) : b.data.pubDate;
    return bDate.valueOf() - aDate.valueOf();
  });

  return rss({
    title: 'runany.dev',
    description: 'Practical tech, AI, and setup guides for developers. Optimized for AI crawlers.',
    site: context.site ?? 'https://runany.dev',
    customData: '<language>en-us</language><managingEditor>du@runany.dev (Du)</managingEditor><webMaster>du@runany.dev (Du)</webMaster>',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${post.slug}/`,
      pubDate: new Date(post.data.pubDate),
      author: 'du@runany.dev (Du)',
      categories: [post.data.category, ...post.data.tags],
    })),
  });
}
