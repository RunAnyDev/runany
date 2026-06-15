# RunAny

RunAny is a local-first tech blog and developer playground for AI setup guides, developer tools, and practical tutorials. The web app is built with Astro, with small Fastify services for API and webhook experiments.

## What is in this repo?

```text
apps/web        Astro static website and MDX blog
apps/api        Fastify API service
apps/webhook    Fastify webhook service
packages/shared Shared TypeScript utilities and types
```

## Tech stack

- Astro and MDX for the website and blog
- UnoCSS for styling
- Fastify for backend services
- TypeScript across apps and packages
- npm workspaces for monorepo management

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Git

## Getting started

```bash
git clone https://github.com/RunAnyDev/runany.git
cd runany
npm install
npm run dev
```

Run a single workspace:

```bash
npm run dev -w web
npm run dev -w @runany/api
npm run dev -w @runany/webhook
```

## Common commands

```bash
npm run dev          # Start all workspaces in development mode
npm run build        # Build all workspaces
npm run build:web    # Build only the Astro website
npm run type-check   # Run TypeScript checks
npm run lint         # Run ESLint
npm test             # Run tests across workspaces
```

## Blog posts

Blog posts live in:

```text
apps/web/src/content/blog/
```

Use timestamped filenames so posts sort correctly:

```text
YYYY-MM-DD-HHMMSS-post-slug.mdx
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
author: "Friday"
featured: false
draft: false
---
```

Recommended post structure:

```mdx
## TL;DR

> **TL;DR:** One-sentence summary.

## Why this matters

## Prerequisites

## Step 1: Do the first thing

## FAQ

## Conclusion
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or pull request.

Good first contributions include:

- Fixing typos or broken links
- Improving setup guides
- Adding screenshots or clearer examples
- Reporting bugs with reproduction steps
- Suggesting new blog topics

## Security

Please do not report security vulnerabilities through public issues. See [SECURITY.md](./SECURITY.md) for reporting guidance.

## License

RunAny is licensed under the [MIT License](./LICENSE).
