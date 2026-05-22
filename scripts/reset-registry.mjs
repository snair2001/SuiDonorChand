/**
 * Reset the Pinata registry to empty.
 * Run: node scripts/reset-registry.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  env[key] = val;
}

const PINATA_JWT = env.PINATA_JWT;
if (!PINATA_JWT) {
  console.error("❌ PINATA_JWT not found in .env.local");
  process.exit(1);
}

const PINATA_API_URL = "https://api.pinata.cloud";
const REGISTRY_NAME = "private-tube-registry-latest";

async function resetRegistry() {
  console.log("🔄 Uploading empty registry to Pinata...");

  const emptyRegistry = {
    videos: [],
    updatedAt: new Date().toISOString(),
  };

  const body = {
    pinataContent: emptyRegistry,
    pinataMetadata: { name: REGISTRY_NAME },
    pinataOptions: { cidVersion: 1 },
  };

  const res = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("❌ Pinata upload failed:", err);
    process.exit(1);
  }

  const result = await res.json();
  console.log("✅ Registry reset successfully!");
  console.log("   New CID:", result.IpfsHash);
  console.log("   All videos removed from marketplace.");
  console.log("");
  console.log("ℹ️  Note: Blockchain transactions on Sui testnet are permanent");
  console.log("   and cannot be deleted — but they have no real value on testnet.");
}

resetRegistry().catch(console.error);
