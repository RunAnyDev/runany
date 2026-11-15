#!/usr/bin/env node
/**
 * Minimal MCP stdio client for the Google Search Console MCP server
 * (`mcp-search-console`).
 *
 * Why this exists:
 *   The `mavis mcp call gsc ...` CLI flow documented in the old
 *   `mcp-gsc` skill no longer works — the MiniMax Code app moved to
 *   `app.asar` and `~/.minimax/bin/mavis` still points at a `daemon/cli.js`
 *   path that no longer exists. The gsc MCP server itself is still
 *   configured in `~/.minimax/mcp/mcp.json`, it just is not exposed as a
 *   built-in tool to every session.
 *
 *   This script speaks MCP over stdio directly, so anything that can run
 *   Node can read Search Console data — including the daily monitoring cron.
 *
 * Usage:
 *   node scripts/gsc-client.mjs <tool-name> '<json-args>'
 *   node scripts/gsc-client.mjs <tool-name> @/path/to/args.json
 *
 * Examples:
 *   node scripts/gsc-client.mjs list_properties '{}'
 *   node scripts/gsc-client.mjs get_sitemaps '{"site_url":"sc-domain:runany.dev"}'
 *   node scripts/gsc-client.mjs check_indexing_issues '{"site_url":"sc-domain:runany.dev","urls":"https://a/\\nhttps://b/"}'
 *
 * Auth:
 *   The OAuth client secrets file is read from GSC_SECRETS_FILE, defaulting
 *   to ~/gsc-token.json. The refresh/access token is cached by the server
 *   itself, so no credential is stored in this repo.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:runany.dev';
const SECRETS_FILE =
  process.env.GSC_SECRETS_FILE || join(homedir(), 'gsc-token.json');
const SERVER_COMMAND = process.env.GSC_SERVER_COMMAND || 'uvx';
const SERVER_ARGS = (process.env.GSC_SERVER_ARGS || 'mcp-search-console')
  .split(' ')
  .filter(Boolean);

/** Tools that require a `site_url` argument. */
const SITE_URL_TOOLS = new Set([
  'add_site',
  'batch_url_inspection',
  'check_indexing_issues',
  'compare_search_periods',
  'delete_site',
  'delete_sitemap',
  'get_advanced_search_analytics',
  'get_performance_overview',
  'get_search_analytics',
  'get_search_by_page_query',
  'get_site_details',
  'get_sitemap_details',
  'get_sitemaps',
  'inspect_url_enhanced',
  'list_sitemaps_enhanced',
  'manage_sitemaps',
  'submit_sitemap',
]);

const [, , toolName, argsJson] = process.argv;

if (!toolName) {
  console.error(
    'Usage: node scripts/gsc-client.mjs <tool-name> \'<json-args>\' | @args.json'
  );
  process.exit(2);
}

const child = spawn(SERVER_COMMAND, SERVER_ARGS, {
  env: { ...process.env, GSC_OAUTH_CLIENT_SECRETS_FILE: SECRETS_FILE },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
let nextId = 0;
const pending = new Map();

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      console.error(`[non-json] ${line}`);
      continue;
    }

    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) {
      console.error(`[server] ${JSON.stringify(message).slice(0, 500)}`);
    }
  }
});

child.stderr.on('data', (chunk) => process.stderr.write(chunk));

function send(method, params) {
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

const notify = (method, params) =>
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);

const timeout = setTimeout(() => {
  console.error('TIMEOUT: gsc server did not answer in time');
  child.kill();
  process.exit(2);
}, 180000);

(async () => {
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'runany-gsc-client', version: '1.0.0' },
  });
  console.error(`[init] ${JSON.stringify(init.result?.serverInfo ?? init.error)}`);
  notify('notifications/initialized', {});

  if (!toolName || toolName === 'list') {
    const listed = await send('tools/list', {});
    console.log(
      JSON.stringify(listed.result?.tools?.map((tool) => tool.name) ?? listed, null, 2)
    );
  } else {
    let args = {};
    try {
      const raw = argsJson?.startsWith('@')
        ? readFileSync(argsJson.slice(1), 'utf8')
        : argsJson;
      args = raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error(`bad args json: ${error.message}`);
    }

    // Convenience default so callers do not have to repeat the property.
    // Only applied to the tools that actually take a site_url.
    if (args.site_url === undefined && SITE_URL_TOOLS.has(toolName)) {
      args.site_url = SITE_URL;
    }

    const result = await send('tools/call', { name: toolName, arguments: args });
    const content = result.result?.content ?? result.error ?? result;
    const text = (Array.isArray(content) ? content : [content])
      .map((item) => item.text ?? JSON.stringify(item))
      .join('\n');
    console.log(text);
  }

  clearTimeout(timeout);
  child.kill();
  process.exit(0);
})();
