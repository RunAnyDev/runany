# Agents Guide for runany.dev

## Overview

runany.dev is an English tech blog sharing knowledge about AI, developer tools, and setup guides. Optimized for AI crawlers (GPT, Claude, Perplexity).

**Important rule:** Agents can commit new posts directly to the repo WITHOUT needing a webhook.

---

## Creating a New Blog Post

### 1. File Location

```
~/personal/runany/apps/web/src/content/blog/[slug].mdx
```

### 2. Naming Convention

- **Slug**: lowercase, hyphenated, descriptive
- Examples: `setup-ollama-local.mdx`, `cursor-vs-copilot.mdx`
- Do NOT use numbers in the slug (`post-1`, `post-2`)

### 3. Frontmatter (REQUIRED)

```yaml
---
title: "Post title (≤60 chars)"
description: "Short description 150-200 chars for SEO and AI extraction"
pubDate: "2025-05-27"
tags: ["tag1", "tag2", "tag3"]
category: "ai-setup"
author: "Du"
featured: false
draft: false
---
```

**Category options:**

| Category | Use for |
|---|---|
| `ai-setup` | Setup AI tools, LLM, local inference |
| `tutorial` | How-to guides, step-by-step |
| `dev-tools` | Developer tools, editors, CLIs |
| `self-hosted` | Self-hosted services, VPS |
| `review` | Product/app reviews |
| `news` | Industry news, updates |

### 4. Post Structure (AI-Friendly Format)

```
## TL;DR

> **TL;DR:** A one-sentence summary of the content.

## Why [topic]?

- Brief context
- Problem being solved

## Prerequisites

- List requirements
- Version numbers

## Step 1: [Task name]

Code blocks with language identifier:

```bash
# Example command
echo "hello"
```

## Step 2: [Another task]

## FAQ

**Q: Common question?**
**A:** Brief answer.

## Conclusion

Summary + next steps
```

### 5. Content Rules

- **Code blocks**: ALWAYS include a language identifier (`bash`, `python`, `javascript`, `json`, `yaml`)
- **Headings**: H2 for main sections, H3 for sub-steps
- **Links**: Use relative paths for internal links (`/blog/other-post/`)
- **Images**: Local in `public/` or external URLs
- **TL;DR**: Add block quote `>` for summary (AI summary box will extract)
- **FAQ**: Add Q&A format at the end if there are common questions

---

## Commit Workflow

```bash
cd ~/personal/runany

# 1. Create file
cat > apps/web/src/content/blog/[slug].mdx << 'EOF'
---
title: "..."
description: "..."
pubDate: "2025-05-27"
tags: ["tag1"]
category: "tutorial"
author: "Du"
draft: false
---

> **TL;DR:** ...

## Content here
EOF

# 2. Verify syntax (optional - run build check)
cd apps/web && npm run build 2>&1 | tail -5

# 3. Commit
cd ~/personal/runany
git add apps/web/src/content/blog/[slug].mdx
git commit -m "feat: add [slug] - [title]"

# 4. Push (triggers Vercel auto-deploy)
git push
```

---

## Validation Checklist

Before committing, ensure:

- [ ] `title` ≤ 60 chars, contains main keywords
- [ ] `description` ≤ 200 chars, compelling to click
- [ ] `tags` lowercase, hyphenated (no spaces)
- [ ] `category` is one of the valid options
- [ ] Has a TL;DR block `>`
- [ ] Code blocks have language identifiers
- [ ] Headings hierarchy is clear (H2 > H3)
- [ ] File placed correctly: `apps/web/src/content/blog/[slug].mdx`
- [ ] `draft: false` (to publish)

---

## Build & Preview

### Preview locally (dev mode)

```bash
cd ~/personal/runany/apps/web
npx astro dev --port 4321
# Open: http://localhost:4321/blog/[slug]/
```

### Production build

```bash
cd ~/personal/runany/apps/web
npm run build
# Output: dist/ folder
```

### Check build errors

```bash
cd ~/personal/runany/apps/web
npm run build 2>&1 | grep -E "error|Error|ERROR"
```

---

## SEO Checklist

- [ ] Title contains main keyword
- [ ] Description is compelling, ≤ 160 chars
- [ ] Tags are appropriate (3-5 tags)
- [ ] Has internal links (related to other posts)
- [ ] Has code blocks with syntax highlighting
- [ ] Has TL;DR summary for AI extraction

---

## File Structure

```
runany/
├── apps/
│   ├── web/                      ← Astro SSG
│   │   └── src/
│   │       ├── content/blog/     ← BLOG POSTS GO HERE
│   │       ├── layouts/          ← Layouts
│   │       ├── components/       ← Components
│   │       └── pages/            ← Routes
│   ├── api/                      ← Fastify API
│   └── webhook/                  ← Webhook server
├── packages/
│   └── shared/                   ← Shared types
└── .blog-post-template.md        ← Template reference
```

---

## Quick Command Reference

```bash
# Create a new post (slug: setup-n8n)
cat > apps/web/src/content/blog/setup-n8n.mdx << 'ENDOFFRONT'
---
title: "How to Set Up N8N on a VPS"
description: "Step-by-step guide to setting up the N8N automation tool on an Ubuntu VPS."
pubDate: "2025-05-27"
tags: ["n8n", "automation", "self-hosted"]
category: "self-hosted"
author: "Du"
draft: false
---

> **TL;DR:** ...

## Content
ENDOFFRONT

# Commit and push
git add apps/web/src/content/blog/setup-n8n.mdx
git commit -m "feat: add setup-n8n - How to Set Up N8N on a VPS"
git push
```
