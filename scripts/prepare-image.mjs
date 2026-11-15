#!/usr/bin/env node
// Prepare a webp image for the blog without distorting it.
//
// Usage:
//   node scripts/prepare-image.mjs illustration <src> <out>   # body illustration
//   node scripts/prepare-image.mjs thumbnail   <src> <out>   # 1200x630 OG thumbnail
//
// Why this exists: `cwebp -resize W H` forces the output to exactly WxH, so a
// 1544x1060 screenshot became 1400x1400 and the text looked stretched. The two
// modes here never distort:
//
//   illustration  fit: inside   scales down to fit 1400x1400, aspect preserved,
//                               no upscaling of small sources
//   thumbnail    fit: cover    crops to 1200x630 around the most interesting
//                               region (same smart crop the GitHub trending
//                               thumbnail helper uses), aspect preserved
//
// Prints the resulting dimensions so the caller can verify.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const mode = process.argv[2];
const src = process.argv[3];
const out = process.argv[4];

if (!mode || !src || !out) {
  console.error("Usage: node scripts/prepare-image.mjs <illustration|thumbnail> <src> <out>");
  process.exit(2);
}
if (!existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(2);
}

const pipeline = sharp(src, { failOn: "none" }).rotate();

if (mode === "illustration") {
  await pipeline
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out);
} else if (mode === "thumbnail") {
  await pipeline
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .webp({ quality: 85 })
    .toFile(out);
} else {
  console.error(`Unknown mode: ${mode} (expected illustration or thumbnail)`);
  process.exit(2);
}

const meta = await sharp(out).metadata();
console.log(`${mode}: ${meta.width}x${meta.height} -> ${resolve(out)}`);
