import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import UnoCSS from '@unocss/astro';

export default defineConfig({
  site: 'https://runany.dev',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    sitemap({
      lastmod: new Date(),
      changefreq: 'daily',
      serialize(item) {
        const url = item.url;

        if (url === 'https://runany.dev/' || url === 'https://runany.dev') {
          return { ...item, priority: 1.0 };
        }

        if (url.includes('/blog/')) {
          return { ...item, priority: 0.9 };
        }

        if (url.includes('/category/')) {
          return { ...item, priority: 0.7 };
        }

        if (url.includes('/tags/')) {
          return { ...item, priority: 0.3 };
        }

        return item;
      },
    }),
    UnoCSS({ injectReset: true }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
