import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(input, maxChars, maxLines) {
  const words = String(input || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines) {
    const joined = words.join(' ');
    if (!lines.join(' ').startsWith(joined)) {
      lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?-]*$/, '')}…`;
    }
  }
  return lines;
}

function paletteFromSeed(seed) {
  const text = String(seed || 'runany');
  let hash = 0;
  for (const char of text) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const palettes = [
    ['#22d3ee', '#2563eb', '#34d399'],
    ['#60a5fa', '#22c55e', '#a78bfa'],
    ['#38bdf8', '#14b8a6', '#6366f1'],
    ['#06b6d4', '#3b82f6', '#10b981'],
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

export function createThumbnailSvg({
  title,
  slug,
  kicker,
  subtitle,
  metadata = [],
  seed,
}) {
  const [accentA, accentB, accentC] = paletteFromSeed(seed || slug || title);
  const titleLines = wrapText(title, 24, 3);
  const subLines = wrapText(subtitle, 42, 2);
  const meta = metadata.filter(Boolean).slice(0, 3).map((item) => escapeXml(item));
  const safeKicker = escapeXml(kicker || 'RUNANY.DEV');

  const titleText = titleLines.map((line, index) => {
    const y = 220 + index * 72;
    return `<text x="88" y="${y}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="60" font-weight="800" letter-spacing="-1.8" fill="#f8fafc">${escapeXml(line)}</text>`;
  }).join('');

  const subtitleText = subLines.map((line, index) => {
    const y = 438 + index * 34;
    return `<text x="88" y="${y}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="24" font-weight="500" fill="#cbd5e1">${escapeXml(line)}</text>`;
  }).join('');

  const metaText = meta.map((line, index) => {
    const y = 520 + index * 26;
    return `<text x="88" y="${y}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="17" font-weight="600" fill="#94a3b8">${line}</text>`;
  }).join('');

  return `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${accentA}"/>
        <stop offset="55%" stop-color="${accentB}"/>
        <stop offset="100%" stop-color="${accentC}"/>
      </linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="32"/></filter>
      <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="${accentA}" flood-opacity="0.45"/></filter>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="988" cy="142" r="120" fill="${accentA}" fill-opacity="0.16" filter="url(#blur)"/>
    <circle cx="1080" cy="498" r="150" fill="${accentB}" fill-opacity="0.14" filter="url(#blur)"/>
    <circle cx="784" cy="344" r="92" fill="${accentC}" fill-opacity="0.12" filter="url(#blur)"/>

    <rect x="64" y="60" width="1072" height="510" rx="36" fill="rgba(15,23,42,0.72)" stroke="rgba(148,163,184,0.16)"/>
    <rect x="88" y="90" width="568" height="32" rx="16" fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.16)"/>
    <circle cx="120" cy="106" r="5" fill="#fb7185"/>
    <circle cx="140" cy="106" r="5" fill="#f59e0b"/>
    <circle cx="160" cy="106" r="5" fill="#34d399"/>
    <text x="188" y="112" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700" fill="#67e8f9">${safeKicker}</text>

    <rect x="728" y="120" width="320" height="190" rx="28" fill="rgba(2,6,23,0.58)" stroke="rgba(148,163,184,0.14)"/>
    <rect x="752" y="144" width="136" height="136" rx="24" fill="url(#accent)" fill-opacity="0.15" stroke="rgba(125,211,252,0.22)"/>
    <path d="M796 214 L842 168 L888 214 L842 260 Z" fill="url(#accent)" filter="url(#glow)"/>
    <path d="M930 156 H1012" stroke="rgba(148,163,184,0.28)" stroke-width="10" stroke-linecap="round"/>
    <path d="M930 192 H1028" stroke="rgba(148,163,184,0.22)" stroke-width="10" stroke-linecap="round"/>
    <path d="M930 228 H998" stroke="rgba(148,163,184,0.18)" stroke-width="10" stroke-linecap="round"/>

    <rect x="728" y="336" width="320" height="162" rx="28" fill="rgba(2,6,23,0.54)" stroke="rgba(148,163,184,0.14)"/>
    <path d="M768 444 C824 356, 900 522, 968 408 S1050 360, 1088 414" stroke="url(#accent)" stroke-width="8" fill="none" stroke-linecap="round" filter="url(#glow)"/>
    <circle cx="768" cy="444" r="9" fill="${accentA}"/>
    <circle cx="848" cy="390" r="9" fill="${accentB}"/>
    <circle cx="932" cy="452" r="9" fill="${accentC}"/>
    <circle cx="1006" cy="394" r="9" fill="${accentA}"/>

    ${titleText}
    ${subtitleText}
    ${metaText}
  </svg>`;
}

export async function renderSvgToWebp(svg, { quality = 86 } = {}) {
  return sharp(Buffer.from(svg)).resize(WIDTH, HEIGHT, { fit: 'cover' }).webp({ quality }).toBuffer();
}

export async function renderSvgToPng(svg) {
  return sharp(Buffer.from(svg)).resize(WIDTH, HEIGHT, { fit: 'cover' }).png().toBuffer();
}
