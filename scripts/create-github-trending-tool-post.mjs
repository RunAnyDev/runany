#!/usr/bin/env node
import { createHmac, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, '.data');
const trackingPath = path.join(dataDir, 'written-repos.txt');
const postsPerRun = Number.parseInt(process.env.POSTS_PER_RUN || '17', 10);
const refreshTracked = process.env.REFRESH_TRACKED === '1';

async function loadDotEnv() {
  const filePath = path.join(root, '.env');
  if (!existsSync(filePath)) return;
  const raw = await readFile(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function seoTitle(repo) {
  const languageKeyword = repo.language ? `${repo.language} ` : '';
  const suffix = ` Setup Guide: Open Source ${languageKeyword}AI Tool`;
  const maxNameLength = Math.max(12, 60 - suffix.length);
  const name = repo.name.length > maxNameLength
    ? repo.name.slice(0, maxNameLength).replace(/[-_\s]+$/g, '')
    : repo.name;
  return `${name}${suffix}`;
}

function validateRequiredEnv() {
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  const required = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    R2_ENDPOINT_OR_R2_ACCOUNT_ID: endpoint,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
}

function r2Config() {
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  const required = {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    R2_ENDPOINT: endpoint,
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing R2 env: ${missing.join(', ')}`);
  return required;
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function awsDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function escapeSvg(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function optimizeSvg(svg) {
  return svg
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .trim();
}

function thumbnailSvg(repo, title) {
  const description = repo.description || 'Open-source AI and developer tool';
  const language = repo.language || 'Developer Tool';
  const stars = repo.stargazers_count.toLocaleString('en-US');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1020" cy="80" r="210" fill="#60a5fa" opacity="0.18"/>
  <circle cx="140" cy="560" r="240" fill="#22c55e" opacity="0.14"/>
  <text x="72" y="92" fill="#93c5fd" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">runany.dev · GitHub Tool Guide</text>
  <text x="72" y="210" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800">${escapeSvg(title)}</text>
  <text x="72" y="298" fill="#dbeafe" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="500">${escapeSvg(description.slice(0, 110))}</text>
  <text x="72" y="430" fill="#bfdbfe" font-family="Inter, Arial, sans-serif" font-size="28">${escapeSvg(repo.full_name)}</text>
  <text x="72" y="488" fill="#e0f2fe" font-family="Inter, Arial, sans-serif" font-size="24">${escapeSvg(language)} · ${stars} stars · ${escapeSvg(repo.license?.spdx_id || 'No license detected')}</text>
  <rect x="72" y="526" width="280" height="50" rx="25" fill="#ffffff" opacity="0.14"/>
  <text x="102" y="559" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">Setup guide</text>
</svg>`;
  return optimizeSvg(svg);
}

async function putR2Object(key, body, contentType) {
  const config = r2Config();
  const endpoint = new URL(config.R2_ENDPOINT);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`/${config.R2_BUCKET}/${encodedKey}`, endpoint);
  const now = new Date();
  const amzDate = awsDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';
  const payloadHash = sha256(body);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${config.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed ${response.status}: ${detail} Check R2 credentials and bucket name.`);
  }
  return `${config.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

async function uploadThumbnail(repo, title, slug) {
  const key = `blog/thumbnails/${slug}.svg`;
  const body = thumbnailSvg(repo, title);
  if (body.byteLength > 80_000) throw new Error(`Optimized thumbnail too large: ${body.byteLength} bytes`);
  return putR2Object(key, body, 'image/svg+xml');
}

async function readTrackedRepos() {
  try {
    const raw = await readFile(trackingPath, 'utf8');
    return new Set(
      raw
        .split('\n')
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith('#')),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
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
    'User-Agent': 'runany-trending-thumbnail-helper',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

function isSafeRepo(repo) {
  const text = [repo.full_name, repo.name, repo.description, ...(repo.topics || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const blocked = ['kms', 'crack', 'activator', 'keygen', 'piracy', 'malware'];
  return !blocked.some((term) => text.includes(term));
}

async function fetchRepo(fullName) {
  return github(`/repos/${fullName}`);
}

async function findRepos(trackedRepos) {
  const createdAfter = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  const queries = [
    `created:>${createdAfter} stars:>100 topic:ai`,
    `created:>${createdAfter} stars:>100 topic:developer-tools`,
    `created:>${createdAfter} stars:>100 topic:cli`,
    `created:>${createdAfter} stars:>100 topic:llm`,
    `created:>${createdAfter} stars:>100 tool`,
  ];
  const results = [];
  for (const search of queries) {
    const query = encodeURIComponent(search);
    const data = await github(`/search/repositories?q=${query}&sort=stars&order=desc&per_page=30`);
    results.push(...(data.items || []));
  }
  const uniqueRepos = [...new Map(results.map((repo) => [repo.full_name, repo])).values()]
    .sort((left, right) => right.stargazers_count - left.stargazers_count);
  return uniqueRepos.filter((repo) => isSafeRepo(repo) && !trackedRepos.has(repo.full_name.toLowerCase()));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function prepareRepoAssets(repo) {
  const title = seoTitle(repo);
  const slug = slugify(title);
  const thumbnailUrl = await uploadThumbnail(repo, title, slug);
  return { repo, title, slug, thumbnailUrl };
}

function printAssetSummary(asset) {
  const { repo, title, slug, thumbnailUrl } = asset;
  const tags = ['github-trending', 'dev-tools', repo.language, ...(repo.topics || []).slice(0, 3)]
    .filter(Boolean)
    .map((tag) => slugify(String(tag)).replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  console.log(JSON.stringify({
    repo: repo.full_name,
    repoUrl: repo.html_url,
    title,
    slug,
    thumbnailUrl,
    imageAlt: `${repo.name} GitHub tool guide thumbnail`,
    suggestedFile: `apps/web/src/content/blog/${slug}.mdx`,
    suggestedTags: [...new Set(tags)].slice(0, 5),
    category: 'dev-tools',
    pubDate: today(),
  }, null, 2));
}

async function main() {
  await loadDotEnv();
  validateRequiredEnv();
  await mkdir(dataDir, { recursive: true });
  const trackedRepos = await readTrackedRepos();

  const explicitRepos = process.argv.slice(2).filter((arg) => /^[^\s/]+\/[^\s/]+$/.test(arg));
  const repos = explicitRepos.length
    ? await Promise.all(explicitRepos.map(fetchRepo))
    : refreshTracked
      ? await Promise.all([...trackedRepos].map(fetchRepo))
      : (await findRepos(trackedRepos)).slice(0, Math.max(1, postsPerRun));

  if (!repos.length) throw new Error('No GitHub repo selected for thumbnail update.');

  for (const repo of repos) {
    const asset = await prepareRepoAssets(repo);
    printAssetSummary(asset);
    trackRepo(trackedRepos, repo);
  }
  await writeTrackedRepos(trackedRepos);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
