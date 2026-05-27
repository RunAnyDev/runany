# Agents Guide for runany.dev

## Overview

runany.dev là blog chia sẻ kiến thức tech, AI, setup tools cho developers. Tối ưu cho AI crawlers (GPT, Claude, Perplexity).

**Quy tắc quan trọng:** Agent có thể commit trực tiếp bài viết mới vào repo mà KHÔNG cần webhook.

---

## Creating a New Blog Post

### 1. File Location

```
~/personal/runany/apps/web/src/content/blog/[slug].mdx
```

### 2. Naming Convention

- **Slug**: lowercase, hyphenated, mô tả nội dung
- Ví dụ: `setup-ollama-local.mdx`, `cursor-vs-copilot.mdx`
- KHÔNG dùng số thứ tự trong slug (`post-1`, `post-2`)

### 3. Frontmatter (BẮT BUỘC)

```yaml
---
title: "Tiêu đề bài viết (≤60 chars)"
description: "Mô tả ngắn 150-200 chars cho SEO và AI extract"
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

> **TL;DR:** Một sentence tóm tắt nội dung.

## Tại sao cần [topic]?

- Context ngắn gọn
- Problem being solved

## Prerequisites

- List requirements
- Version numbers

## Step 1: [Task name]

Code blocks với language identifier:

```bash
# Example command
echo "hello"
```

## Step 2: [Another task]

## FAQ

**Q: Câu hỏi thường gặp?**
**A:** Trả lời ngắn gọn.

## Conclusion

Tóm tắt + next steps
```

### 5. Content Rules

- **Code blocks**: LUÔN có language identifier (`bash`, `python`, `javascript`, `json`, `yaml`)
- **Headings**: H2 cho main sections, H3 cho sub-steps
- **Links**: Dùng relative paths cho internal links (`/blog/other-post/`)
- **Images**: Local trong `public/` hoặc external URLs
- **TL;DR**: Thêm block quote `>` cho summary (AI summary box sẽ extract)
- **FAQ**: Thêm Q&A format ở cuối nếu có nhiều câu hỏi

---

## Commit Workflow

```bash
cd ~/personal/runany

# 1. Tạo file
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

# 2. Verify syntax (optional - chạy build check)
cd apps/web && npm run build 2>&1 | tail -5

# 3. Commit
cd ~/personal/runany
git add apps/web/src/content/blog/[slug].mdx
git commit -m "feat: add [slug] - [title]"

# 4. Push (trigger Vercel auto-deploy)
git push
```

---

## Validation Checklist

Trước khi commit, đảm bảo:

- [ ] `title` ≤ 60 chars, chứa keywords chính
- [ ] `description` ≤ 200 chars, hấp dẫn để click
- [ ] `tags` lowercase, hyphenated (không spaces)
- [ ] `category` là một trong các options
- [ ] Có TL;DR block `>`
- [ ] Code blocks có language identifier
- [ ] Headings hierarchy rõ ràng (H2 > H3)
- [ ] File đặt đúng: `apps/web/src/content/blog/[slug].mdx`
- [ ] `draft: false` (để publish)

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

- [ ] Title chứa main keyword
- [ ] Description hấp dẫn, ≤ 160 chars
- [ ] Tags phù hợp (3-5 tags)
- [ ] Có internal links (liên quan đến bài khác)
- [ ] Có code blocks với syntax highlighting
- [ ] Có TL;DR summary cho AI extract

---

## File Structure

```
runany/
├── apps/
│   ├── web/                      ← Astro SSG
│   │   └── src/
│   │       ├── content/blog/     ← BÀI VIẾT Ở ĐÂY
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
# Tạo bài viết mới (slug: setup-n8n)
cat > apps/web/src/content/blog/setup-n8n.mdx << 'ENDOFFRONT'
---
title: "Cách setup N8N trên VPS"
description: "Hướng dẫn setup N8N automation tool trên VPS Ubuntu."
pubDate: "2025-05-27"
tags: ["n8n", "automation", "self-hosted"]
category: "self-hosted"
author: "Du"
draft: false
---

> **TL;DR:** ...

## Nội dung
ENDOFFRONT

# Commit và push
git add apps/web/src/content/blog/setup-n8n.mdx
git commit -m "feat: add setup-n8n - Cách setup N8N trên VPS"
git push
```