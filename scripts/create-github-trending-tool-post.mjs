#!/usr/bin/env node
import { createHmac, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const blogDir = path.join(root, 'apps/web/src/content/blog');
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

function yamlEscape(input) {
  return String(input).replace(/"/g, '\\"');
}

function mdEscape(input) {
  return String(input).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
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
  <text x="72" y="488" fill="#e0f2fe" font-family="Inter, Arial, sans-serif" font-size="26">★ ${repo.stargazers_count.toLocaleString('en-US')} · ${escapeSvg(repo.language || 'Open Source')} · README-based setup</text>
</svg>`;
  const optimized = optimizeSvg(svg);
  return Buffer.from(optimized);
}

async function putR2Object(key, body, contentType) {
  const config = r2Config();
  const endpoint = new URL(config.R2_ENDPOINT);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`/${config.R2_BUCKET}/${encodedKey}`, endpoint);
  const now = new Date();
  const amzDate = awsDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const host = url.host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${config.R2_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
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
    const detail = await response.text();
    throw new Error(`R2 upload failed ${response.status}: ${detail} Check that R2 access key has Object Read & Write permission for bucket ${config.R2_BUCKET}, and that R2_BUCKET matches the bucket name exactly.`);
  }
  return `${config.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

async function uploadThumbnail(repo, title, slug) {
  const key = `blog/thumbnails/${slug}.svg`;
  const body = thumbnailSvg(repo, title);
  if (body.byteLength > 80_000) throw new Error(`Optimized thumbnail too large: ${body.byteLength} bytes`);
  return putR2Object(key, body, 'image/svg+xml');
}

function absoluteUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```bash\n$1\n```\n')
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n${'#'.repeat(Number(level))} ${text.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function docsLinksFromReadme(readme, repo) {
  const links = [];
  const linkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
  const wanted = /(doc|documentation|guide|getting.?started|quick.?start|install|setup|usage|example|tutorial)/i;
  for (const match of readme.matchAll(linkRegex)) {
    const label = match[1].trim();
    const href = match[2].trim().replace(/^<|>$/g, '');
    if (!wanted.test(`${label} ${href}`)) continue;
    if (href.startsWith('#') || href.startsWith('mailto:')) continue;
    const url = absoluteUrl(href, repo.html_url + '/');
    if (!url) continue;
    const allowed = url.includes('github.com') || url.includes('github.io') || url.includes(new URL(repo.html_url).hostname);
    if (!allowed) continue;
    links.push({ label, url });
  }
  return [...new Map(links.map((link) => [link.url, link])).values()].slice(0, 5);
}

async function fetchTextUrl(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'runany-trending-tool-blog' } });
  if (!response.ok) return '';
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  if (contentType.includes('text/html')) return stripHtml(body);
  return body;
}

async function fetchDocs(repo, readme) {
  const links = docsLinksFromReadme(readme.content, repo);
  const docs = [];
  for (const link of links) {
    const text = await fetchTextUrl(link.url).catch(() => '');
    if (text.trim()) docs.push({ ...link, content: text.slice(0, 30000) });
  }
  return docs;
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
    'User-Agent': 'runany-trending-tool-blog',
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

async function fetchReadme(repo) {
  try {
    const data = await github(`/repos/${repo.full_name}/readme`);
    const content = Buffer.from(data.content || '', data.encoding || 'base64').toString('utf8');
    return { content, url: data.html_url };
  } catch (error) {
    if (String(error.message).includes('GitHub API 404')) return { content: '', url: `${repo.html_url}#readme` };
    throw error;
  }
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
  return uniqueRepos.filter((repo) => {
    const fullName = repo.full_name.toLowerCase();
    return isSafeRepo(repo) && !trackedRepos.has(fullName);
  });
}

function tagList(repo) {
  const raw = ['github-trending', 'dev-tools', repo.language, ...(repo.topics || []).slice(0, 3)]
    .filter(Boolean)
    .map((tag) => slugify(String(tag)).replace(/^-+|-+$/g, ''))
    .filter(Boolean);
  return [...new Set(raw)].slice(0, 5);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readmeSections(readme) {
  const sections = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  const matches = [...readme.matchAll(regex)];
  for (let index = 0; index < matches.length; index += 1) {
    const title = matches[index][2].replace(/[#*`]/g, '').trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? readme.length;
    const body = readme.slice(start, end).trim();
    sections.push({ title, body });
  }
  return sections;
}

function relevantSections(readme) {
  const wanted = /(install|setup|quick.?start|get.?started|usage|configuration|config|environment|api.?key|docker|run|build|deploy|example)/i;
  return readmeSections(readme).filter((section) => wanted.test(section.title)).slice(0, 8);
}

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  for (const match of text.matchAll(regex)) {
    const lang = match[1] || 'bash';
    const code = match[2].trim();
    if (!code || code.length > 900) continue;
    blocks.push({ lang, code });
  }
  return blocks;
}

function readmeFacts(readme, docs = []) {
  const combined = [readme, ...docs.map((doc) => `# ${doc.label}\n${doc.content}`)].join('\n\n');
  const sections = relevantSections(combined);
  const blocks = [];
  for (const section of sections) blocks.push(...extractCodeBlocks(section.body).map((block) => ({ ...block, section: section.title })));
  return {
    hasReadme: readme.trim().length > 0,
    docs,
    sections,
    commandBlocks: blocks.slice(0, 10),
  };
}

function docsSummary(facts, readmeUrl) {
  if (!facts.hasReadme) {
    return `The repository README was not available through the GitHub API when this post was generated. Use the official repository page and check the current docs before installing.`;
  }
  if (!facts.sections.length) {
    return `The README is available at [the official docs source](${readmeUrl}), but it does not expose clear install or usage headings that can be extracted safely. This post avoids inventing commands and points you back to the repo docs.`;
  }
  const extraDocs = facts.docs.length
    ? ` Additional docs pages crawled: ${facts.docs.map((doc) => `[${doc.label}](${doc.url})`).join(', ')}.`
    : '';
  return `This guide is based on the repository README and docs links detected at [the official docs source](${readmeUrl}). Extracted sections include: ${facts.sections.map((section) => section.title).join(', ')}.${extraDocs}`;
}

function sectionNotes(facts) {
  if (!facts.sections.length) return '- No install or usage section was detected in the README metadata extraction.';
  return facts.sections
    .map((section) => {
      const clean = section.body
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[[^\]]+\]\([^\)]+\)/g, (value) => value.replace(/\]\(.+\)/, ']'))
        .replace(/[#*_>`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240);
      return `- **${mdEscape(section.title)}:** ${clean || 'README section exists, but text is mostly commands, images, or links.'}`;
    })
    .join('\n');
}

function commandBlocksMarkdown(facts) {
  if (!facts.commandBlocks.length) {
    return `The README extraction did not find short fenced command blocks for installation or usage. Do not guess commands. Open the README and follow the latest documented setup path.`;
  }
  return facts.commandBlocks
    .map((block, index) => `### README Command ${index + 1}: ${mdEscape(block.section)}\n\n\`\`\`${block.lang}\n${block.code}\n\`\`\``)
    .join('\n\n');
}

function postBody(repo, readme, docs = [], thumbnailUrl) {
  const facts = readmeFacts(readme.content, docs);
  const repoUrl = repo.html_url;
  const titleName = repo.name;
  const title = seoTitle(repo);
  const description = `${titleName} setup guide based on the official GitHub README: learn what this open-source AI tool does, documented install steps, and usage notes.`;
  const tags = tagList(repo);
  const cloneUrl = repo.clone_url;
  const stars = repo.stargazers_count.toLocaleString('en-US');
  const forks = repo.forks_count.toLocaleString('en-US');
  const issues = repo.open_issues_count.toLocaleString('en-US');
  const language = repo.language || 'Not specified';
  const license = repo.license?.spdx_id || 'Not specified';
  const updatedAt = repo.updated_at ? repo.updated_at.slice(0, 10) : 'Not specified';
  const createdAt = repo.created_at ? repo.created_at.slice(0, 10) : 'Not specified';
  const summary = repo.description || `${titleName} is an open-source project gaining traction on GitHub.`;
  const imageUrl = `https://opengraph.githubassets.com/runany-${today().replaceAll('-', '')}/${repo.full_name}`;

  return { title, body: `---
title: "${yamlEscape(title)}"
description: "${yamlEscape(description)}"
pubDate: "${today()}"
tags: ${JSON.stringify(tags)}
category: "dev-tools"
author: "Du"
featured: false
image:
  url: "${thumbnailUrl}"
  alt: "${yamlEscape(titleName)} GitHub tool guide thumbnail"
draft: false
---

![${titleName} GitHub tool guide thumbnail](${thumbnailUrl})

## TL;DR

> **TL;DR:** [${titleName}](${repoUrl}) is an emerging open-source developer tool with ${stars} stars; this guide follows the official README instead of guessing install steps.

## Source and Accuracy Notes

${docsSummary(facts, readme.url)}

Important rule for this post: when the README does not provide a command, this guide says so instead of inventing one. GitHub projects change quickly, so always compare this article with the current README before running commands.

## What Is ${titleName}?

${titleName} is an open-source project hosted at [${repo.full_name}](${repoUrl}). Repository summary: ${summary}

Repository signals at write time:

- Official GitHub repo: [${repo.full_name}](${repoUrl})
- README / docs source: [${readme.url}](${readme.url})
- Stars: ${stars}
- Forks: ${forks}
- Open issues: ${issues}
- Main language: ${language}
- License: ${license}
- Created: ${createdAt}
- Last updated: ${updatedAt}

## Docs-Derived Setup Notes

The following notes come from headings and text extracted from the official README and linked docs pages. They are not generic install guesses.

${sectionNotes(facts)}

## Step 1: Clone the Official Repository

Cloning is safe to document because it comes from the official GitHub repository URL. After cloning, read the README before installing dependencies.

\`\`\`bash
git clone ${cloneUrl}
cd ${repo.name}
\`\`\`

## Step 2: Follow README Commands

Use these commands only because they were found in README or linked docs setup, usage, configuration, or example sections. If a command is missing, check the official README link above.

${commandBlocksMarkdown(facts)}

## Step 3: Verify Configuration Requirements

Look for environment variables, API keys, model settings, service URLs, or Docker configuration mentioned in the README sections. Do not assume defaults for AI tools because they often depend on local models, cloud APIs, or workspace-specific settings.

If the README includes an environment example, copy that exact example file and fill in local values. If no environment example is documented, avoid creating one from guesswork.

## Step 4: Run a Small README-Based Test

Use the smallest command documented by the repo. Good first tests include a help command, example command, local demo, or test command only if the README explicitly shows it.

If the README does not document a smoke test, open issues and examples before trying the tool on real code or private data.

## Step 5: Evaluate Before Adopting

Use this checklist before adding ${titleName} to a real project:

- Does the README explain installation, configuration, and common errors?
- Do documented commands run on your machine without extra hidden steps?
- Are issues and pull requests active?
- Is the license compatible with your use case?
- Are releases or tags available?
- Can you pin a version or commit SHA?
- Does it need access to secrets, files, browsers, shells, or production systems?

## Security Notes

Treat every new developer tool as untrusted until reviewed. This matters more for AI agents, CLIs, browser automation tools, and code generators because they may read files, execute shell commands, or send data to external APIs.

Safer first-run habits:

- Run it in a temporary folder or container.
- Read install scripts before executing them.
- Avoid piping remote scripts directly into bash.
- Use a test API key with limited permissions.
- Check network calls if the tool handles private code or data.

## FAQ

**Q: Where is the official GitHub repository?**
**A:** The official repo is [${repo.full_name}](${repoUrl}).

**Q: Are install commands guessed?**
**A:** No. Commands in this post are extracted from README or linked docs sections. If no README command is found, the post tells you to use the official docs instead of inventing commands.

**Q: How do I avoid duplicate coverage later?**
**A:** This blog tracks covered repositories in .data/written-repos.txt, using one lowercased owner/repo entry per line.

**Q: When is the thumbnail generated?**
**A:** The generator creates an SVG thumbnail and uploads it to Cloudflare R2 before writing the MDX post, so the committed article already points to the final public image URL.

## Conclusion

${titleName} is worth evaluating only after reading the official README and running the documented setup path. Start with [${repo.full_name}](${repoUrl}), compare the extracted commands above with current docs, and test in a safe environment before using it on production code or private data.
` };
}

async function writePost(repo, flag = 'wx') {
  const readme = await fetchReadme(repo);
  const docs = await fetchDocs(repo, readme);
  const title = seoTitle(repo);
  const slug = slugify(title);
  const thumbnailUrl = await uploadThumbnail(repo, title, slug);
  const post = postBody(repo, readme, docs, thumbnailUrl);
  const filePath = path.join(blogDir, `${slug}.mdx`);
  await writeFile(filePath, post.body, { flag });
  return { filePath, slug };
}

async function main() {
  await loadDotEnv();
  validateRequiredEnv();
  await mkdir(blogDir, { recursive: true });
  const trackedRepos = await readTrackedRepos();

  if (refreshTracked) {
    for (const fullName of trackedRepos) {
      const repo = await fetchRepo(fullName);
      const { filePath } = await writePost(repo, 'w');
      console.log(`Refreshed ${filePath}`);
    }
    console.log(`Refreshed ${trackedRepos.size} tracked repo post(s).`);
    return;
  }

  const repos = await findRepos(trackedRepos);
  const limit = Math.max(1, postsPerRun);
  const selected = repos.slice(0, limit);
  if (!selected.length) throw new Error('No new GitHub trending repo found that is not already covered.');

  for (const repo of selected) {
    const { filePath } = await writePost(repo);
    trackRepo(trackedRepos, repo);
    console.log(`Created ${filePath}`);
    console.log(`Repo ${repo.html_url}`);
  }

  await writeTrackedRepos(trackedRepos);
  console.log(`Tracked ${trackedRepos.size} written repo(s) in ${trackingPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
