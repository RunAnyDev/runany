import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const blogDir = path.join(root, 'apps/web/src/content/blog');
const validCategories = new Set(['ai-setup', 'tutorial', 'dev-tools', 'self-hosted', 'review', 'news']);

// The blog post template (see .blog-post-template.md) tightened its editorial
// rules over time, so posts were grandfathered under an earlier date while the
// archive was backfilled. That backfill is done: this date now predates the
// oldest post, so both tiers cover every file. Keep the constant so a future
// split can move the boundary without touching the checks below.
const CONVENTIONS_START = '2026-02-28';
const blockedPhrases = [
  /Important rule/i,
  /duplicate coverage/i,
  /thumbnail generated/i,
  /README says/i,
  /README shows/i,
  /according to the README/i,
  /the extracted sections/i,
];
const oldGenericHeadings = [
  /## Step 1: Clone the Official Repository/i,
  /## Step 2: Follow README Commands/i,
  /## Step 5: Evaluate Before Adopting/i,
];
// Trending-post required sections. "Source and Accuracy Notes" is mandatory;
// the setup-related section name is flexible because lean + visual density
// rules allow alternatives like "How to try it" / "Getting it running" / "Install".
const trendingRequiredSections = [
  'Source and Accuracy Notes',
];
const trendingSetupSectionAlternatives = [
  'Repo-Specific Setup Workflow',
  'How to try it',
  'How It Works',
  'Getting it running',
  'Install',
  'Setup',
  'Quick Start',
  'Workflow',
];

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: null, body: source };
  const data = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const keyValue = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!keyValue) continue;
    const [, key, rawValue] = keyValue;
    data[key] = parseYamlScalar(rawValue);
  }
  return { data, body: source.slice(match[0].length) };
}

function parseYamlScalar(rawValue) {
  const value = rawValue.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, ''));
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function fencedCodeBlocks(source) {
  return [...source.matchAll(/```([^\n]*)\n[\s\S]*?```/g)].map((match) => match[1].trim());
}

function wordCount(source) {
  return (source.match(/\b[\p{L}\p{N}_'-]+\b/gu) || []).length;
}

function h2Headings(source) {
  return [...source.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
}

function hasSection(source, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^##\\s+${escaped}(?:\\s|:|$)`, 'im').test(source)
    || (sectionName === 'What Is' && /^##\s+What Is\s+.+\??$/im.test(source));
}

function faqBlock(source) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^##\s+FAQ\s*$/.test(line));
  if (start === -1) return '';
  const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join('\n');
}

// Every check records its problem instead of throwing on the first one. Failing
// fast used to hide failures: in one post an over-length description masked an
// over-length title, so the title only surfaced on a second run.
function record(problems, condition, message) {
  if (!condition) problems.push(message);
}

function assertNoProblems(fileName, problems) {
  assert.equal(problems.length, 0, `${fileName}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
}

// Structure: what the Astro collection schema actually demands, so a post that
// breaks `astro sync` / `astro build` can never be committed. Runs against every
// post, with no grandfathering. Mirrors apps/web/src/content.config.ts — those
// four fields are the only ones without a default or `.optional()`.
function checkStructure(source, problems) {
  const { data } = parseFrontmatter(source);
  if (!data) {
    problems.push("frontmatter block is required (opening '---' with no closing '---'?)");
    return null;
  }

  for (const field of ['title', 'pubDate', 'category', 'tags']) {
    record(problems, data[field] !== undefined, `missing required frontmatter field ${field}`);
  }

  record(problems, typeof data.title === 'string', 'title must be a string');
  if (typeof data.title === 'string') {
    record(problems, data.title.trim().length > 0, 'title must not be empty');
  }
  if (typeof data.pubDate === 'string') {
    record(problems, data.pubDate.length > 0, 'pubDate must not be empty');
  }
  record(problems, validCategories.has(data.category), `unknown category ${data.category} (expected one of ${[...validCategories].join(', ')})`);
  record(problems, Array.isArray(data.tags), 'tags must be an array');
  if (Array.isArray(data.tags)) {
    record(problems, data.tags.length > 0, 'tags must not be empty');
  }

  return data;
}

// Conventions: the editorial rules from .blog-post-template.md. Only enforced
// for posts published on or after CONVENTIONS_START.
function checkConventions(fileName, data, body, problems) {
  const hasDescription = typeof data.description === 'string';
  record(problems, hasDescription, 'description must be a string');
  if (hasDescription) {
    record(problems, data.description.length >= 80, `description must be at least 80 chars (${data.description.length})`);
    record(problems, data.description.length <= 200, `description must be 200 chars or fewer (${data.description.length})`);
  }
  if (typeof data.title === 'string') {
    record(problems, data.title.length <= 60, `title must be 60 chars or fewer (${data.title.length})`);
  }
  record(problems, data.author === 'Friday', 'author must be Friday');
  record(problems, data.draft === false, 'draft must be false');
  for (const tag of Array.isArray(data.tags) ? data.tags : []) {
    record(problems, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag), `tag must be lowercase hyphenated: ${tag}`);
  }

  // TL;DR blockquote is required (real content); the H2 header for it is optional
  // per the lean + visual density rules (posts can have any heading structure).
  record(problems, /^>\s+\*\*TL;DR:\*\*/m.test(body), 'missing TL;DR block quote');
  record(problems, fencedCodeBlocks(body).every((lang) => lang.length > 0), 'fenced code block missing language identifier');
  // Visual density rules require enough structure. New posts target ≥4 H2.
  // Legacy lean-format posts may have only 1 H2 (Source and Accuracy Notes).
  record(problems, h2Headings(body).length >= 1, 'expected at least 1 H2 section (## Source and Accuracy Notes)');
  for (const phrase of blockedPhrases) {
    record(problems, !phrase.test(body), `leaked internal/bot phrase ${phrase}`);
  }

  if (Array.isArray(data.tags) && data.tags.includes('github-trending')) checkTrendingPost(fileName, body, problems);
}

function checkTrendingPost(fileName, body, problems) {
  for (const section of trendingRequiredSections) {
    record(problems, hasSection(body, section), `missing trending section ${section}`);
  }
  // Setup section is optional (curated-list posts don't need one).
  // If present, name is flexible — accept any common alternative.
  // FAQ is optional — if present it must have ≥4 questions.
  // Conclusion, TL;DR header are also optional (lean + visual density rules).
  if (/^##\s+FAQ\s*$/m.test(body)) {
    const faq = faqBlock(body);
    const questions = [...faq.matchAll(/\*\*Q:\s+(.+?)\*\*/g)].map((match) => match[1]);
    const answers = [...faq.matchAll(/\*\*A:\*\*/g)];
    record(problems, questions.length >= 4, `FAQ section present but has only ${questions.length} questions (need ≥4)`);
    record(problems, answers.length >= 4, `FAQ section present but has only ${answers.length} answers (need ≥4)`);
    for (const question of questions) {
      record(problems, !/tracking|thumbnail|generated|generation|duplicate|official GitHub repository/i.test(question), `FAQ question is meta, not repo-specific: ${question}`);
    }
  }
  record(problems, wordCount(body) >= 380, `github-trending post must be at least 380 words (${wordCount(body)})`);
  for (const heading of oldGenericHeadings) {
    record(problems, !heading.test(body), `old generic setup heading still present ${heading}`);
  }
}

describe('blog post template parser', () => {
  it('rejects missing code block language identifiers', () => {
    const invalid = `---\ntitle: "Valid Title"\ndescription: "${'x'.repeat(130)}"\npubDate: "2026-05-28"\ntags: ["dev-tools"]\ncategory: "dev-tools"\nauthor: "Friday"\ndraft: false\n---\n\n## TL;DR\n\n> **TL;DR:** Summary.\n\n## Body\n\n\`\`\`\necho hi\n\`\`\`\n\n## FAQ\n\n**Q: Test?**\n**A:** Yes.\n\n## Conclusion\n`;
    assert.throws(() => {
      const problems = [];
      const { data, body } = parseFrontmatter(invalid);
      checkStructure(invalid, problems);
      checkConventions('invalid.mdx', data, body, problems);
      assertNoProblems('invalid.mdx', problems);
    }, /missing language identifier/);
  });

  // Regression guard: a frontmatter block opened with --- but never closed makes
  // Astro swallow the rest of the file as frontmatter, which breaks astro sync
  // in CI and astro build on deploy.
  it('rejects an unterminated frontmatter block', () => {
    const unterminated = `---\ntitle: "Orca"\ntags: ["dev-tools"]\ncategory: "dev-tools"\npubDate: "2026-10-18"\n\nBody text with no closing fence.\n`;
    assert.throws(() => {
      const problems = [];
      checkStructure(unterminated, problems);
      assertNoProblems('unterminated.mdx', problems);
    }, /frontmatter block is required/);
  });

  // A single post can break several rules at once. Reporting only the first one
  // hid a long title behind a long description until a second run.
  it('reports every problem in one pass', () => {
    const broken = `---\ntitle: "${'T'.repeat(80)}"\ndescription: "${'d'.repeat(220)}"\npubDate: "2026-05-28"\ntags: ["Dev Tools"]\ncategory: "nope"\nauthor: "Someone"\ndraft: true\n---\n\nNo TL;DR here.\n\n\`\`\`\nplain\n\`\`\`\n`;
    const problems = [];
    const { data, body } = parseFrontmatter(broken);
    checkStructure(broken, problems);
    checkConventions('broken.mdx', data, body, problems);
    assert.throws(() => assertNoProblems('broken.mdx', problems), (error) => {
      const text = error.message;
      const expected = [
        'unknown category nope',
        'title must be 60 chars or fewer',
        'description must be 200 chars or fewer',
        'author must be Friday',
        'draft must be false',
        'tag must be lowercase hyphenated: Dev Tools',
        'missing TL;DR block quote',
        'fenced code block missing language identifier',
      ];
      for (const fragment of expected) {
        if (!text.includes(fragment)) return false;
      }
      return true;
    });
  });
});

function filenameDate(fileName) {
  const match = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

async function readBlogFiles() {
  const files = await readdir(blogDir);
  return files.filter((file) => file.endsWith('.md') || file.endsWith('.mdx')).sort();
}

// Structural check runs against every post. It mirrors the Astro collection
// schema, so anything it rejects would have broken the CI type-check and the
// Cloudflare Pages deploy.
describe('blog post structure (every post)', async () => {
  for (const file of await readBlogFiles()) {
    it(`${file} has frontmatter the Astro schema accepts`, async () => {
      const source = await readFile(path.join(blogDir, file), 'utf8');
      const problems = [];
      checkStructure(source, problems);
      assertNoProblems(file, problems);
    });
  }
});

describe(`blog post conventions (published on or after ${CONVENTIONS_START})`, async () => {
  const files = (await readBlogFiles()).filter((file) => filenameDate(file) >= CONVENTIONS_START);

  for (const file of files) {
    it(`${file} follows the blog template`, async () => {
      const source = await readFile(path.join(blogDir, file), 'utf8');
      const problems = [];
      const data = checkStructure(source, problems);
      // Convention checks read frontmatter fields, so only run them once the
      // structural pass has shown those fields exist.
      if (data) {
        const { body } = parseFrontmatter(source);
        checkConventions(file, data, body, problems);
      }
      assertNoProblems(file, problems);
    });
  }
});
