#!/usr/bin/env node
// Upload a thumbnail to Cloudflare R2 via wrangler.
//
// Why wrangler instead of @aws-sdk/client-s3:
//   - Node.js v26's bundled TLS rejects Cloudflare R2's S3-compatible endpoint
//     with `EPROTO ... sslv3 alert handshake failure` (SSL alert 40). Verified
//     on this Mac on 2026-09-11.
//   - Wrangler uses the Cloudflare API directly, bypassing the S3 endpoint.
//   - The previous version of this script (S3 SDK) is preserved as r2-upload-s3.mjs
//     in git history if anyone needs it.
//
// Usage:
//   node scripts/r2-upload.mjs <slug> <filePath>
//
// Reads R2_BUCKET from .env (no other R2 credentials needed — wrangler uses
// `npx wrangler` which picks up Cloudflare auth from `~/.config/.wrangler/`).

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env from repo root to get R2_BUCKET
const dotenvPath = resolve(root, ".env");
if (existsSync(dotenvPath)) {
  const raw = readFileSync(dotenvPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const slug = process.argv[2];
const filePath = process.argv[3];
const bucket = process.env.R2_BUCKET;

if (!slug || !filePath) {
  console.error("Usage: node scripts/r2-upload.mjs <slug> <filePath>");
  process.exit(1);
}
if (!bucket) {
  console.error("Missing R2_BUCKET in .env");
  process.exit(1);
}
if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const key = `blog/thumbnails/${slug}.webp`;

try {
  execSync(
    `npx -y --package=wrangler wrangler r2 object put "${bucket}/${key}" --file "${filePath}" --remote`,
    { cwd: root, stdio: ["ignore", "inherit", "inherit"] }
  );
  console.log(`Upload OK → ${key}`);
} catch (e) {
  console.error(`Upload FAILED: ${e.message?.slice(0, 200) || e}`);
  process.exit(1);
}
