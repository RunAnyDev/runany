import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const blogDir = path.join(root, 'apps/web/src/content/blog');

function loadEnv() {
  const dotenv = readFileSync(resolve(root, '.env'), 'utf-8');
  for (const line of dotenv.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseThumbnailSlug(source) {
  const match = source.match(/\nimage:\n\s+url:\s+"https:\/\/cdn\.runany\.dev\/blog\/thumbnails\/([^"/]+)\.webp"/m);
  return match?.[1] ?? null;
}

async function listR2Thumbnails() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Missing R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const thumbnails = new Set();
  let continuationToken;

  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'blog/thumbnails/',
      ContinuationToken: continuationToken,
    }));

    for (const entry of result.Contents ?? []) {
      const key = entry.Key ?? '';
      if (!key.endsWith('.webp')) continue;
      thumbnails.add(key.replace('blog/thumbnails/', '').replace(/\.webp$/, ''));
    }

    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);

  return thumbnails;
}

function collectBlogThumbnailRefs() {
  const files = readdirSync(blogDir).filter((file) => file.endsWith('.md') || file.endsWith('.mdx')).sort();
  const refs = [];

  for (const file of files) {
    const source = readFileSync(path.join(blogDir, file), 'utf8');
    const slug = parseThumbnailSlug(source);
    if (!slug) {
      refs.push({ file, slug: null, kind: 'missing-frontmatter' });
      continue;
    }
    refs.push({ file, slug, kind: 'ok' });
  }

  return refs;
}

function collectStagedBlogThumbnailRefs() {
  const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    cwd: root,
    encoding: 'utf8',
  });

  const files = output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => file.startsWith('apps/web/src/content/blog/'))
    .filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));

  const refs = [];
  for (const file of files) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const slug = parseThumbnailSlug(source);
    if (!slug) {
      refs.push({ file, slug: null, kind: 'missing-frontmatter' });
      continue;
    }
    refs.push({ file, slug, kind: 'ok' });
  }

  return refs;
}

const mode = process.argv.includes('--staged') ? 'staged' : 'all';

loadEnv();

const refs = mode === 'staged' ? collectStagedBlogThumbnailRefs() : collectBlogThumbnailRefs();

if (mode === 'staged' && refs.length === 0) {
  console.log('Thumbnail check skipped: no staged blog posts.');
  process.exit(0);
}

const r2Thumbnails = await listR2Thumbnails();

const missingFrontmatter = refs.filter((ref) => ref.kind === 'missing-frontmatter');
const missingR2 = refs.filter((ref) => ref.slug && !r2Thumbnails.has(ref.slug));

if (missingFrontmatter.length || missingR2.length) {
  if (missingFrontmatter.length) {
    console.error('Posts missing valid thumbnail frontmatter:');
    for (const ref of missingFrontmatter) console.error(`- ${ref.file}`);
  }

  if (missingR2.length) {
    console.error('Posts pointing to missing R2 thumbnails:');
    for (const ref of missingR2) console.error(`- ${ref.file} -> ${ref.slug}.webp`);
  }

  process.exit(1);
}

console.log(`Thumbnail check OK (${mode}): ${refs.length} posts reference existing R2 thumbnails.`);
