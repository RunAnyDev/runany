import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = "/Users/friday/personal/runany";
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

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

let token;
const keys = [];
do {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET,
    Prefix: "blog/thumbnails/",
    ContinuationToken: token,
  }));
  for (const obj of res.Contents || []) keys.push(obj.Key);
  token = res.NextContinuationToken;
} while (token);

keys.forEach(k => console.log(k.replace("blog/thumbnails/", "").replace(".webp", "")));
