# Agents Guide for runany.dev

## Overview

runany.dev is an English tech blog sharing knowledge about AI, developer tools, and setup guides. Optimized for AI crawlers (GPT, Claude, Perplexity).

**Important rule:** Agents can commit new posts directly to the repo WITHOUT needing a webhook.

## Security

**❌ NEVER hardcode credentials, API keys, access keys, or secrets in any file.**
Always read from `~/.env` or environment variables. This includes:
- R2 `accessKeyId` / `secretAccessKey`
- `GITHUB_TOKEN`
- Any other API keys or secrets

---

## Content Accuracy & Source Verification (MANDATORY)

> **Rule:** NEVER guess, assume, or fabricate information about a tool, repo, app, CLI, API, or framework. Every factual claim in a post must be traceable to a primary source the agent has actually read. Hallucinated version numbers, invented CLI flags, made-up features, or paraphrased-from-memory commands mislead readers and damage runany.dev's credibility. If you cannot verify a claim, **omit it** or **ask the user** — do not write it.

### 1. Required source order (highest to lowest)

1. **The repo's own `README.md`, `docs/`, or `llms.txt`** — read end-to-end before writing.
2. **GitHub REST API** for metadata: `GET https://api.github.com/repos/{owner}/{repo}` returns `description`, `stargazers_count`, `license.spdx_id`, `default_branch`, `pushed_at`, `topics`. Use `GITHUB_TOKEN` from `~/.env` to avoid rate limits.
3. **Latest release** via `GET /repos/{owner}/{repo}/releases/latest` or `git ls-remote --tags https://github.com/{owner}/{repo}.git` for the current version.
4. **Source code** (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `wrangler.toml`, `Dockerfile`, `Makefile`, `helm/`) when in doubt about deps, install steps, or runtime versions.
5. **Official site / docs** (`*.dev`, `docs.*`, official blog) as the canonical source for product claims.
6. **Trusted secondary sources** (project blog, official announcements) only as a fallback — never as the only citation.

### 2. Hard "NEVER" rules

- ❌ **NEVER** invent a version number, star count, license, dependency, env var, default port, CLI flag, config key, API endpoint, or pricing tier. If the README does not say it, do not write it.
- ❌ **NEVER** paraphrase install steps, code snippets, or config blocks from memory. Copy them verbatim from the project's docs and only add a short explanation in your own words.
- ❌ **NEVER** mix up similar tools (e.g., confusing `wrangler` with `miniflare`, `n8n` with `Node-RED`, `Open WebUI` with `LibreChat`). Verify the exact repo path, package name, and domain before writing the first sentence.
- ❌ **NEVER** swap package managers. If the project uses `pnpm`, do not write `npm install`; if it uses `uv`, do not write `pip install`; if it uses `cargo`, do not write `go build`. Match the project's actual toolchain (`package.json` `packageManager`, `pnpm-lock.yaml`, `Cargo.lock`, etc.).
- ❌ **NEVER** claim a feature exists ("supports streaming", "ships with auth", "includes rate limiting") unless the README, docs, or source code confirms it. "Sounds plausible" is not verification.
- ❌ **NEVER** reuse commands from a different post without re-verifying them against the current version of the project. APIs and flags change between releases.

### 3. Hard "ALWAYS" rules

- ✅ **ALWAYS** open the actual `README.md` and skim `docs/` before drafting the article. Use the GitHub API (`curl https://api.github.com/repos/...`) — do not rely on a search result snippet.
- ✅ **ALWAYS** cross-check the version mentioned in the article against the latest release tag or `main` branch commit. If the version cannot be verified, write "current main branch" or omit the version.
- ✅ **ALWAYS** quote commands, code blocks, config snippets, and `.env` keys **character-for-character** from the source. If you reformat for readability, link to the original.
- ✅ **ALWAYS** add a "Source and Accuracy Notes" section (reader-facing) with:
  - Project page / official site URL
  - Source repository URL
  - License (verified, not assumed)
  - HN launch thread or official announcement (if applicable)
  - Date the source was last checked
- ✅ **ALWAYS** prefer the project's own description over your paraphrase. Quote it in a blockquote with attribution.

### 4. When the information is missing or unclear

1. Read the relevant docs file end-to-end.
2. Check the repo's `Issues`, `Discussions`, and `Releases` for clarifications.
3. If still unclear, **omit the claim**. Do not guess.
4. If the gap is critical, ask the user. State exactly what is missing and why it matters.

### 5. Pre-commit verification (mandatory before `git commit`)

- [ ] Repo metadata (`description`, `stars`, `license`, `default_branch`, `pushed_at`) fetched from the GitHub API and matches the article.
- [ ] Latest version / release tag verified against the Releases page or `git ls-remote --tags`.
- [ ] Every install command, CLI flag, env var, port, and config key in the article was copy-pasted from the project's own docs.
- [ ] Package manager in install commands matches the project's actual lockfile / `packageManager` field.
- [ ] No "the project supports X" claim without a citation in the body or "Source and Accuracy Notes".
- [ ] "Source and Accuracy Notes" section is present with at least the repo URL and the official site URL.
- [ ] If anything on this checklist fails, **do not commit**. Fix the article or ask the user.

### 6. Example "Source and Accuracy Notes" block

```markdown
## Source and Accuracy Notes

- Project page: [anarlog.so](https://anarlog.so)
- Source repository: [github.com/fastrepl/anarlog](https://github.com/fastrepl/anarlog)
- License: MIT (verified via GitHub API `license.spdx_id`)
- HN launch thread: [news.ycombinator.com/item?id=44725306](https://news.ycombinator.com/item?id=44725306)
- Source last checked: 2026-06-15 (commit `a1b2c3d`)
```

---
## Creating a New Blog Post

---

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
author: "Friday"
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

#### Priority Order — Try Source First, Generate SVG as Fallback

**Rule:** Always try source extraction FIRST. Only generate local SVG if no usable image found.

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

**Priority 2: Generate local SVG (fallback only)**

Only when source extraction fails or yields unusable images.

*GitHub tools — use helper script:*
```bash
cd ~/personal/runany
node scripts/generate-github-tool-thumbnail.mjs owner/repo
```

*Direct SVG → WebP flow:*
```bash
cat > /tmp/thumb.svg <<'EOF'
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#020617"/>
  <rect x="64" y="60" width="1072" height="510" rx="36" fill="#0f172a" stroke="#334155"/>
  <text x="88" y="210" fill="#f8fafc" font-size="60" font-family="Inter, Arial, sans-serif" font-weight="800">Tool Name</text>
  <text x="88" y="266" fill="#67e8f9" font-size="24" font-family="Inter, Arial, sans-serif">Short category or repo name</text>
  <text x="88" y="322" fill="#cbd5e1" font-size="24" font-family="Inter, Arial, sans-serif">One-line product description for thumbnail</text>
</svg>
EOF

node --input-type=module <<'EOF'
import sharp from 'sharp';
await sharp('/tmp/thumb.svg').resize(1200, 630, { fit: 'cover' }).webp({ quality: 85 }).toFile('/tmp/thumb.webp');
EOF
# Upload to R2 — MUST use Node.js AWS Signature v4 script
# ⚠️ wrangler r2 object put --remote SILENTLY FAILS
```

**Environment variables** (`~/personal/runany/.env`):
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID`
- `GITHUB_TOKEN`

**MDX frontmatter:** thumbnail URL goes in `image.url` field. Body should NOT contain `![]()` markdown image tags — PostLayout renders from frontmatter only.

**MDX curly braces pitfall:** MDX parses `{...}` as JSX expressions even inside table cells and inline text. Never use literal `{var}` placeholders in body content — Astro build fails with `ReferenceError: var is not defined`. Use square brackets `[var]`, wrap in a code span `` `{var}` ``, or escape as `&#123;var&#125;`. Code blocks (```fenced```) are safe because MDX doesn't parse expressions inside fences.

**R2 upload via Node.js (wrangler --remote is broken for R2):**
Use `scripts/r2-upload.mjs` (reads credentials from `.env`, no hardcoded keys):
```bash
node scripts/r2-upload.mjs [slug] [filepath]
```
The `wrangler r2 object put --remote` command silently fails — returns "Upload complete" but file goes to local mock storage, NOT R2.

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
author: "Friday"
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

# 4. Push (triggers Cloudflare Pages auto-deploy)
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

Configured at the Cloudflare Pages level: attach the custom domain `runany.dev` to the `runany` Pages project. The `runany.pages.dev` host is kept as the default fallback, and the custom domain serves all traffic permanently.

If you need to force `runany.pages.dev` → `runany.dev` (e.g. for canonical links), add a `functions/_middleware.ts` redirect, or configure Bulk Redirects in the Cloudflare dashboard (Rules → Redirect Rules). Example Bulk Redirect rule:

- **Expression:** `http.host eq "runany.pages.dev"`
- **Action:** Static redirect to `https://runany.dev${uri}` with status `301`.

All paths redirect permanently (301) to the main domain.

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
author: "Friday"
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
