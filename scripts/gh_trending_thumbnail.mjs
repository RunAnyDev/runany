#!/usr/bin/env node
// Generate a 1200x630 WebP thumbnail for a GitHub trending repo and write to /tmp.
// Does NOT upload — caller is expected to use scripts/r2-upload.mjs after.
//
// Usage:
//   node scripts/gh_trending_thumbnail.mjs <owner>/<repo> <outPath> [stars] [language] [description] [homepage]
//
// Example:
//   node scripts/gh_trending_thumbnail.mjs ayghri/i-have-adhd /tmp/thumb.webp 40548 Python "A skill to stop your coding agent..."
//
// Image source priority (runany.dev policy: real product image first, never a
// generated card unless every real source fails):
//   1. GitHub social preview  -> `https://opengraph.githubassets.com/1/OWNER/REPO`
//      (renders the repo's real avatar, description and live star/fork counts,
//       and honours a repo's own .github social preview image)
//   2. Product site og:image  -> only when `homepage` is passed
//   3. Generated SVG template -> scripts/lib/thumbnail-svg.mjs (fallback only)

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { createThumbnailSvg, renderSvgToWebp } from './lib/thumbnail-svg.mjs';

const arg = process.argv[2];
const outPath = process.argv[3];
const stars = process.argv[4] || '';
const language = process.argv[5] || '';
const description = process.argv[6] || '';
const homepage = process.argv[7] || '';

const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const WIDTH = 1200;
const HEIGHT = 630;

if (!arg || !outPath || !/^[^/\s]+\/[^/\s]+$/.test(arg)) {
  console.error('Usage: node scripts/gh_trending_thumbnail.mjs <owner>/<repo> <outPath> [stars] [language] [description] [homepage]');
  process.exit(2);
}

const [owner, repo] = arg.split('/');

async function decodeImage(buffer) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  if (!meta.width || meta.width < 200) throw new Error(`unusable image (${meta.format} ${meta.width}x${meta.height})`);
  return meta;
}

async function fromGitHubSocialPreview() {
  const res = await fetch(`https://opengraph.githubassets.com/1/${owner}/${repo}`, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 3000) throw new Error(`too small (${buffer.length}B)`);
  await decodeImage(buffer);
  return { buffer, source: `github-social-preview:${owner}/${repo}` };
}

async function fromSiteOgImage() {
  const site = homepage.startsWith('http') ? homepage : `https://${homepage}`;
  const res = await fetch(site, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`site HTTP ${res.status}`);
  const html = await res.text();
  const pick = (re) => html.match(re)?.[1];
  const raw = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    || pick(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i);
  if (!raw) throw new Error('no og:image on site');
  const imageUrl = new URL(raw.replace(/&amp;/g, '&'), site).toString();
  const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!imgRes.ok) throw new Error(`og:image HTTP ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  if (buffer.length < 3000) throw new Error(`og:image too small (${buffer.length}B)`);
  await decodeImage(buffer);
  return { buffer, source: `site-og-image:${new URL(imageUrl).host}` };
}

function fromSvgTemplate() {
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
  return { svg, source: 'svg-template:FALLBACK' };
}

await mkdir(dirname(outPath), { recursive: true });

const attempts = [
  ['github-social-preview', () => fromGitHubSocialPreview()],
  ...(homepage ? [['site-og-image', () => fromSiteOgImage()]] : []),
];

let source = null;
const errors = [];
for (const [label, run] of attempts) {
  try {
    const r = await run();
    source = r;
    break;
  } catch (err) {
    errors.push(`${label}: ${String(err.message || err).slice(0, 80)}`);
  }
}

if (source) {
  await sharp(source.buffer, { failOn: 'none' })
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .webp({ quality: 86 })
    .toFile(outPath);
} else {
  const { svg } = fromSvgTemplate();
  const webp = await renderSvgToWebp(svg, { quality: 86 });
  await sharp(webp).toFile(outPath);
}

const { size } = await import('node:fs').then((fs) => fs.promises.stat(outPath));
console.log(`OK ${outPath} (${size} bytes) for ${arg} source=${source ? source.source : 'svg-template:FALLBACK'}${errors.length ? ` [skipped: ${errors.join('; ')}]` : ''}`);
