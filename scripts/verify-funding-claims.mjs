#!/usr/bin/env node
/**
 * Funding-claim verifier for runany.dev blog posts.
 *
 * Background: AgentLair author complaint (2026-08-04). A post claimed
 * "YC S26" in 5 places (description + body + checklist + conclusion +
 * TL;DR). Description leaked into JSON-LD, which answer engines ingested.
 * Tool turned out to be a single-operator indie project.
 *
 * This script catches that class of error at publish time.
 *
 * What it checks:
 *   1. If the frontmatter description or body contains a funding /
 *      credibility claim (YC, Y Combinator, funded by, raised $XM,
 *      seed round, Series [A-E], backed by [VC name]), the post MUST
 *      contain a Hacker News launch URL (news.ycombinator.com/item?id=...)
 *      OR a URL to an official source that explicitly confirms the claim
 *      (e.g., the company's own /about page or a press release).
 *
 *   2. Claims mentioning a YC batch (e.g., "YC S26", "Y Combinator W25")
 *      are treated as the highest-risk class because wrong batch names
 *      are common and JSON-LD ingestion makes them sticky.
 *
 * What it does NOT do:
 *   - Verify the claim itself is accurate. It only checks that the
 *     author left an auditable anchor (HN thread or official-source URL).
 *     Manual fact-check still required.
 *
 * Usage:
 *   node scripts/verify-funding-claims.mjs [file ...]
 *   node scripts/verify-funding-claims.mjs            # scans all MDX
 *
 * Exit codes:
 *   0 = clean
 *   1 = claim(s) without anchor (prints each)
 *   2 = file not found / I/O error
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BLOG_DIR = 'apps/web/src/content/blog';

// Funding / credibility claim patterns. Add to this list as new patterns
// show up in author complaints.
const CLAIM_PATTERNS = [
  // Highest risk: named YC batch
  { name: 'yc-batch',         re: /\bYC[\s-]*[SWFX]\d{2}\b/i,                    severity: 'high' },
  { name: 'yc-batch-name',    re: /\bY Combinator[\s-]+(?:['"]?)(?:S|W|X|F|P)\d{2}\b/i, severity: 'high' },
  { name: 'yc-backed',        re: /\b(?:YC|Y Combinator)[-\s]?backed\b/i,        severity: 'high' },
  { name: 'y-combinator',     re: /\bY Combinator\b/i,                           severity: 'medium' },
  // Generic "backed by / funded by" — claim about funding source
  { name: 'funded-by',        re: /\b(?:funded|financed|sponsored)\s+by\b/i,     severity: 'medium' },
  { name: 'backed-by-vc',     re: /\bbacked\s+by\s+[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/, severity: 'medium' },
  // Money claims — if you say "raised $XM" you need an anchor
  { name: 'raised-amount',    re: /\braised\s+\$\s?\d+(?:\.\d+)?\s?[MmKk]?\b/i, severity: 'medium' },
  { name: 'seed-round',       re: /\bseed\s+round\b/i,                           severity: 'medium' },
  { name: 'series-round',     re: /\bSeries\s+[A-E]\b/,                          severity: 'medium' },
  // "YC launch" without specific batch — still needs anchor
  { name: 'yc-launch',        re: /\bYC\s+(?:launch|company|startup|backed)/i,   severity: 'medium' },
];

// Anchor patterns that count as an auditable source. HN thread is preferred
// because it usually contains the batch info in the headline; official /about
// pages are accepted when the author can't find an HN launch.
const ANCHOR_PATTERNS = [
  { name: 'hn-thread',  re: /news\.ycombinator\.com\/item\?id=\d+/i },
  { name: 'ycombinator', re: /ycombinator\.com\/companies\/[\w-]+/i },
];

const SOURCE_SECTION_RE = /^##\s+Source\s+and\s+Accuracy\s+Notes\s*$/im;

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: null, body: source };
  const data = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kv = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    data[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return { data, body: source.slice(match[0].length) };
}

function findClaims(text) {
  const hits = [];
  for (const { name, re, severity } of CLAIM_PATTERNS) {
    // Build a fresh RegExp with /g so matchAll can iterate; preserve flags.
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    for (const m of text.matchAll(new RegExp(re.source, flags))) {
      hits.push({
        pattern: name,
        severity,
        match: m[0],
        offset: m.index,
      });
    }
  }
  return hits;
}

function hasAnchor(text) {
  return ANCHOR_PATTERNS.some((p) => p.re.test(text));
}

function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

async function lintFile(filePath) {
  const findings = [];
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (e) {
    return [{ file: filePath, error: e.message }];
  }

  const { data, body } = parseFrontmatter(source);
  if (!data) {
    findings.push({ line: 1, severity: 'high', pattern: 'no-frontmatter',
      message: 'No frontmatter block found.' });
    return findings.map(f => ({ ...f, file: filePath }));
  }

  const description = data.description || '';
  const descClaims = findClaims(description);
  const bodyClaims = findClaims(body);

  // 1. Scan description (leaks into JSON-LD)
  for (const c of descClaims) {
    findings.push({
      line: lineOf(source, source.indexOf(c.match)),
      severity: c.severity === 'high' ? 'high' : 'medium',
      pattern: c.pattern,
      message: `Description contains "${c.match}" (leaks into JSON-LD) — must include an HN thread or official source URL in the post.`,
    });
  }

  // 2. Scan body
  for (const c of bodyClaims) {
    findings.push({
      line: lineOf(body, c.offset) + source.slice(0, source.length - body.length).split('\n').length - 1,
      severity: c.severity,
      pattern: c.pattern,
      message: `Body contains "${c.match}" without an auditable anchor.`,
    });
  }

  // 3. If any claim found, require an anchor
  if (findings.length > 0 && !hasAnchor(body)) {
    findings.push({
      line: 0,
      severity: 'high',
      pattern: 'missing-anchor',
      message: 'Funding/credibility claim(s) detected but no Hacker News thread (news.ycombinator.com/item?id=...) or official /about URL found. Add a link in the "Source and Accuracy Notes" section so readers (and future-you) can verify.',
    });
  }

  // 4. Soft warning if claim in description but body has no Source section
  if (descClaims.length > 0 && !SOURCE_SECTION_RE.test(body)) {
    findings.push({
      line: 0,
      severity: 'medium',
      pattern: 'no-source-section',
      message: 'Funding claim in description but post has no "## Source and Accuracy Notes" section. Add one.',
    });
  }

  return findings.map(f => ({ ...f, file: filePath }));
}

async function main() {
  const args = process.argv.slice(2);
  const stagedMode = args.includes('--staged');
  const positional = args.filter((a) => !a.startsWith('--'));

  let files;
  if (positional.length > 0) {
    files = positional;
  } else if (stagedMode) {
    // Read list of staged MDX files from git. Used by pre-commit hook so
    // authors aren't blocked by unfixed findings in old posts.
    const { execFileSync } = await import('node:child_process');
    let staged;
    try {
      staged = execFileSync(
        'git',
        ['diff', '--cached', '--name-only', '--diff-filter=AM'],
        { encoding: 'utf8' }
      );
    } catch (e) {
      console.error('SKIP: not in a git repo or git diff failed.');
      process.exit(0);
    }
    files = staged
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.endsWith('.mdx') && f.startsWith(BLOG_DIR));
    if (files.length === 0) {
      console.log('No staged MDX files — skipping.');
      process.exit(0);
    }
  } else {
    const dir = path.join(process.cwd(), BLOG_DIR);
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith('.mdx')).sort().map((f) => path.join(dir, f));
  }
  if (files.length === 0) {
    console.error('No MDX files to check.');
    process.exit(0);
  }

  let totalFindings = 0;
  let totalFilesWithClaims = 0;
  for (const f of files) {
    const findings = await lintFile(f);
    if (findings.length === 0) continue;
    totalFilesWithClaims += 1;
    console.log(`\n${path.relative(process.cwd(), f)}:`);
    for (const fnd of findings) {
      totalFindings += 1;
      const sev = fnd.severity === 'high' ? '❌ HIGH' : '⚠️  MED ';
      console.log(`  L${String(fnd.line).padStart(4)}  [${sev}] [${fnd.pattern}]  ${fnd.message}`);
    }
  }

  if (totalFindings === 0) {
    console.log(`OK: ${files.length} file(s) clean — no unanchored funding/credibility claims.`);
    process.exit(0);
  }

  console.log(`\n${totalFindings} finding(s) across ${totalFilesWithClaims} file(s) of ${files.length} checked.`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});