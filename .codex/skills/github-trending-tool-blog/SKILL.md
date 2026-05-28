# GitHub Trending Tool Blog

Use this skill to create daily runany.dev blog posts about newly popular GitHub developer or AI tools.

## Workflow

1. Run `node scripts/create-github-trending-tool-post.mjs` from repo root.
2. The script searches GitHub for recently created, high-star AI, LLM, CLI, or developer-tool repositories.
3. It creates up to 17 posts per run by default. Set `POSTS_PER_RUN=10` to create fewer or another number.
4. It skips repositories already tracked in `.data/written-repos.txt`.
5. It creates detailed MDX posts in `apps/web/src/content/blog/` with an optimized R2-hosted SVG thumbnail, repo link, README and linked-docs-derived setup notes, docs command blocks, evaluation checklist, security notes, FAQ, and SEO frontmatter.
6. Run `cd apps/web && npm run build` to validate.
7. Commit the new posts, `scripts/create-github-trending-tool-post.mjs`, `.data/written-repos.txt`, and this skill when changed.

## Tracking

- Duplicate tracking lives in `.data/written-repos.txt`, one lowercased `owner/repo` per line.

## Environment

- `GITHUB_TOKEN` is strongly recommended because the script fetches repository metadata, README docs, and linked documentation pages for every post.
- R2 upload env is required before writing posts: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, plus `R2_ENDPOINT` or `R2_ACCOUNT_ID`. The script loads only `/Users/friday/personal/runany/.env` before validation.
- Optional `POSTS_PER_RUN` controls how many posts are generated each run. Default is 17.
- Optional `REFRESH_TRACKED=1` rewrites already tracked posts with the latest README and linked-docs-derived template and GitHub metadata.
- Network access is required.
- Put secrets in `/Users/friday/personal/runany/.env` for local runs; do not commit that file.

## Thumbnail optimization

- SVG thumbnails are minified before upload to R2.
- Upload is blocked if the optimized thumbnail exceeds 80 KB.
- The MDX post is written only after R2 upload succeeds, so committed posts always point to a public optimized image.
