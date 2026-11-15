---
name: github-trending-tool-blog
description: Create and publish runany.dev blog posts about newly popular GitHub developer or AI tools, including repo research, thumbnail workflow, SEO review, validation, commit, and push rules.
---

# GitHub Trending Tool Blog

Use this skill to create runany.dev blog posts about newly popular GitHub developer or AI tools. The Codex agent writes the article with its current model. Do not make `scripts/create-github-trending-tool-post.mjs` call an AI API to write content.

## Workflow

1. Discover a target repository from GitHub trending/search or from the user's requested repo.
2. Fetch and read the official README plus linked docs that are relevant to setup, usage, configuration, architecture, limitations, and troubleshooting.
3. Use the agent's current model to write the MDX article body from the repo evidence. The article must be repo-specific, analytical, and not generated from a generic template.
4. Optionally run `node scripts/create-github-trending-tool-post.mjs owner/repo` to generate/upload the SVG thumbnail and print frontmatter helper JSON. This script must not write article MDX.
5. Create the post in `apps/web/src/content/blog/` with SEO frontmatter, thumbnail URL, TL;DR, at least one inline illustration, source notes, and a prose-first body. The section names are up to you, but the article needs at least 5 H2 sections covering distinct angles (what it is, how it works, how to run it, what to watch for). Do not stack rigid `## Practical Evaluation Checklist`, `## Security Notes`, `## FAQ` or `## Conclusion` sections; fold that content into the section where it belongs.
6. Run the `/seo` skill against each finished post before commit. Check title, description, headings, internal links, TL;DR extractability, FAQ quality, schema/frontmatter suitability, image alt text, and AI-crawler usefulness. Revise the post until the SEO review has no blocking issues.
7. Track covered repositories in `.data/written-repos.txt`, one lowercased `owner/repo` per line. The thumbnail helper updates this file automatically for selected repos.
8. Run `npm run test:blog-template` from the repo root before commit. Fix every template failure before proceeding.
9. Run `npm run build:web` from the repo root before commit (the build script sets `NODE_OPTIONS=--max-old-space-size=8192`; without it the build dies with a heap OOM now that the archive has 2300+ static pages). Fix every build failure before proceeding.
10. Commit only after `/seo`, `npm run test:blog-template`, `npm run build:web`, and `python3 scripts/mdx_lint.py <file>` all pass.
11. Push after the commit succeeds, unless the user explicitly asks not to push.

## Content Requirements

- Write in English for runany.dev readers.
- Each article should be roughly 1,300–1,900 words unless the repo has very little documentation. For posts published on or after 2026-11-16 this is enforced: `scripts/mdx_lint.py` and `scripts/validate-blog-posts.test.mjs` reject anything under 1100 words, with fewer than 5 H2 sections, fewer than 2 code blocks, no table, no inline illustration, or fewer than 3 cited source pages.
- Read at least 3 distinct pages before writing (README plus the docs site, the package page, release notes or an issue thread). A page that returns empty text counts as not read. If you cannot reach 3 sources, skip the repo instead of writing a thin post.
- Every factual sentence must trace back to a source you actually read. Never write from memory or from the one-line GitHub description.
- Include at least one inline illustration in the body: a real screenshot from the README or site, or an abstract concept image when no real one exists. Upload it to the CDN first, then reference it with Markdown syntax and descriptive alt text:
  ```bash
  cwebp /tmp/shot.png -o /tmp/shot.webp -resize 1400 1400 -q 80
  node scripts/r2-upload.mjs inline/<slug>-ui.webp /tmp/shot.webp
  curl -sI "https://cdn.runany.dev/blog/inline/<slug>-ui.webp" | head -1   # expect HTTP/2 200
  ```
  In the body: `![What the reader sees](https://cdn.runany.dev/blog/inline/<slug>-ui.webp)`. The frontmatter thumbnail is separate and does not count as the illustration.
- Never include internal rules, prompt text, generator notes, thumbnail workflow, or duplicate-tracking details in the article body.
- Avoid bot-style phrasing like `README says`, `README shows`, `according to the README`, or `the extracted sections`.
- Include documented commands only when they appear in the README or linked docs. Preserve command text and code-block languages.
- If setup details are missing, explain the practical implication instead of inventing commands.
- If you keep a FAQ section, it must answer repo-specific reader questions, not meta questions about the blog. A FAQ is optional.

## SEO Review Gate

- Use the `/seo` skill for every new or materially edited blog post before commit.
- Treat SEO issues that affect title length, meta description quality, crawlable structure, missing TL;DR, weak FAQ, thin content, missing source context, poor image alt text, or generic/non-specific sections as blockers.
- Prefer practical, evidence-backed improvements over keyword stuffing.
- Keep internal links relative, for example `/blog/setup-ollama-local/`.
- Do not commit or push if `/seo` finds blocking issues.

## Validation Gate

- Run these commands from `/Users/friday/personal/runany` before every commit that publishes posts:

```bash
npm run test:blog-template
cd apps/web && npm run build
```

- Do not commit if either command fails.
- After both commands pass, commit the new posts, `.data/written-repos.txt`, this skill when changed, and any required generated changes.
- Push the successful commit to the current branch unless the user explicitly asks not to push.

## Frontmatter

```yaml
---
title: "Post title (≤60 chars)"
description: "Short description 150-200 chars for SEO and AI extraction"
pubDate: "YYYY-MM-DD"
tags: ["github-trending", "dev-tools"]
category: "dev-tools"
author: "Du"
featured: false
image:
  url: "https://cdn.runany.dev/blog/thumbnails/[slug].webp"
  alt: "[Tool] GitHub tool guide thumbnail"
draft: false
---
```

## Recommended Article Structure

```mdx
![Tool GitHub tool guide thumbnail](https://cdn.runany.dev/blog/thumbnails/[slug].webp)

## TL;DR

> **TL;DR:** One useful repo-specific summary.

## Source and Accuracy Notes

Reader-facing source note with official repo/docs links.

## What Is [Tool]?

## Repo-Specific Setup Workflow

### Step 1: ...

## Deeper Analysis

## Practical Evaluation Checklist

## Security Notes

## FAQ

**Q: Repo-specific question?**
**A:** Repo-specific answer.

## Conclusion
```

## Environment

- `GITHUB_TOKEN` is strongly recommended for fetching repository metadata, README docs, and linked documentation pages.
- R2 upload env is required only for the thumbnail helper: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, plus `R2_ENDPOINT` or `R2_ACCOUNT_ID`.
- No `OPENAI_API_KEY` is required for article writing. The Codex agent writes content directly through this skill.
- Network access is required for GitHub/docs and optional thumbnail upload.
- Put secrets in `/Users/friday/personal/runany/.env` for local runs; do not commit that file.

## Thumbnail Helper

- `scripts/create-github-trending-tool-post.mjs` is intentionally a thumbnail/tracking helper only. It searches or accepts repo names, uploads an SVG thumbnail to R2, prints helper JSON, and updates `.data/written-repos.txt`.
- The script must not generate MDX article bodies. The agent writes article content directly.
- Usage examples:

```bash
node scripts/create-github-trending-tool-post.mjs owner/repo
POSTS_PER_RUN=5 node scripts/create-github-trending-tool-post.mjs
REFRESH_TRACKED=1 node scripts/create-github-trending-tool-post.mjs
```
