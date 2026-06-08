import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import path from "path";
import { createThumbnailSvg, renderSvgToWebp } from "./lib/thumbnail-svg.mjs";

const root = "/Users/friday/personal/runany";

async function loadDotEnv() {
  const filePath = path.join(root, ".env");
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

await loadDotEnv();

const tools = [
  { slug: "enact-verified-ai-tool-registry", name: "Enact", desc: "Verified AI Tools Registry with cryptographic verification", github: "enact-ai/enact", lang: "TypeScript", stars: "YC-backed" },
  { slug: "chamber-ai-gpu-teammate", name: "Chamber", desc: "AI Teammate for GPU Infrastructure", github: "", lang: "Go", stars: "YC W26" },
  { slug: "exa-web-search-engine", name: "Exa", desc: "Neural AI Search Engine With 20x Recall", github: "exa-pro/search-api", lang: "Python", stars: "YC S21" },
  { slug: "expanse-gpu-capacity-optimizer", name: "Expanse", desc: "HPC GPU Cluster Resource Optimizer", github: "", lang: "Go", stars: "" },
  { slug: "skip-cross-platform-swift-apps", name: "Skip", desc: "Cross-Platform Native Apps From One Swift Codebase", github: "skiptools/skip", lang: "Swift", stars: "Open Source" },
  { slug: "moltis-ai-assistant-server", name: "Moltis", desc: "Self-Extending AI Agent Server in Rust", github: "fabien-odermatt/moltis", lang: "Rust", stars: "" },
  { slug: "second-ai-codebot-github", name: "Second", desc: "AI Bots That Add Features to Web Apps Automatically", github: "", lang: "TypeScript", stars: "" },
  { slug: "hypercubic-hopper-mainframe-ai-agents", name: "Hopper", desc: "AI Agents for Mainframe Operations", github: "", lang: "Go", stars: "" },
  { slug: "infisical-secret-management-platform", name: "Infisical", desc: "Open-Source Secret Management Platform", github: "Infisical/infisical", lang: "TypeScript", stars: "37K stars" },
  { slug: "leap-ai-developer-agent", name: "Leap", desc: "AI Developer Agent That Deploys to AWS/GCP", github: "", lang: "TypeScript", stars: "" },
  { slug: "visor-jira-spreadsheet-sync", name: "Visor", desc: "Bi-Directional Jira Sync for Spreadsheets", github: "", lang: "TypeScript", stars: "" },
  { slug: "continue-custom-ai-code-assistants", name: "Continue", desc: "Create Custom AI Code Assistants", github: "continuedev/continue", lang: "TypeScript", stars: "33K stars" },
  { slug: "noya-design-development-apps", name: "Noya", desc: "AI Design Tool That Converts Wireframes to React", github: "noyadev/noya", lang: "TypeScript", stars: "YC W23" },
  { slug: "agentmbox-ai-email-agent", name: "AgentMBOX", desc: "Pay-Per-Request Email for AI Agents on Solana", github: "", lang: "TypeScript", stars: "" },
];

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(slug, buf) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: `blog/thumbnails/${slug}.webp`,
    Body: buf,
    ContentType: "image/webp",
  });
  const res = await r2Client.send(cmd);
  console.log(`  R2 upload done: ${JSON.stringify(res)}`);
}

async function generateAndUpload(tool) {
  console.log(`Processing: ${tool.name} (${tool.slug})`);
  const svg = createThumbnailSvg({
    title: tool.name,
    slug: tool.slug,
    kicker: tool.github || "RUNANY.DEV",
    subtitle: tool.desc,
    metadata: [
      tool.lang || "Developer tool",
      tool.stars || "Modern workflow",
      "SVG thumbnail → optimized WebP",
    ],
    seed: tool.github || tool.slug,
  });
  const buf = await renderSvgToWebp(svg, { quality: 86 });
  console.log(`  Generated SVG→WebP: ${buf.length} bytes`);

  await uploadToR2(tool.slug, buf);
}

for (const tool of tools) {
  await generateAndUpload(tool);
}

console.log("\nDone! Updating MDX frontmatter...");
