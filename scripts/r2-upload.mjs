import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dotenv = readFileSync(resolve(root, ".env"), "utf-8");
for (const line of dotenv.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const k = trimmed.slice(0, eq).trim();
  const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const slug = process.argv[2] || process.env.R2_DEFAULT_SLUG || "drifting-in-space";
const filePath = process.argv[3] || process.env.R2_DEFAULT_PATH || "/tmp/thumb_drifting.webp";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const fileData = readFileSync(filePath);
const key = `${bucket}/blog/thumbnails/${slug}.webp`;

const command = new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: fileData,
  ContentType: "image/webp",
});

const result = await s3.send(command);
console.log(`Upload OK → ${key}`);
