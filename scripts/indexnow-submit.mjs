#!/usr/bin/env node
// Submit URLs to IndexNow for instant indexing across Bing, Yandex, DuckDuckGo,
// Seznam, Naver, and Ecosia. Used after publishing a new blog post so search
// engines pick it up within minutes instead of waiting for the next crawl.
//
// Usage:
//   node scripts/indexnow-submit.mjs                    # submit latest post + home
//   node scripts/indexnow-submit.mjs <slug> [<slug>...] # submit specific slugs
//   node scripts/indexnow-submit.mjs --all              # submit every published post
//
// The IndexNow key lives in the .env file (INDEXNOW_KEY) and the same key is
// hosted at https://runany.dev/{key}.txt so search engines can verify ownership.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const blogDir = join(root, 'apps/web/src/content/blog');

const loadEnv = () => {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
};

loadEnv();

const key = process.env.INDEXNOW_KEY;
const siteUrl = process.env.SITE_URL || 'https://runany.dev';
const host = new URL(siteUrl).host;

if (!key) {
  console.error('Missing INDEXNOW_KEY in .env');
  process.exit(1);
}

const stripTimestamp = (id) => id.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, '').replace(/\.mdx?$/, '');

const getAllSlugs = () => {
  if (!existsSync(blogDir)) return [];
  return readdirSync(blogDir)
    .filter((f) => f.endsWith('.mdx'))
    .map(stripTimestamp)
    .filter(Boolean);
};

const args = process.argv.slice(2);
let urls = [];

if (args.includes('--all')) {
  urls = getAllSlugs().map((slug) => `${siteUrl}/blog/${slug}/`);
  urls.push(`${siteUrl}/`, `${siteUrl}/blog/`);
} else if (args.length > 0) {
  urls = args.map((slug) => `${siteUrl}/blog/${slug}/`);
} else {
  // Default: submit home + blog + latest post
  urls = [`${siteUrl}/`, `${siteUrl}/blog/`];
  const all = getAllSlugs();
  if (all.length > 0) urls.push(`${siteUrl}/blog/${all[0]}/`);
}

if (urls.length === 0) {
  console.error('No URLs to submit.');
  process.exit(1);
}

const payload = {
  host,
  key,
  keyLocation: `${siteUrl}/${key}.txt`,
  urlList: urls,
};

const submit = async () => {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (res.status === 200) {
    console.log(`IndexNow: submitted ${urls.length} URL(s) — status 200 OK`);
    return;
  }
  if (res.status === 202) {
    console.log(`IndexNow: accepted ${urls.length} URL(s) — status 202 (will be processed)`);
    return;
  }

  const body = await res.text();
  console.error(`IndexNow: failed with HTTP ${res.status}`);
  console.error(body);
  process.exit(1);
};

submit().catch((err) => {
  console.error('IndexNow submission error:', err.message ?? err);
  process.exit(1);
});
