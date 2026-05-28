import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),  // summary field in MDX
    pubDate: z.string().or(z.date()),    // date in MDX as string "2025-05-27"
    updatedDate: z.string().or(z.date()).optional(),
    category: z.string(),
    tags: z.array(z.string()),
    author: z.string().default('Du'),
    featured: z.boolean().default(false),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
