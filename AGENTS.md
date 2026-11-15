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
# Convert to WebP (crop to 1200x630 around the most interesting region, aspect preserved)
node scripts/prepare-image.mjs thumbnail /tmp/thumb_src.png /tmp/thumb.webp
# Upload to R2 — canonical path is the wrangler-based helper script
node scripts/r2-upload.mjs <slug> /tmp/thumb.webp
# Verify the CDN serves it (expect HTTP/2 200)
curl -sI "https://cdn.runany.dev/blog/thumbnails/<slug>.webp" | head -1
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
# Upload to R2
node scripts/r2-upload.mjs <slug> /tmp/thumb.webp
```

**Environment variables** (`~/personal/runany/.env`):
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID`
- `GITHUB_TOKEN` — optional. It is not set in `.env` today, and an empty value made the old `Authorization: Bearer ${GITHUB_TOKEN}` call fail with 401 "Bad credentials". The GitHub helper scripts now fall back to `gh auth token`, which returns a fresh token from the GitHub CLI login on every call, so nothing has to be stored in a file:
  ```bash
  GH_TOKEN=$(gh auth token 2>/dev/null || grep '^GITHUB_TOKEN=' .env | cut -d= -f2-)
  curl -sL -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/OWNER/REPO
  ```

**MDX frontmatter:** the thumbnail URL goes in the `image.url` field.

**Inline illustrations in the body ARE ALLOWED and REQUIRED** for posts published on or after 2026-11-16. The old "no `![]()` in body" rule is gone. Requirements:

- At least one inline image per post (two for posts over 1500 words), with descriptive alt text.
- Images must be hosted on `cdn.runany.dev`. Upload with a slash in the slug, which maps to `blog/<slug>.webp`:
  ```bash
  node scripts/prepare-image.mjs illustration /tmp/shot.png /tmp/shot.webp
  node scripts/r2-upload.mjs inline/<post-slug>-ui.webp /tmp/shot.webp
  curl -sI "https://cdn.runany.dev/blog/inline/<post-slug>-ui.webp" | head -1   # expect HTTP/2 200
  ```
- Markdown syntax in the body: `![What the reader sees](https://cdn.runany.dev/blog/inline/<post-slug>-ui.webp)`.
- The frontmatter thumbnail is a separate artifact and does not count as the body illustration.
- **Never distort an image.** `cwebp -resize W H` forces the output to exactly WxH, so a 1544x1060 screenshot became a 1400x1400 square and the text looked stretched. Use `node scripts/prepare-image.mjs illustration <src> <out>` for body illustrations (scales down inside 1400x1400, aspect preserved) and `node scripts/prepare-image.mjs thumbnail <src> <out>` for the OG thumbnail (crops to 1200x630 around the most interesting region, aspect preserved). The script prints the resulting dimensions.

**MDX curly braces pitfall:** MDX parses `{...}` as JSX expressions even inside table cells and inline text. Never use literal `{var}` placeholders in body content — Astro build fails with `ReferenceError: var is not defined`. Use square brackets `[var]`, wrap in a code span `` `{var}` ``, or escape as `&#123;var&#125;`. Code blocks (```fenced```) are safe because MDX doesn't parse expressions inside fences.

**R2 upload:** use `scripts/r2-upload.mjs` (reads `R2_BUCKET` from `.env`, no hardcoded keys):
```bash
node scripts/r2-upload.mjs <slug> <filePath>          # -> blog/thumbnails/<slug>.webp
node scripts/r2-upload.mjs inline/<name>.webp <file>   # -> blog/inline/<name>.webp
```
The script uses `npx wrangler r2 object put` under the hood and verifies the object landed by reading it back. Do not use `@aws-sdk/client-s3` directly: Node.js v26's bundled TLS rejects Cloudflare R2's S3-compatible endpoint with `EPROTO ... sslv3 alert handshake failure` (the older `r2-upload-s3.mjs` in git history is the broken path).

**Validation:**
- ✅ All 21 existing thumbnails verified on R2
- ❌ DO NOT commit if CDN returns 404 — thumbnail must be uploaded and verified in R2
- ✅ CDN verification via `curl -sI` works and returns `HTTP/2 200` for a published object. If it returns 403 or 404, re-check with `npx wrangler r2 object get "runany/<key>" --file /tmp/check.webp --remote` before assuming the object is missing.

### 6. Content Rules

- **Code blocks**: ALWAYS include a language identifier (`bash`, `python`, `javascript`, `json`, `yaml`)
- **Headings**: H2 for main sections, H3 for sub-steps
- **Links**: Use relative paths for internal links (`/blog/other-post/`)
- **Images**: frontmatter thumbnail on `cdn.runany.dev`, plus at least one inline illustration in the body (also on `cdn.runany.dev`, with alt text). See "Inline illustrations" above.
- **TL;DR**: Add block quote `>` for summary (AI summary box will extract)
- **Structure**: prose-first. Do not stack rigid sections like `## Practical Evaluation Checklist`, `## Security Notes`, `## FAQ` or `## Conclusion`; fold that content into the sections where it belongs.

### 7. Sync priority-posts list (when promoting a post)

The "Popular starting points" section appears on **both** the homepage hero (`pages/index.astro`) **and** the 404 fallback (`pages/404.astro`). Both pages read from a single source of truth — `apps/web/src/utils/priority-posts.ts` — so a new slug only needs to be appended once.

When promoting a post (sponsor placement, GSC top performer, hand-pick):

1. Add the post slug to the `prioritySlugs` array in `apps/web/src/utils/priority-posts.ts`. Order rule: sponsor first, then descending GSC 28-day impressions.
2. If sponsored, also set `sponsored: true` in the post frontmatter so the amber highlight + "Sponsored" badge renders on both surfaces.
3. **Never** edit the 404 or homepage inline lists directly — they should stay empty and pull from the shared module. Hardcoded duplicates drift and silently desync.

If a slug in `prioritySlugs` no longer matches a published post, `resolvePriorityPosts()` logs a `console.warn` at build time — fix by removing the stale entry, do not silence the warning.

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

---

## Auto-publish crons (Mavis blog-poster + blog-poster-github-trending)

**Replaces the old Hermes cron job `df16e9ef0195` (Blog Poster 60min), disabled 2026-08-13.** Two distinct skills now run side-by-side:

| Cron | Source | Cadence | Scope | Skill |
|---|---|---|---|---|
| `blog-poster` | HN Algolia | Daily 7:30 AM ICT | 1 post/tick (top HN launch) | `~/.minimax/agents/mavis/skills/blog-publisher/SKILL.md` |
| `blog-poster-github-trending` | github.com/trending (HTML scrape) | Daily 9 AM ICT | 2 NEW trending per tick (`MAX_POSTS_PER_TICK` default 2) | `~/.minimax/agents/mavis/skills/blog-publisher-github-trending/SKILL.md` |

### Publishing cadence — site-wide budget: 2–3 posts/day

**Do not raise the publishing rate without an explicit user instruction.**

The site published ~24 posts/day (HN cron every 2 hours + trending cron capped at 12) until 2026-11-15 — 1858 posts in ~7 months. Google responded by **stopping the crawl**: Search Console showed 2372 sitemap URLs with 0 indexed, and URL Inspection on sampled articles returned *"Discovered – currently not indexed"* or *"URL is unknown to Google"*, i.e. Google knew the URLs but never fetched them. Pages with impressions fell from 243 (June) to 32 (Nov 1–14).

Current budget:

| Cron | Schedule | Posts/day |
|---|---|---|
| `blog-poster` (HN) | `30 7 * * *` — daily 7:30 AM ICT | 1 |
| `blog-poster-github-trending` | `0 9 * * *` — daily 9:00 AM ICT | 2 (cap) |

Both skill files (`~/.minimax/agents/mavis/skills/blog-publisher/SKILL.md` and `.../blog-publisher-github-trending/SKILL.md`) carry the same budget note and are the source of truth for the tick agents. Leftover trending repos are not lost — they stay in `.data/written-repos.txt` and are picked up by the next tick.

### `blog-poster` (HN, daily)
- **Schedule:** `30 7 * * *` (daily at 7:30 AM ICT)
- **Model:** `MiniMax-M2.7` lean — ~360K tokens/tick vs 3.1M for M3 verbose
- **Workdir:** `~/personal/runany`
- **Session mode:** new (each tick = fresh session, no cross-tick state)
- **Skill:** `blog-publisher`
- **Delivery:** Mavis session output → bound Telegram channel (auto-routed, no separate bot needed)

### `blog-poster-github-trending` (GitHub, daily)
- **Schedule:** `0 9 * * *` (9:00 AM ICT daily)
- **Per-tick cap:** `MAX_POSTS_PER_TICK` default **2** (was 12, before that 30) — see "Publishing cadence" above
- **Model:** `MiniMax-M2.7` lean (per-repo loop budget)
- **Workdir:** `~/personal/runany`
- **Session mode:** new
- **Skill:** `blog-publisher-github-trending`
- **Discovery script:** `scripts/gh_trending.py` (parses `github.com/trending` HTML → JSON list of `{full_name, owner, name, url, description, language, stars_total, stars_period, period, lang_filter}`). Default = daily trending, all languages. Flags: `--since weekly|monthly`, `--language <name>`, `--top N`.
- **Thumbnail pipeline:** `scripts/gh_trending_thumbnail.mjs OWNER/REPO /tmp/thumb.webp STARS LANG DESC HOMEPAGE` → `node scripts/r2-upload.mjs SLUG /tmp/thumb.webp` (wrangler-based, NOT S3 SDK). Verify CDN URL returns HTTP/2 200 before commit (R2 negative-cache pitfall — see Memory).
- **Thumbnail source priority (mandatory):** real product image first, matching the Priority Order rule in this file. The script resolves GitHub social preview (`opengraph.githubassets.com/1/{owner}/{repo}`) → site `og:image` (only when `homepage` is passed) → generated SVG template, and prints `source=` in its output. **The SVG card is a last-resort fallback only.** Check `source=` before committing; if it says `svg-template:FALLBACK`, retry once without the homepage arg. Post `alt` text must match the source that won (`GitHub social preview card for OWNER/REPO` vs `<host> project preview image`).
  - Audit a post's thumbnail at any time: `/tmp/thumb-audit.mjs` pattern — a real image is never exactly 1200x630 with the template's three traffic-light dots at pixels (120,106) (140,106) (160,106).
- **Dedup:** owner/repo (lowercased) match in `.data/written-repos.txt` OR any existing post slug contains BOTH owner + repo as slug words. Plus blocklist substring match + unsafe keyword filter (`kms`, `crack`, `activator`, `keygen`, `piracy`, `malware`, `cheat`, `exploit`).
- **Per-repo loop:** GitHub API metadata → thumbnail → R2 upload → CDN verify → MDX write → lint → commit. ~6 calls/repo × ~16 repos/day = ~100 calls/tick.
- **Output:** One commit per post + one final tracking commit for `.data/written-repos.txt` updates. Expect 2-4 commits/day (2 posts + tracking commit), not the ~10-16 of the old uncapped schedule.
- **Token note:** Cron currently runs WITHOUT `GITHUB_TOKEN` (not in `.env`). Uses unauthenticated API (60 req/hr). With ~16 repos/day = ~16 API calls/tick, sustainable for ~3 weeks before hitting limits. Add token to `.env` to lift to 5000 req/hr.

### Discovery → publish flow (lean, ~12-15 tool calls)
1. `python3 scripts/hn_search.py --shortlist --top 4` — 1 call. **Recency matters:** the script defaults to `--max-age-days 45` and hits Algolia's `search_by_date`, so it surfaces fresh launches. The old points-only search returned a fixed set of all-time classics (Quiche, Cardboard, Moltis, Intuned, Kampala, Twill, IonRouter) that the blog has covered, so every tick came back empty. Use `--max-age-days 0` only to reproduce the old behavior. Widen with `--max-age-days 90 --min-points 40` when the shortlist is thin.
2. `python3 scripts/dedup-check.py --batch` against `.data/written-repos.txt` + blog slugs — 1 call
3. Check `.data/blocklist.txt` for substring matches (case-insensitive) — inline
4. Liveness probe: `curl -sI` each `NEW` candidate — 1 batched call
5. `python3 scripts/og_probe.py $DOMAIN` — 1 call per candidate
6. Optional GSC cannibalization check via `mcp__gsc__get_search_analytics` — may fail silently if token expired
7. Write MDX with `write` tool — 1 call
8. `python3 scripts/mdx_lint.py <file>` — 1 call (fix + re-run if any findings)
9. `node scripts/prepare-image.mjs thumbnail` + `node scripts/r2-upload.mjs <slug>` (or `image_synthesize` if no OG) — 1-2 calls
10. `git add` (specific files only) + commit + push — 1 call group
11. Final response: `Published: <title>` + `URL: https://runany.dev/blog/<slug>/`

### Blocklist

**`~/personal/runany/.data/blocklist.txt`** — one keyword per line, substring match against tool name + domain. Currently:
- `quiche` — Quiche Browser, author takedown 2026-06-14. File deleted + pushed (commit 866ade4), but GSC URL removal still requires manual action: search.google.com/search-console/removals?resource_id=sc-domain:runany.dev.

Add new entries to the file (not memory) — `dedup-check.py` and the cron agent read it directly.

### GSC token expiry (known issue)

OAuth token at `~/.minimax/agents/mavis/mcp-gsc/token.json` expired 2026-06-09. If `mcp__gsc__*` calls return 401, the cron agent logs `GSC_AUTH_FAILED` and skips cannibalization (proceeds with `SAFE_TO_WRITE` marked in `.data/cannibalization-decisions.jsonl`). Re-auth by re-running the project's GSC auth script (likely `cd apps/web && npm run gsc:auth` — confirm in project docs).

---

## Google Search Console access (scripts/gsc-client.mjs)

**Do not use `mavis mcp call gsc ...` any more.** The `mavis` CLI symlink
(`~/.minimax/bin/mavis` → `/Applications/MiniMax Code.app/Contents/Resources/resources/daemon/cli.js`)
is broken: the app moved to `app.asar` and that path no longer exists. The
`mcp-gsc` skill still documents the old command and will fail.

Use the repo client instead — it speaks MCP over stdio to the same
`mcp-search-console` server configured in `~/.minimax/mcp/mcp.json`:

```bash
cd ~/personal/runany
node scripts/gsc-client.mjs list_properties '{}'
node scripts/gsc-client.mjs get_sitemaps '{"site_url":"sc-domain:runany.dev"}'
node scripts/gsc-client.mjs get_sitemap_details '{"sitemap_url":"https://runany.dev/sitemap.xml"}'
node scripts/gsc-client.mjs check_indexing_issues '{"urls":"https://a/\nhttps://b/"}'
node scripts/gsc-client.mjs inspect_url_enhanced '{"page_url":"https://runany.dev/blog/pikimov/"}'
```

- `site_url` defaults to `sc-domain:runany.dev` (override with `GSC_SITE_URL`).
- OAuth client secrets come from `GSC_SECRETS_FILE` (default `~/gsc-token.json`); no credential is stored in this repo.
- Long payloads: pass args as a file — `node scripts/gsc-client.mjs check_indexing_issues @/tmp/args.json`.
- Destructive calls (`delete_sitemap`) need `GSC_ALLOW_DESTRUCTIVE=true`.

### Daily indexing monitor (2026-11-15 → 2026-11-29)

A daily cron tracks whether Google actually crawls and indexes the articles,
because the sitemap alone looked healthy while **0 of 2372 URLs were indexed**.

- **Watchlist:** `.data/gsc-watchlist.txt` — 11 fixed article URLs (4 newest, 4 spread Jul–Oct, 2 edge cases, 1 already-indexed control). Fixed, not rotating, so day-over-day states are comparable.
- **Log:** `.data/gsc-index-log.jsonl` (git-ignored) — one JSON line per day.
- **Cron:** Mavis task "gsc-index-monitor", daily 10:30 ICT, agent `mavis`, session `new`.
- **Checks per run:** `get_sitemap_details` (submitted vs indexed) → `check_indexing_issues` on the watchlist → `get_advanced_search_analytics` (page dimension, 28 days) for the impression-bearing article count.
- **Baseline (2026-11-15):** sitemap submitted 2372 / indexed 0; watchlist 0 indexed; 47 blog URLs with impressions in the last 28 days.

### Lean-mode pitfalls (real failures, keep checklist in mind)

- **MDX `{var}`** — Literal `{` outside code fences parses as JSX. Use `[var]`, `` `{var}` ``, or `&#123;var&#125;`. Real failure 2026-06-22 ClickNest post L104:40.
- **MDX `<N` or `<[0-9]`** — JSX tag parse. Spell out: `under 250ms`. Real failure 2026-08-06 Mathesar post.
- **MDX bare `<` operator** — `(=, !=, >, <, LIKE, IN)` trips MDX 3. Wrap in backticks: `` `(=`, `!=`, `>`, `<` ``. Real failure Mathesar L104:40.
- **MDX `<br>`** — Use blank lines between paragraphs.
- **Lowercase tags** — `"AI"` fails the `uppercase-tag` lint check.
- **No `replace_all=true` on `description`** — clobbers TL;DR if both share wording.
- **`pubDate` is a STRING** in Astro content collections. Don't call `.toISOString()` on it without normalizing first — just use the literal ISO string in frontmatter.

### Per-tick thumbnail scripts

**NEVER commit `scripts/blogcron_thumb_<tool>.mjs`** — use `/tmp/blogcron_thumb_*.mjs` and delete after upload. Per-tool scripts pollute `git status` and risk being picked up by future `git add .`.

### Manual takedown

When user says "takedown" / "remove post" / forwards an author complaint:
1. `rm apps/web/src/content/blog/{slug}.mdx`
2. `git add` the specific file, `git commit -m "fix: remove {slug} - {reason}"`, `git push`
3. **GSC URL removal is MANUAL** — open https://search.google.com/search-console/removals?resource_id=sc-domain:runany.dev → Temporary Removals → New Request → submit exact URL. Mavis has no `submit_removal` tool (Google requires interactive browser login).
4. If takedown is fact-based (hallucination, factual error) → add the tool/keyword to `.data/blocklist.txt`.
