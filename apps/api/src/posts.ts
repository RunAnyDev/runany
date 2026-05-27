import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { PostFrontmatter, PostSummary } from '@runany/shared';

const BLOG_DIR = '/Users/friday/personal/runany/content/blog';

function getPostFiles(): string[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }
  return fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));
}

function parsePostFile(filename: string): { frontmatter: PostFrontmatter; content: string } | null {
  try {
    const filePath = path.join(BLOG_DIR, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    
    const slug = filename.replace(/\.mdx?$/, '');
    
    return {
      frontmatter: {
        title: data.title || slug,
        date: data.date ? String(data.date) : '1970-01-01',
        slug,
        excerpt: data.excerpt || '',
        category: data.category || 'General',
        tags: data.tags || [],
        author: data.author || 'Anonymous',
        published: data.published !== false,
      },
      content,
    };
  } catch {
    return null;
  }
}

export function getAllPosts(): PostSummary[] {
  const files = getPostFiles();
  const posts: PostSummary[] = [];

  for (const file of files) {
    const parsed = parsePostFile(file);
    if (parsed && parsed.frontmatter.published !== false) {
      posts.push(parsed.frontmatter);
    }
  }

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): { frontmatter: PostFrontmatter; content: string } | null {
  const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
  const mdPath = path.join(BLOG_DIR, `${slug}.md`);
  const filePath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null;

  if (!filePath) return null;
  
  const parsed = parsePostFile(path.basename(filePath));
  return parsed;
}

export function getRelatedPosts(slug: string, limit = 4): PostSummary[] {
  const current = getPostBySlug(slug);
  if (!current) return [];

  const all = getAllPosts().filter(p => p.slug !== slug);
  const currentTags = new Set(current.frontmatter.tags || []);
  const currentCategory = current.frontmatter.category || '';

  const scored = all.map(post => {
    let score = 0;
    if (post.category === currentCategory) score += 3;
    for (const tag of post.tags || []) {
      if (currentTags.has(tag)) score += 1;
    }
    return { post, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || new Date(b.post.date).getTime() - new Date(a.post.date).getTime())
    .slice(0, limit)
    .map(s => s.post);
}

export function getCategories(): Record<string, number> {
  const posts = getAllPosts();
  const cats: Record<string, number> = {};
  for (const post of posts) {
    const c = post.category || 'General';
    cats[c] = (cats[c] || 0) + 1;
  }
  return cats;
}

export function getTags(): Record<string, number> {
  const posts = getAllPosts();
  const tags: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.tags || []) {
      tags[tag] = (tags[tag] || 0) + 1;
    }
  }
  return tags;
}