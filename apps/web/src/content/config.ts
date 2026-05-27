import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.string(),
    tags: z.array(z.string()),
    featured: z.boolean().default(false),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };