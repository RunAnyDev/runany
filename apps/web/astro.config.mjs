import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import UnoCSS from '@unocss/astro';
import cicadaGrammar from './src/shiki/cicada.tmLanguage.json';

export default defineConfig({
  site: 'https://runany.dev',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    UnoCSS({ injectReset: true }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
      langs: [
        {
          id: 'cicada',
          scopeName: 'source.cicada',
          aliases: ['cicada'],
          grammar: cicadaGrammar,
        },
      ],
    },
  },
});
