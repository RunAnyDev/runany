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
