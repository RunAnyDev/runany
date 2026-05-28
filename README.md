# RunAny

Local-first AI setup with Ollama + OpenWebUI.

## Apps

- `apps/web` - Web application
- `apps/api` - API server
- `apps/webhook` - Webhook service
- `packages/shared` - Shared packages

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Cloudflare Pages

The web app is an Astro static site. Pushes to `main` that change `apps/web/**` trigger `.github/workflows/deploy-cloudflare-pages.yml`, build `apps/web`, and deploy `apps/web/dist` to Cloudflare Pages project `runany`.

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with `Cloudflare Pages:Edit` permission.
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID.

One-time Cloudflare setup:

```bash
npm run build:web
npx wrangler pages project create runany --production-branch main
npx wrangler pages deploy apps/web/dist --project-name runany --branch main
```

Manual deploy:

```bash
npm run deploy:cloudflare
```
