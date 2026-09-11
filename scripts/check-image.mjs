#!/usr/bin/env node
// scripts/check-image.mjs — Pre-publish image audit for a single blog post.
//
// Usage:  node scripts/check-image.mjs <slug>
//
// Verifies, in order:
//   1. MDX frontmatter has a non-empty image block pointing to the runany CDN
//   2. The CDN actually serves that URL (HEAD returns 200)
//   3. A local thumbnail file exists at apps/web/public/blog/thumbnails/<slug>.webp
//   4. Local file size matches what R2 actually has (catches stale local copy)
//   5. og:image meta on the dev server matches the CDN URL (only if dev server up)
//
// Exits 0 on hard-pass (with optional soft warnings printed to stderr).
// Exits 1 on hard-fail (missing image, empty URL, CDN 4xx/5xx, local file missing).
//
// Real hit 2026-09-11: 71 posts had correct CDN URL in frontmatter but R2 was
// missing the file. This audit catches that class of error before commit.
//
// Dependencies: wrangler (via npx) for the R2 size check, curl for the HEAD
// probe. No Node SDK imports needed.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/check-image.mjs <slug>");
  process.exit(1);
}

const postPath = resolve(root, `apps/web/src/content/blog/${slug}.mdx`);
const localThumbPath = resolve(root, `apps/web/public/blog/thumbnails/${slug}.webp`);
const cdnUrl = `https://cdn.runany.dev/blog/thumbnails/${slug}.webp`;

const errors = [];
const warnings = [];

// 1. Frontmatter image block
// Find the MDX file by matching the slug suffix — filenames have a YYYY-MM-DD-HHMMSS- prefix
// If multiple files match (slug is substring of other slugs), pick the one whose
// frontmatter image.url matches the expected CDN URL — that's the unambiguous match.
let postFile = null;
const blogDir = resolve(root, "apps/web/src/content/blog");
import { readdirSync } from "node:fs";

const blogFiles = existsSync(blogDir)
  ? readdirSync(blogDir).filter((f) => f.endsWith(".mdx") && f.includes(slug))
  : [];

if (blogFiles.length === 0) {
  errors.push(`MDX post not found: apps/web/src/content/blog/*${slug}.mdx`);
} else {
  // Find the file whose frontmatter image.url matches the expected CDN URL
  let candidates = [];
  for (const f of blogFiles) {
    const text = readFileSync(resolve(blogDir, f), "utf-8");
    const m = text.match(/^image:\s*\n\s+url:\s+"([^"]*)"/m);
    if (m && m[1].trim() === cdnUrl) {
      candidates.push(f);
    }
  }
  if (candidates.length === 0) {
    // No MDX has image.url matching the CDN URL — pick the first one with a slug
    // match and surface its actual URL as an error.
    postFile = blogFiles[0];
  } else if (candidates.length > 1) {
    warnings.push(`Multiple MDX files reference ${cdnUrl}: ${candidates.join(", ")} — using the first`);
    postFile = candidates[0];
  } else {
    postFile = candidates[0];
  }
}

if (postFile) {
  const text = readFileSync(resolve(blogDir, postFile), "utf-8");
  const m = text.match(/^image:\s*\n\s+url:\s+"([^"]*)"/m);
  if (!m) {
    errors.push("MDX frontmatter MISSING 'image:' block with 'url:' line");
  } else {
    const url = m[1].trim();
    if (!url) {
      errors.push("MDX frontmatter image.url is EMPTY");
    } else if (!url.startsWith("https://cdn.runany.dev/blog/thumbnails/")) {
      errors.push(`MDX frontmatter image.url not on runany CDN: ${url}`);
    } else if (!url.endsWith(".webp")) {
      errors.push(`MDX frontmatter image.url not .webp: ${url}`);
    } else if (url !== cdnUrl) {
      // Accept cache-bust renames like "wolffish-new.webp" where the basename
      // starts with the slug. See Cloudflare R2 → cdn.runany.dev edge cache
      // negative-cache-lock entry in agent memory for why renames happen.
      const urlBasename = url.split("/").pop().replace(/\.webp$/, "");
      if (!urlBasename.startsWith(slug)) {
        errors.push(`MDX frontmatter image.url slug mismatch: expected ${cdnUrl}, got ${url}`);
      }
    }
  }
}

// 2. CDN serves the URL (with browser-like UA to bypass potential bot filtering)
let cdnStatus = null;
try {
  // Node v26 has flaky behavior with execSync spawning curl subshells (ETIMEDOUT),
  // so use the native fetch API instead.
  const res = await fetch(cdnUrl, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });
  cdnStatus = res.status;
} catch (e) {
  warnings.push(`CDN HEAD probe failed to execute: ${e.message?.slice(0, 100)}`);
}

if (cdnStatus === null) {
  errors.push(`CDN HEAD probe returned no status (network/curl error)`);
} else if (cdnStatus !== 200) {
  errors.push(
    `CDN returned ${cdnStatus} for ${cdnUrl} — image not served. ` +
      `Re-upload via 'npx wrangler r2 object put' or generate fresh via 'connector__matrix__generate_image'.`
  );
}

// 3. Local thumbnail file exists
let localSize = null;
if (!existsSync(localThumbPath)) {
  errors.push(`Local thumbnail MISSING: ${localThumbPath}`);
} else {
  localSize = statSync(localThumbPath).size;
}

// 4. Local size matches R2 (catches stale local copy)
if (localSize !== null && cdnStatus === 200) {
  try {
    const dlPath = `/tmp/check-image-${slug}.webp`;
    const res = await fetch(cdnUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const remoteSize = buf.length;
    if (localSize !== remoteSize) {
      warnings.push(
        `Local file size (${localSize}) != CDN-served size (${remoteSize}) — local copy is stale`
      );
    }
  } catch (e) {
    warnings.push(`R2 size probe skipped: ${e.message?.slice(0, 100)}`);
  }
}

// 5. Dev server og:image (only if running)
try {
  const devRes = await fetch(`http://localhost:4321/blog/${slug}/`, {
    signal: AbortSignal.timeout(5000),
  });
  if (devRes.ok) {
    const html = await devRes.text();
    const ogMatch = html.match(/og:image"[^>]*content="([^"]*)"/);
    if (ogMatch) {
      const og = ogMatch[1];
      if (og !== cdnUrl) {
        warnings.push(
          `Dev server og:image is '${og}', not ${cdnUrl} — restart 'astro dev' to pick up MDX changes`
        );
      }
    }
  }
} catch {
  // Dev server not running — skip silently
}

// Report
if (warnings.length) {
  console.error(`⚠️  ${warnings.length} warning(s):`);
  for (const w of warnings) console.error(`   - ${w}`);
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}

console.log(`✓ image audit passed for ${slug}`);
console.log(`  CDN: ${cdnStatus === 200 ? "200 OK" : `unexpected ${cdnStatus}`}`);
console.log(`  local: ${localSize !== null ? `${localSize} bytes` : "MISSING"}`);
console.log(`  URL: ${cdnUrl}`);
process.exit(0);
