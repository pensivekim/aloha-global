#!/usr/bin/env node

// KV에 시설 데이터를 시딩하는 스크립트
// 사용법: node scripts/seed-facility.js <KV_NAMESPACE_ID>
//
// facilities.json의 모든 시설 데이터를 Cloudflare KV에 업로드합니다.
// wrangler CLI가 설치되어 있어야 합니다.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const kvNamespaceId = process.argv[2];

if (!kvNamespaceId) {
  console.error("Usage: node scripts/seed-facility.js <KV_NAMESPACE_ID>");
  console.error("  Get your KV namespace ID from Cloudflare dashboard or:");
  console.error("  npx wrangler kv namespace create FACILITY_DATA");
  process.exit(1);
}

const facilitiesPath = resolve(__dirname, "..", "facilities.json");
const facilities = JSON.parse(readFileSync(facilitiesPath, "utf-8"));

for (const [id, data] of Object.entries(facilities)) {
  const key = `facility:${id}`;
  const value = JSON.stringify(data);

  console.log(`Seeding ${key} ...`);

  execSync(
    `npx wrangler kv key put --namespace-id="${kvNamespaceId}" "${key}" '${value.replace(/'/g, "'\\''")}'`,
    { stdio: "inherit" }
  );
}

console.log(`Done! Seeded ${Object.keys(facilities).length} facilities.`);
