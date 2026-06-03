#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const distDir = path.join(repoRoot, 'apps/web/dist');
const sitemapPath = path.join(distDir, 'sitemap-0.xml');
const categoryDir = path.join(distDir, 'category');

if (!fs.existsSync(sitemapPath)) {
  console.error(`Sitemap not found: ${sitemapPath}`);
  process.exit(1);
}
if (!fs.existsSync(categoryDir)) {
  console.error(`Category dir not found: ${categoryDir}`);
  process.exit(1);
}

const categories = fs.readdirSync(categoryDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const lastmod = new Date().toISOString();
const categoryEntries = categories.map((slug) => {
  const url = `https://runany.dev/category/${slug}/`;
  return `<url><loc>${url}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;
}).join('');

let xml = fs.readFileSync(sitemapPath, 'utf8');
const closingTag = '</urlset>';
if (!xml.includes(closingTag)) {
  console.error('Sitemap missing </urlset> closing tag');
  process.exit(1);
}

if (/https:\/\/runany\.dev\/category\//.test(xml)) {
  console.log('Category entries already present in sitemap; nothing to do.');
  process.exit(0);
}

xml = xml.replace(closingTag, `${categoryEntries}${closingTag}`);
fs.writeFileSync(sitemapPath, xml);
console.log(`Augmented sitemap with ${categories.length} category URLs: ${categories.join(', ')}`);
