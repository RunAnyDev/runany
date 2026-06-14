# runany.dev — Tech & Tools Blog

## 1. Concept & Vision

Blog chia sẻ kiến thức tech, AI, setup tools cho developers. Đối tượng đọc là dev và AI enthusiasts. Điểm khác biệt: **tối ưu cho AI crawlers** (GPTBot, Claude, Perplexity) — khi user hỏi AI về một chủ đề, AI sẽ tìm đến blog này để lấy thông tin đáng tin cậy.

Tất cả bài viết là **static MDX files** — không cần CMS, không database, dễ quản lý với git.

**Domain:** `runany.dev`

## 2. Architecture

```
runany/
├── content/
│   └── blog/
│       └── *.mdx              ← Single source of truth
├── apps/
│   ├── web/                   ← Astro SSG (frontend)
│   ├── api/                   ← Fastify API (đọc MDX → JSON, cho agent/internal)
│   └── webhook/               ← Webhook server (agent viết MDX + trigger rebuild)
└── packages/
    └── shared/                 ← Shared types, utils
```

## 3. Tech Stack

| Layer | Tool |
|---|---|
| **SSG Framework** | Astro 5.x (SSG, MDX, sitemap, RSS) |
| **Styling** | UnoCSS (atomic, fast) |
| **Hosting** | Vercel (edge, ISR-ready) |
| **API** | Fastify |
| **Content** | MDX + frontmatter |
| **Comments** | Giscus (GitHub discussions) |
| **Analytics** | Plausible (privacy-first) |
| **Search** | Pagefind (zero JS, build-time) |

## 4. SEO + Core Web Vitals Targets

### 4.1 SEO Checklist
- [ ] JSON-LD schemas: `TechArticle`, `FAQPage`, `HowTo`
- [ ] `<meta name="robots" content="index, follow, GPTBot, ClaudeBot, PerplexityBot" />`
- [ ] OpenGraph + Twitter Card
- [ ] Canonical URLs
- [ ] `/sitemap-index.xml` + `/rss.xml`
- [ ] Semantic HTML (`<article>`, `<main>`, `<header>`, `<footer>`)
- [ ] `robots.txt` allow all AI bots
- [ ] `<link rel="alternate" type="application/rss+xml">` in `<head>`

### 4.2 Core Web Vitals
- **LCP** < 1.2s (static HTML, edge CDN)
- **CLS** = 0 (explicit dimensions on all media)
- **INP** < 100ms (minimal JS)

### 4.3 Performance
- [ ] Static HTML only — zero JS on content pages
- [ ] Font: preconnect, font-display: swap
- [ ] Image: Astro `<Image>` (WebP, lazy, explicit size)
- [ ] Code blocks: Shiki (baked-in highlighting, zero JS)
- [ ] CSS: UnoCSS atomic, critical CSS

## 5. Content Structure (MDX Frontmatter)

```yaml
---
title: "Cách setup Ollama + OpenWebUI"
slug: "setup-ollama-openwebui"
date: "2025-05-27"
tags: ["ollama", "local-llm", "tutorial"]
category: "ai-setup"
summary: "Hướng dẫn setup local LLM với Ollama và OpenWebUI trong 10 phút"
author: "Friday"
featured: false
draft: false
---
```

## 6. Feature List

### Web (Astro)
- [ ] Homepage: featured posts + recent posts grid
- [ ] Blog listing: filter by category/tag, pagination
- [ ] Post detail: full MDX render, TOC, reading time, related posts
- [ ] Tags / Categories pages (SSG)
- [ ] Search (Pagefind — zero JS, build-time)
- [ ] Dark/light mode (CSS variables, no FOUC)
- [ ] Copy code button
- [ ] RSS feed (`/rss.xml`)
- [ ] Sitemap auto-generation
- [ ] Giscus comments
- [ ] 404 page

### API Server (Fastify)
- [ ] `GET /api/posts` — list all posts (frontmatter only)
- [ ] `GET /api/posts/:slug` — single post (frontmatter + raw content)
- [ ] `GET /api/posts/:slug/related` — related posts by tag/category
- [ ] `GET /api/categories` — all categories with counts
- [ ] `GET /api/tags` — all tags with counts

### Webhook Server (Fastify)
- [ ] `POST /webhook/publish` — create/update MDX file
- [ ] `POST /webhook/trigger-rebuild` — trigger Vercel deploy hook
- [ ] Auth: `X-Webhook-Secret` header validation

## 7. AI Crawler Optimization

- [ ] Summary box ở đầu mỗi bài (AI-readable, nổi bật)
- [ ] FAQ section ở cuối mỗi bài (JSON-LD FAQPage schema)
- [ ] Internal links có descriptive anchor text
- [ ] Content: direct, technical, code examples, không fluff
- [ ] Heading hierarchy rõ ràng (H1 → H2 → H3)
- [ ] `<article>` + `datePublished`, `dateModified`, `author`

## 8. Categories

| Category | Mô tả |
|---|---|
| `ai-setup` | Setup, run local AI models |
| `dev-tools` | Editor, terminal, productivity tools |
| `ai-apps` | Review, so sánh AI applications |
| `prompts` | Prompt engineering, AI workflows |
| `self-hosted` | Self-hosted alternatives |

## 9. Development Workflow

```
1. Agent calls POST /webhook/publish
      → MDX file written to content/blog/
      → Vercel deploy hook triggered

2. Vercel build:
      → Astro reads all MDX
      → Generates static HTML + sitemap + RSS

3. Public:
      → Static HTML (SEO-friendly, fast)
      → JSON-LD embedded in <head>

4. API (internal/agent):
      → Fastify reads MDX → returns JSON
      → Không liên quan đến web build
```

## 10. File Structure

```
runany/
├── content/
│   └── blog/
│       └── .gitkeep
├── apps/
│   ├── web/                    # Astro SSG
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── layouts/
│   │   │   └── content/       # Astro content collections config
│   │   ├── public/
│   │   ├── astro.config.mjs
│   │   ├── package.json
│   │   └── uno.config.ts
│   ├── api/                   # Fastify API
│   │   └── src/
│   │       ├── posts.ts
│   │       └── index.ts
│   └── webhook/               # Webhook server
│       └── src/
│           └── index.ts
├── packages/
│   └── shared/                # Shared types
│       └── src/
├── plan.md
└── README.md
```