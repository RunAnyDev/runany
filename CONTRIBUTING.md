# Contributing to RunAny

Thanks for helping improve RunAny. This repo powers [runany.dev](https://runany.dev), an English tech blog about AI setup, developer tools, and practical guides.

## Project structure

```text
apps/web       Astro static website and blog
apps/api       Fastify API service
apps/webhook   Fastify webhook service
packages/shared Shared TypeScript package
```

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Git

## Local setup

```bash
git clone https://github.com/meesudzu/runany.git
cd runany
npm install
npm run dev
```

Run only the web app:

```bash
npm run dev -w web
```

## Checks before opening a PR

Run the checks that match your change:

```bash
npm run type-check
npm run lint
npm run build
npm test
```

For web-only changes:

```bash
npm run build:web
```

## Blog contribution rules

Blog posts live in `apps/web/src/content/blog/`.

Use filename format:

```text
YYYY-MM-DD-HHMMSS-slug-name.mdx
```

Example:

```text
2026-05-29-153000-setup-ollama-openwebui.mdx
```

Required frontmatter:

```yaml
---
title: "Post title"
description: "Short SEO description under 200 characters."
pubDate: "2026-05-29"
tags: ["ai", "ollama", "self-hosted"]
category: "ai-setup"
author: "Du"
featured: false
draft: false
---
```

Allowed categories:

- `ai-setup`
- `tutorial`
- `dev-tools`
- `self-hosted`
- `review`
- `news`

Content requirements:

- Add `## TL;DR` near the top.
- Use H2 for main sections and H3 for sub-steps.
- Add language identifiers to all code blocks, such as `bash`, `json`, `yaml`, or `typescript`.
- Use relative links for internal links, such as `/blog/example-post/`.
- Add FAQ when common questions exist.

Thumbnail requirement for maintainers:

- Upload thumbnail to R2 before publishing.
- Use CDN URL format `https://cdn.runany.dev/blog/thumbnails/[slug].webp`.
- Prefer source image extraction first; use local SVG → optimized WebP fallback when needed.
- Verify CDN returns HTTP 200 before merging.

External contributors can submit content without R2 credentials; maintainers will upload thumbnails before publish.

## Pull request guidelines

- Keep PRs focused and small.
- Link related issues when possible.
- Include screenshots for UI or content layout changes.
- Explain validation commands run in the PR description.
- Do not include secrets, tokens, private keys, or personal data.

## Commit style

Use short conventional commit-style messages:

```text
feat: add ollama setup guide
fix: correct blog tag rendering
docs: improve contributor guide
chore: update dependencies
```

## Reporting security issues

Please do not open public issues for suspected security vulnerabilities. Email the maintainer or use GitHub private vulnerability reporting if enabled.
