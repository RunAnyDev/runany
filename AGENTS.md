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

#### Priority Order — Try Source First, Generate as Fallback

**Rule:** Always try source extraction FIRST. Only generate with MiniMax if no usable image found.

**Priority 1: Extract from source (website or repo)**

Try in this order for ANY tool (GitHub or non-GitHub):

**1a. Product website OG image:**
```python
import urllib.request, re
url = "https://[tool-domain]"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'})
with urllib.request.urlopen(req, timeout=10) as r:
    html = r.read().decode('utf-8', errors='ignore')
og_match = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
if not og_match:
    og_match = re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
og_url = og_match.group(1) if og_match else None
print(og_url)
```

**1b. GitHub repo social preview (for GitHub tools):**
```python
import urllib.request, json
repo_url = f"https://api.github.com/repos/{owner}/{repo}"
req = urllib.request.Request(repo_url, headers={'Accept': 'application/vnd.github.v3+json'})
with urllib.request.urlopen(req, timeout=10) as r:
    data = json.loads(r.read())
img_url = data.get('image', '').get('banner', '') or data.get('social_preview_image_url', '')
print(img_url)
```

**1c. Repo README or asset URL:**
```python
# e.g. https://raw.githubusercontent.com/owner/repo/main/assets/thumbnail.png
# Check README.md for embedded images
```

**1d. allorigins.win proxy (for JS-heavy sites):**
```python
proxy_url = "https://api.allorigins.win/raw?url=" + tool_url
# Then parse og:image from proxy response, same as 1a
```

**If source image found → download, optimize, upload:**
```bash
# Download
curl -L -o /tmp/thumb_src.png "https://source-image-url"
# Convert to WebP (1200x630, quality 85)
cwebp /tmp/thumb_src.png -o /tmp/thumb.webp -resize 1200 630 -q 85
# Upload to R2 — MUST use Node.js AWS Signature v4 script below
# ⚠️ wrangler r2 object put --remote SILENTLY FAILS (file goes to local mock, NOT R2)
```

> Skip Priority 1 if: site returns 403/404/captcha, image is < 300px wide, image is a 1-pixel tracker, or image is a generic stock photo. Fall through to Priority 2.

**Priority 2: Generate with MiniMax (fallback only)**

Only when source extraction fails or yields unusable images.

*GitHub tools — use helper script:*
```bash
cd ~/personal/runany
node scripts/generate-github-tool-thumbnail.mjs owner/repo
```

*Non-GitHub tools — Python direct call:*
```python
import os, urllib.request, json, base64

root = "/Users/friday/personal/runany"
with open(os.path.join(root, ".env")) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"): continue
        if "=" in line:
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if k not in os.environ: os.environ[k] = v

api_key = os.environ["MINIMAX_API_KEY"]

prompt = (
    "Create a 16:9 tech blog hero thumbnail for runany.dev. "
    "Topic: [Tool Name] – [short desc]. "
    "Context: [1-2 sentence product description]. "
    "Repository: [GitHub full_name if applicable]. "
    "Visual cues: [language/tech stack], [star count or key feature]. "
    "Style: futuristic developer workstation, multi-agent AI orchestration, abstract config panels without readable characters, connected nodes, subtle GitHub/tooling references. "
    "Color palette: dark navy (#0a0f1a), cyan (#00d4ff), electric blue (#0066ff), emerald (#00ff88) accents. "
    "Composition: centered browser-like window with glowing blue border, "
    "generative abstract tech patterns, clean editorial banner, strong focal object, high contrast, generous negative space for title overlay. "
    "Strict: NO text, NO letters, NO numbers, NO words, NO logos, NO UI labels, NO code glyphs, NO captions, NO fake font rendering anywhere in the image."
)

payload = json.dumps({
    "model": "image-01",
    "prompt": prompt,
    "response_format": "base64",
    "n": 1,
    "aspect_ratio": "16:9",
    "prompt_optimizer": True
})

req = urllib.request.Request(
    "https://api.minimax.io/v1/image_generation",
    data=payload.encode("utf-8"),
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    method="POST"
)

with urllib.request.urlopen(req, timeout=45) as r:
    data = json.loads(r.read().decode("utf-8"))

b64 = data["data"]["image_base64"][0]
img_data = base64.b64decode(b64)
with open("/tmp/thumb.png", "wb") as f:
    f.write(img_data)
print(f"Generated: {len(img_data)} bytes")
```

*Convert and upload:*
```bash
cwebp /tmp/thumb.png -o /tmp/thumb.webp -resize 1200 630 -q 85
# Upload to R2 — MUST use Node.js AWS Signature v4 script
# ⚠️ wrangler r2 object put --remote SILENTLY FAILS
```

**Environment variables** (`~/personal/runany/.env`):
- `MINIMAX_API_KEY`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID`
- `GITHUB_TOKEN`

**MDX frontmatter:** thumbnail URL goes in `image.url` field. Body should NOT contain `![]()` markdown image tags — PostLayout renders from frontmatter only.

**R2 upload via Node.js (wrangler --remote is broken for R2):**
Use the inline Node.js AWS Signature v4 script from the thumbnail Priority 1 section above. The `wrangler r2 object put --remote` command silently fails — returns "Upload complete" but file goes to local mock storage, NOT R2.

**Validation:**
- ✅ All 21 existing thumbnails verified on R2
- ❌ DO NOT commit if CDN returns 404 — thumbnail must be uploaded and verified in R2
- ⚠️ CDN verification via `curl` / Python `urlopen` returns HTTP 403 (Cloudflare Bot Management) — file IS in R2. Use `wrangler r2 object get --remote` instead.

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

## Redirects

**runany.pages.dev → runany.dev**

Configure in `vercel.json` at project root:

```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "destination": "https://runany.dev/$1",
      "permanent": true
    }
  ]
}
```

All paths redirect permanently (301) to main domain.

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
