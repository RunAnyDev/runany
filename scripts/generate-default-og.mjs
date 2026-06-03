#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outPath = path.join(root, 'apps/web/public/og-default.png');
const avatarPath = path.join(root, 'apps/web/public/avatar-runanydev.png');

async function loadDotEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  const raw = await readFile(envPath, 'utf8');
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

async function generateBackground() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('Missing MINIMAX_API_KEY');

  const prompt = [
    'Create background art for runany.dev default Open Graph image.',
    'Use futuristic developer workstation mood, abstract orchestration panels, connected nodes, subtle terminal energy, no readable UI.',
    'Palette: dark navy #020617 and #0f172a, cyan #22d3ee, electric blue #2563eb, emerald #34d399, faint violet accents.',
    'Composition: wide 16:9 editorial banner with clean negative space on left-center for logo and tagline overlay.',
    'Strict: no text, no letters, no numbers, no words, no logos, no watermarks, no fake typography, no code glyphs.'
  ].join(' ');

  const response = await fetch('https://api.minimax.io/v1/image_generation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt,
      response_format: 'base64',
      n: 1,
      aspect_ratio: '16:9',
      prompt_optimizer: true,
    }),
  });

  const result = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) throw new Error(`MiniMax HTTP ${response.status}: ${JSON.stringify(result)}`);

  const baseResp = result.base_resp || {};
  if (baseResp.status_code != null && baseResp.status_code !== 0) {
    throw new Error(`MiniMax failed: ${JSON.stringify(baseResp)}`);
  }

  const data = result.data || {};
  const b64 = Array.isArray(data.image_base64) ? data.image_base64[0] : data.image_base64;
  if (!b64) throw new Error(`No image payload: ${JSON.stringify(result)}`);

  return Buffer.from(String(b64).replace(/^data:[^,]+,/, ''), 'base64');
}

function overlaySvg() {
  return Buffer.from(`
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(2,6,23,0.88)"/>
        <stop offset="100%" stop-color="rgba(15,23,42,0.82)"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#67e8f9"/>
        <stop offset="100%" stop-color="#34d399"/>
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#22d3ee" flood-opacity="0.28"/>
      </filter>
    </defs>

    <rect x="56" y="66" width="620" height="498" rx="36" fill="url(#panel)" stroke="rgba(125,211,252,0.24)"/>
    <rect x="56" y="66" width="620" height="498" rx="36" fill="none" stroke="rgba(34,211,238,0.18)" stroke-width="2"/>
    <rect x="92" y="102" width="548" height="426" rx="28" fill="rgba(15,23,42,0.62)" stroke="rgba(125,211,252,0.12)"/>
    <circle cx="1000" cy="144" r="96" fill="rgba(34,211,238,0.16)"/>
    <circle cx="1080" cy="516" r="132" fill="rgba(37,99,235,0.12)"/>
    <path d="M720 208H1088" stroke="rgba(103,232,249,0.18)" stroke-width="2"/>
    <path d="M760 248H1110" stroke="rgba(148,163,184,0.2)" stroke-width="2"/>
    <path d="M742 288H1050" stroke="rgba(52,211,153,0.18)" stroke-width="2"/>
    <path d="M790 328H1118" stroke="rgba(148,163,184,0.16)" stroke-width="2"/>
    <path d="M724 368H1036" stroke="rgba(103,232,249,0.16)" stroke-width="2"/>
    <path d="M770 408H1092" stroke="rgba(37,99,235,0.16)" stroke-width="2"/>

    <text x="390" y="242" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="68" font-weight="800" letter-spacing="-2" fill="#f8fafc">runany.dev</text>
    <text x="390" y="302" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="#67e8f9">AI SETUP · DEVELOPER TOOLS · LOCAL LLM</text>
    <text x="390" y="348" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" font-weight="500" fill="#cbd5e1">Practical guides for AI-native developers</text>

    <rect x="168" y="390" width="424" height="12" rx="6" fill="rgba(15,23,42,0.55)"/>
    <rect x="168" y="390" width="272" height="12" rx="6" fill="url(#accent)" filter="url(#glow)"/>
    <rect x="168" y="426" width="320" height="12" rx="6" fill="rgba(15,23,42,0.55)"/>
    <rect x="168" y="426" width="198" height="12" rx="6" fill="rgba(125,211,252,0.9)"/>
    <rect x="168" y="462" width="368" height="12" rx="6" fill="rgba(15,23,42,0.55)"/>
    <rect x="168" y="462" width="244" height="12" rx="6" fill="rgba(52,211,153,0.85)"/>
  </svg>`);
}

await loadDotEnv();
const bg = await generateBackground();
const logo = await sharp(avatarPath).resize(112, 112).png().toBuffer();

const output = await sharp(bg)
  .resize(1200, 630, { fit: 'cover' })
  .composite([
    { input: Buffer.from('<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#020617" fill-opacity="0.16"/></svg>') },
    { input: overlaySvg() },
    { input: logo, left: 334, top: 92 },
  ])
  .png()
  .toBuffer();

await writeFile(outPath, output);
console.log(`Wrote ${outPath}`);
