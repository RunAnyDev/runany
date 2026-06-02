#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const root = process.cwd();
const dataDir = path.join(root, '.data');
const trackingPath = path.join(dataDir, 'written-repos.txt');
const postsPerRun = Number.parseInt(process.env.POSTS_PER_RUN || '17', 10);

async function loadDotEnv() {
  const filePath = path.join(root, '.env');
  if (!existsSync(filePath)) return;
  const raw = await readFile(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function slugify(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function validateRequiredEnv() {
  const required = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
}

function getS3() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function putR2Object(key, body, contentType) {
  const s3 = getS3();
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

function makeSvg(repo) {
  const name = repo.name || repo.full_name;
  const desc = (repo.description || 'Open-source developer tool').slice(0, 120);
  const stars = (repo.stargazers_count || 0).toLocaleString('en-US');
  const lang = repo.language || '';
  const topics = (repo.topics || []).slice(0, 4).join(' · ') || 'developer-tools';
  const lines = [];
  let line = '';
  for (const word of desc.split(' ')) {
    if ((line + ' ' + word).length > 45) { lines.push(line.trim()); line = word; }
    else { line += ' ' + word; }
  }
  if (line) lines.push(line.trim());
  const descLines = lines.map((l) => `<tspan x="60" dy="28">${escapeXml(l)}</tspan>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0f1a"/>
      <stop offset="50%" stop-color="#0d1528"/>
      <stop offset="100%" stop-color="#0a0f1a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#0066ff"/>
    </linearGradient>
    <linearGradient id="emerald" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00ff88"/>
      <stop offset="100%" stop-color="#00cc66"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g stroke="#1a2540" stroke-width="0.5" opacity="0.4">
    ${Array.from({length:19}, (_,i) => `<line x1="${i*63}" y1="0" x2="${i*63}" y2="630"/>`).join('\n    ')}
    ${Array.from({length:11}, (_,i) => `<line x1="0" y1="${i*60}" x2="1200" y2="${i*60}"/>`).join('\n    ')}
  </g>
  <g opacity="0.15">
    <circle cx="1080" cy="100" r="80" fill="none" stroke="#00d4ff" stroke-width="1.5"/>
    <circle cx="1080" cy="100" r="50" fill="none" stroke="#0066ff" stroke-width="1"/>
    <circle cx="150" cy="530" r="60" fill="none" stroke="#00ff88" stroke-width="1"/>
    <line x1="150" y1="530" x2="300" y2="430" stroke="#00ff88" stroke-width="0.5"/>
    <line x1="1080" y1="100" x2="950" y2="220" stroke="#00d4ff" stroke-width="0.5"/>
    <line x1="950" y1="220" x2="800" y2="150" stroke="#0066ff" stroke-width="0.5"/>
  </g>
  <rect x="45" y="35" width="1110" height="560" rx="8" fill="none" stroke="url(#accent)" stroke-width="1.5" opacity="0.6"/>
  <rect x="48" y="38" width="1104" height="554" rx="6" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.25"/>
  <circle cx="75" cy="62" r="5" fill="#ff5f57" opacity="0.6"/>
  <circle cx="95" cy="62" r="5" fill="#ffbd2e" opacity="0.6"/>
  <circle cx="115" cy="62" r="5" fill="#28ca41" opacity="0.6"/>
  <text x="60" y="160" font-family="system-ui, -apple-system, sans-serif" font-size="46" font-weight="700" fill="#ffffff" filter="url(#glow)">${escapeXml(name)}</text>
  <text x="60" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#8899aa">
    ${descLines}
  </text>
  <rect x="60" y="310" width="200" height="42" rx="8" fill="#1a2540" stroke="#00d4ff" stroke-width="1"/>
  <text x="80" y="338" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#00d4ff">★ ${stars} stars</text>
  <text x="60" y="395" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#00ff88" font-weight="500">${escapeXml(topics)}</text>
  ${lang ? `<text x="60" y="430" font-family="system-ui, -apple-system, sans-serif" font-size="15" fill="#667788">${escapeXml(lang)}</text>` : ''}
  <text x="1140" y="590" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#3a5060" text-anchor="end">runany.dev</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generateAndUploadThumbnail(repo, slug) {
  const svg = makeSvg(repo);
  const webpBuffer = await sharp(Buffer.from(svg)).resize(1200, 630).webp({ quality: 85 }).toBuffer();
  const key = `blog/thumbnails/${slug}.webp`;
  const publicUrl = await putR2Object(key, webpBuffer, 'image/webp');
  return publicUrl;
}

async function readTrackedRepos() {
  try {
    const raw = await readFile(trackingPath, 'utf8');
    return new Set(
      raw.split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#'))
    );
  } catch (e) {
    if (e.code === 'ENOENT') return new Set();
    throw e;
  }
}

async function writeTrackedRepos(trackedRepos) {
  await mkdir(dataDir, { recursive: true });
  const lines = [...trackedRepos].sort();
  await writeFile(trackingPath, `${lines.join('\n')}\n`);
}

function trackRepo(trackedRepos, repo) {
  trackedRepos.add(repo.full_name.toLowerCase());
}

async function github(pathname) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'runany-trending-helper',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text().slice(0, 200)}`);
  return response.json();
}

function isSafeRepo(repo) {
  const text = [repo.full_name, repo.name, repo.description, ...(repo.topics || [])]
    .filter(Boolean).join(' ').toLowerCase();
  const blocked = ['kms', 'crack', 'activator', 'keygen', 'piracy', 'malware'];
  return !blocked.some((t) => text.includes(t));
}

async function fetchRepo(fullName) {
  return github(`/repos/${fullName}`);
}

async function findRepos(trackedRepos) {
  const createdAfter = new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);
  const queries = [
    `created:>${createdAfter} stars:>50 topic:ai`,
    `created:>${createdAfter} stars:>50 topic:developer-tools`,
    `created:>${createdAfter} stars:>50 topic:cli`,
    `created:>${createdAfter} stars:>50 topic:llm`,
    `created:>${createdAfter} stars:>50 topic:agent`,
    `created:>${createdAfter} stars:>100 tool`,
    `created:>${createdAfter} stars:>50 topic:mcp`,
  ];
  const results = [];
  for (const search of queries) {
    const query = encodeURIComponent(search);
    const data = await github(`/search/repositories?q=${query}&sort=stars&order=desc&per_page=25`);
    results.push(...(data.items || []));
  }
  const uniqueRepos = [...new Map(results.map((r) => [r.full_name, r])).values()]
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
  return uniqueRepos.filter((r) => isSafeRepo(r) && !trackedRepos.has(r.full_name.toLowerCase()));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  await loadDotEnv();
  validateRequiredEnv();
  await mkdir(dataDir, { recursive: true });
  const trackedRepos = await readTrackedRepos();

  const explicitRepos = process.argv.slice(2).filter((a) => /^[^\s/]+\/[^\s/]+$/.test(a));
  let repos;
  if (explicitRepos.length) {
    repos = await Promise.all(explicitRepos.map(fetchRepo));
  } else {
    repos = (await findRepos(trackedRepos)).slice(0, postsPerRun);
  }

  if (!repos.length) {
    console.log('No new eligible repos found.');
    process.exit(0);
  }

  console.log(`Discovered ${repos.length} repos. Generating thumbnails...\n`);

  const assets = [];
  for (const repo of repos) {
    const slug = slugify(repo.name);
    process.stderr.write(`Uploading thumbnail: ${repo.full_name} → ${slug}\n`);
    const thumbnailUrl = await generateAndUploadThumbnail(repo, slug);
    const langSlug = repo.language ? slugify(repo.language) : null;
    const tags = ['github-trending', 'dev-tools', langSlug, ...(repo.topics || []).slice(0, 3).map(slugify)]
      .filter(Boolean).filter((t) => t && t.length > 0);
    const uniqueTags = [...new Set(tags)].slice(0, 5);
    assets.push({
      repo: repo.full_name,
      repoUrl: repo.html_url,
      name: repo.name,
      slug,
      thumbnailUrl,
      imageAlt: `${repo.name} GitHub tool guide thumbnail`,
      suggestedFile: `apps/web/src/content/blog/${slug}.mdx`,
      tags: uniqueTags,
      category: 'dev-tools',
      pubDate: today(),
      description: repo.description || '',
      language: repo.language || '',
      stars: repo.stargazers_count,
      topics: repo.topics || [],
      license: repo.license?.spdx_id || '',
    });
    trackRepo(trackedRepos, repo);
  }

  await writeTrackedRepos(trackedRepos);
  // Print JSON to stdout for piping
  console.log(JSON.stringify(assets, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
