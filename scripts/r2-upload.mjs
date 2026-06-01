import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

const slug = process.argv[2] || "drifting-in-space";
const filePath = process.argv[3] || "/tmp/thumb_drifting.webp";

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://d6d37dd4a65eea30f2600687beb90345.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "9a53717f3e2aa4220c58f79d887bbc50",
    secretAccessKey: "0b594062d72b90317ce06f4080494a373d7a30afd9bd2bb9678056bc02204291",
  },
});

const fileData = readFileSync(filePath);
const key = `runany/blog/thumbnails/${slug}.webp`;

const command = new PutObjectCommand({
  Bucket: "runany",
  Key: key,
  Body: fileData,
  ContentType: "image/webp",
});

const result = await s3.send(command);
console.log(`Upload OK → ${key}`);
