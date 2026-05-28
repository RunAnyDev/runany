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

### 2. Filename Convention (SORTING)

Filename format: `YYYY-MM-DD-HHMMSS-[slug].mdx`

The filename starts with a full timestamp (YYYY-MM-DD-HHMMSS) for automatic chronological sorting. HHMMSS = 6-digit time (hour-minute-second). The slug portion after the timestamp becomes the actual blog URL slug.

```
2026-05-28-190915-frigade-product-onboarding.mdx  →  URL: /blog/frigade-product-onboarding/
2026-05-28-191500-sentrial-observability.mdx       →  URL: /blog/sentrial-observability/
```

**Rules:**
- ✅ Timestamp must include HHMMSS (6 digits, e.g., `160656`, `190915`)
- ✅ Slug: lowercase, hyphens only, no spaces
- ❌ DO NOT use `YYYY-MM-DD-[slug].mdx` without HHMMSS — posts without time component sort incorrectly
- ❌ DO NOT use spaces in filenames

**Sorting logic:** `b.id.localeCompare(a.id)` → descending by filename (newest first). The regex `^\d{4}-\d{2}-\d{2}-\d{6}-` strips the full timestamp prefix.

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

### 5. Thumbnail & CDN (REQUIRED)

**ALWAYS upload thumbnail to R2 BEFORE committing a post.**

Thumbnail path: `apps/web/public/blog/thumbnails/[slug].webp`
R2 CDN URL: `https://cdn.runany.dev/blog/thumbnails/[slug].webp`

**Workflow:**
1. Generate thumbnail via MiniMax: `scripts/generate-github-tool-thumbnail.mjs` or custom prompt
2. Upload to R2 using script's R2 API (S3-compatible PUT with AWS Signature v4)
3. Verify HTTP 200 before committing
4. Reference in frontmatter: `image: { url: "https://cdn.runany.dev/blog/thumbnails/[slug].webp", alt: "..." }`

**R2 upload script** (from `scripts/generate-github-tool-thumbnail.mjs`):
```javascript
// Uses env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ACCOUNT_ID
// Endpoint: https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{R2_BUCKET}/{key}
// Uses AWS Signature v4 for authentication
```

**Validation:**
- ✅ All 21 existing thumbnails verified on R2 (HTTP 200)
- ❌ DO NOT commit if CDN returns 404 — thumbnail must be uploaded first

### 6. Content Rules

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

- [ ] Filename: `YYYY-MM-DD-HHMMSS-[slug].mdx` (HHMMSS required, 6 digits)
- [ ] Thumbnail uploaded to R2 CDN → verify HTTP 200 before commit
- [ ] `title` ≤ 60 chars, contains main keywords
- [ ] `description` ≤ 200 chars, compelling to click
- [ ] `tags` lowercase, hyphenated (no spaces)
- [ ] `category` is one of the valid options
- [ ] Has a TL;DR block `>`
- [ ] Code blocks have language identifiers
- [ ] Headings hierarchy is clear (H2 > H3)
- [ ] File placed correctly: `apps/web/src/content/blog/YYYY-MM-DD-HHMMSS-[slug].mdx`
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
