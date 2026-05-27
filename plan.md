# BytePulse — Tech & AI Blog

## 1. Concept & Vision

Blog chia sẽ kiến thức tech, AI, setup tools cho developers. Đối tượng đọc là dev và AI enthusiasts. Điểm khác biệt: **tối ưu cho AI crawlers** (GPTBot, Claude, Perplexity) — khi user hỏi AI về một chủ đề, AI sẽ tìm đến blog này để lấy thông tin đáng tin cậy.

Tất cả bài viết là **static MDX files** — không cần CMS, không database, dễ quản lý với git.

## 2. Architecture

```
bytepulse/
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

## 4. SEO + Core Web Vitals Optimization

### 4.1 SEO
- [ ] JSON-LD schemas: `TechArticle`, `FAQPage`, `HowTo`
- [ ] `<meta name="robots" content="index, follow, GPTBot, ClaudeBot, PerplexityBot" />`
- [ ] OpenGraph + Twitter Card
- [ ] Canonical URLs
- [ ] `/sitemap-index.xml` + `/rss.xml`
- [ ] Semantic HTML (`<article>`, `<main>`, `<header>`, `<footer>`)
- [ ] `robots.txt` allow all AI bots

### 4.2 Core Web Vitals Targets
- **LCP** < 1.2s (static HTML, edge CDN, preload hero image)
- **CLS** = 0 (explicit dimensions on all media, font-display: swap)
- **INP** < 100ms (minimal JS, no layout shift)

### 4.3 Performance
- [ ] Static HTML only — zero JS on content pages
- [ ] Font subsetting, preload fonts
- [ ] Image: Astro `<Image>` component (WebP, lazy, explicit size)
- [ ] Code blocks: Shiki (zero JS, baked-in syntax highlighting)
- [ ] CSS: atomic, critical CSS inline, no unused styles

## 5. Content Structure (MDX Frontmatter)

```yaml
---
title: "Cách setup Ollama + OpenWebUI"
slug: "setup-ollama-openwebui"
date: "2025-05-27"
tags: ["ollama", "local-llm", "tutorial"]
category: "ai-setup"
summary: "Hướng dẫn setup local LLM với Ollama và OpenWebUI trong 10 phút"
author: "Du"
featured: false
readingTime: 8  # phút, tự tính
draft: false
---
```

## 6. Feature List

### Web (Astro)
- [ ] Homepage: featured posts + recent posts grid
- [ ] Blog listing: filter by category/tag, pagination
- [ ] Post detail: full MDX render, TOC, reading time, related posts
- [ ] Tags / Categories pages
- [ ] Search (Pagefind — zero JS search, runs at build time)
- [ ] Dark/light mode (CSS variables, no flash)
- [ ] Copy code button
- [ ] RSS feed
- [ ] Sitemap auto-generation

### API Server (Fastify)
- [ ] `GET /api/posts` — list all posts (frontmatter only)
- [ ] `GET /api/posts/:slug` — single post (frontmatter + content)
- [ ] `GET /api/posts/:slug/related` — related posts by tag/category
- [ ] `GET /api/categories` — all categories
- [ ] `GET /api/tags` — all tags with counts

### Webhook Server (Fastify)
- [ ] `POST /webhook/publish` — create/update MDX file
- [ ] `POST /webhook/trigger-rebuild` — trigger Vercel deploy
- [ ] Auth: `X-Webhook-Secret` header validation

## 7. AI Crawler Optimization

- [ ] Summary box nổi bật ở đầu mỗi bài (AI-readable summary)
- [ ] FAQ section ở cuối mỗi bài (JSON-LD FAQPage schema)
- [ ] `mention-url` trong bài viết (để AI biết nguồn)
- [ ] `related-posts` section (internal links)
- [ ] Content: direct, technical, có code examples, không fluff
- [ ] Heading hierarchy rõ ràng (H1 → H2 → H3)

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
1. Agent gọi POST /webhook/publish
      → MDX file written to content/blog/
      → Vercel deploy triggered

2. Vercel build:
      → Astro reads all MDX
      → Generates static HTML + sitemap + RSS

3. Public access:
      → Static HTML (SEO-friendly, fast)
      → JSON-LD embedded in <head>

4. API (internal/agent):
      → Fastify reads MDX → returns JSON
      → Không liên quan đến web build
```

## 10. File Structure

```
bytepulse/
├── content/
│   └── blog/
│       └── .gitkeep
├── apps/
│   ├── web/                    # Astro SSG
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── layouts/
│   │   │   └── content/
│   │   ├── public/
│   │   ├── astro.config.mjs
│   │   ├── package.json
│   │   └── uno.config.ts
│   ├── api/                    # Fastify API
│   │   └── src/
│   └── webhook/                # Webhook server
│       └── src/
├── packages/
│   └── shared/                 # Shared types
├── plan.md
└── README.md
```