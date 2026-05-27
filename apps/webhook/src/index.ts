import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import { triggerRebuild } from './trigger.js';
import type { PublishPayload } from '@runany/shared';

const BLOG_DIR = '/Users/friday/personal/runany/content/blog';

const fastify = Fastify({ logger: true });

function buildFrontmatter(payload: PublishPayload): string {
  const fm = [
    `title: "${payload.title}"`,
    `date: "${new Date().toISOString().split('T')[0]}"`,
    `slug: "${payload.slug}"`,
  ];
  
  if (payload.frontmatter?.category) fm.push(`category: "${payload.frontmatter.category}"`);
  if (payload.frontmatter?.tags?.length) fm.push(`tags: [${payload.frontmatter.tags.map(t => `"${t}"`).join(', ')}]`);
  if (payload.frontmatter?.excerpt) fm.push(`excerpt: "${payload.frontmatter.excerpt}"`);
  if (payload.frontmatter?.author) fm.push(`author: "${payload.frontmatter.author}"`);
  fm.push('published: true');
  
  return fm.join('\n');
}

fastify.post('/webhook/publish', async (req, reply) => {
  const payload = req.body as PublishPayload;

  if (!payload.title || !payload.slug || !payload.content) {
    return reply.status(400).send({ 
      success: false, 
      error: 'Missing required fields: title, slug, content' 
    });
  }

  const filename = `${payload.slug}.mdx`;
  const filePath = path.join(BLOG_DIR, filename);
  
  const frontmatter = buildFrontmatter(payload);
  const fileContent = `---\n${frontmatter}\n---\n\n${payload.content}`;

  try {
    if (!fs.existsSync(BLOG_DIR)) {
      fs.mkdirSync(BLOG_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    return reply.send({ 
      success: true, 
      data: { filepath: filePath, slug: payload.slug } 
    });
  } catch (err) {
    return reply.status(500).send({ 
      success: false, 
      error: `Failed to write file: ${err}` 
    });
  }
});

fastify.post('/webhook/trigger-rebuild', async (_req, reply) => {
  const result = await triggerRebuild();
  return reply.send({ success: result.triggered, data: result });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Webhook server running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();