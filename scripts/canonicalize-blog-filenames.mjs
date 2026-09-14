#!/usr/bin/env node
/**
 * Canonicalize blog post filenames to `YYYY-MM-DD-HHMMSS-slug.mdx`.
 *
 * Why:
 *   Some legacy posts were published with mixed timestamp prefixes
 *   (compact `20260824030318-`, glue variants `20260805-160425-`, etc.).
 *   That mixed-format mess used to break string-sort on `post.id` and made
 *   older articles surface before newer ones on the homepage (fixed in
 *   `utils/posts.ts`, but the files themselves still vary). This script
 *   brings them all to one canonical form so future agents and tooling
 *   don't trip on it.
 *
 *   URL/slug is preserved exactly — `utils/slug.ts` already strips every
 *   variant, so this is filename-only.
 *
 * Usage:
 *   node scripts/canonicalize-blog-filenames.mjs --dry-run
 *   node scripts/canonicalize-blog-filenames.mjs --apply
 */
import { readdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const BLOG_DIR = join(REPO_ROOT, 'apps/web/src/content/blog');

// Match in priority order — most specific first.
// Each returns { year, month, day, time, rest } or null.
const VARIANTS = [
  // Canonical already — `2026-08-11-041500-foo`
  { name: 'canonical', re: /^(\d{4})-(\d{2})-(\d{2})-(\d{6})-(.+)$/ },
  // `20260805-160425-foo` — 8 digits glued, dash, 6 digits glued
  { name: 'compact-date-time', re: /^(\d{4})(\d{2})(\d{2})-(\d{6})-(.+)$/ },
  // `2026-0811-041500-foo` — MMDD glued
  { name: 'glued-mmdd', re: /^(\d{4})-(\d{2})(\d{2})-(\d{6})-(.+)$/ },
  // `2026-08-07190415-foo` — DDHHMMSS glued
  { name: 'glued-ddtime', re: /^(\d{4})-(\d{2})-(\d{2})(\d{6})-(.+)$/ },
  // `20260811041500-foo` — fully compact
  { name: 'fully-compact', re: /^(\d{4})(\d{2})(\d{2})(\d{6})-(.+)$/ },
];

const canonicalize = (filename) => {
  const base = filename.replace(/\.mdx?$/, '');
  for (const v of VARIANTS) {
    const m = base.match(v.re);
    if (m) {
      const [, y, mo, d, time, rest] = m;
      return {
        variant: v.name,
        canonical: `${y}-${mo}-${d}-${time}-${rest}.mdx`,
        slug: rest,
      };
    }
  }
  return null;
};

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('Usage: canonicalize-blog-filenames.mjs (--dry-run | --apply)');
  process.exit(2);
}

const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
const renames = [];
const skips = [];
const unknowns = [];

for (const f of files) {
  const c = canonicalize(f);
  if (!c) { unknowns.push(f); continue; }
  if (c.variant === 'canonical') { skips.push(f); continue; }
  if (c.canonical === f) { skips.push(f); continue; }
  renames.push({ from: f, to: c.canonical, slug: c.slug, variant: c.variant });
}

// Safety: ensure no slug would collide and no two targets point to the same name.
const targetSlugs = new Map();
for (const r of renames) {
  if (targetSlugs.has(r.slug)) {
    console.error(`FATAL: slug collision — ${targetSlugs.get(r.slug)} and ${r.from} both want slug "${r.slug}"`);
    process.exit(1);
  }
  targetSlugs.set(r.slug, r.from);
}

// Safety: ensure target filename doesn't already exist.
for (const r of renames) {
  const dst = join(BLOG_DIR, r.to);
  if (existsSync(dst)) {
    console.error(`FATAL: target already exists: ${r.to}`);
    process.exit(1);
  }
}

console.log(`Found ${renames.length} files to rename (${skips.length} already canonical, ${unknowns.length} unrecognized):\n`);
for (const r of renames) {
  console.log(`  [${r.variant}]`);
  console.log(`    ${r.from}`);
  console.log(`    → ${r.to}`);
  console.log(`    slug preserved: ${r.slug}`);
}

if (unknowns.length > 0) {
  console.log(`\nUnrecognized (will NOT touch):`);
  for (const f of unknowns) console.log(`  ${f}`);
}

if (isDryRun) {
  console.log('\nDRY RUN — no files renamed.');
  process.exit(0);
}

console.log('\nApplying renames via git mv...');
for (const r of renames) {
  const src = join(BLOG_DIR, r.from);
  const dst = join(BLOG_DIR, r.to);
  try {
    execSync(`git mv "${src}" "${dst}"`, { stdio: 'pipe', cwd: REPO_ROOT });
    console.log(`  ✓ ${r.from} → ${r.to}`);
  } catch (err) {
    console.error(`  ✗ FAILED ${r.from}: ${err.message}`);
    process.exit(1);
  }
}

console.log(`\nDone. ${renames.length} files renamed. Run git status to review.`);
