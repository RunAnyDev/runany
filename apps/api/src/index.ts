import Fastify from 'fastify';
import { getAllPosts, getPostBySlug, getRelatedPosts, getCategories, getTags } from './posts.js';

const fastify = Fastify({ logger: true });

fastify.get('/api/posts', async (_req, reply) => {
  const posts = getAllPosts();
  return reply.send({ success: true, data: posts });
});

fastify.get('/api/posts/:slug', async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const post = getPostBySlug(slug);
  if (!post) {
    return reply.status(404).send({ success: false, error: 'Post not found' });
  }
  return reply.send({ success: true, data: post });
});

fastify.get('/api/posts/:slug/related', async (req, reply) => {
  const { slug } = req.params as { slug: string };
  const related = getRelatedPosts(slug, 4);
  return reply.send({ success: true, data: { posts: related } });
});

fastify.get('/api/categories', async (_req, reply) => {
  const cats = getCategories();
  return reply.send({ success: true, data: cats });
});

fastify.get('/api/tags', async (_req, reply) => {
  const tags = getTags();
  return reply.send({ success: true, data: tags });
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('API server running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();