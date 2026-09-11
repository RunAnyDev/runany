#!/usr/bin/env node
// Generate a 1200x630 WebP thumbnail for a GitHub trending repo and write to /tmp.
// Does NOT upload — caller is expected to use scripts/r2-upload.mjs after.
//
// Usage:
//   node scripts/gh_trending_thumbnail.mjs <owner>/<repo> <outPath> [stars] [language] [description]
//
// Example:
//   node scripts/gh_trending_thumbnail.mjs ayghri/i-have-adhd /tmp/thumb.webp 40548 Python "A skill to stop your coding agent..."

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { createThumbnailSvg, renderSvgToWebp } from './lib/thumbnail-svg.mjs';

const arg = process.argv[2];
const outPath = process.argv[3];
const stars = process.argv[4] || '';
const language = process.argv[5] || '';
const description = process.argv[6] || '';

if (!arg || !outPath || !/^[^/\s]+\/[^/\s]+$/.test(arg)) {
  console.error('Usage: node scripts/gh_trending_thumbnail.mjs <owner>/<repo> <outPath> [stars] [language] [description]');
  process.exit(2);
}

const [owner, repo] = arg.split('/');
const slug = String(repo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const starsLabel = stars ? `${Number(stars).toLocaleString('en-US')} stars` : '';
const title = repo.length > 28 ? `${owner}/${repo}` : repo;
const subtitle = description ? description.slice(0, 110) : `${owner}/${repo} on GitHub`;

const svg = createThumbnailSvg({
  title,
  slug,
  kicker: 'GITHUB TRENDING',
  subtitle,
  metadata: [starsLabel, language, `github.com/${owner}/${repo}`].filter(Boolean),
  seed: `${owner}/${repo}`,
});

await mkdir(dirname(outPath), { recursive: true });
const webp = await renderSvgToWebp(svg, { quality: 86 });
await sharp(webp).toFile(outPath);
console.log(`OK ${outPath} (${webp.length} bytes) for ${arg}`);
