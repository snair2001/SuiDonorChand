
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import dotenv from "dotenv";

dotenv.config();

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK);
const CAMPAIGN_ID = process.argv[2] || "0x6704f2c4a4106e7fad43adff8dcf5593be594c3cba6d97b4bebe9d692b1a289b";
const BUYER_ADDRESS = process.argv[3] || "";

if (!BUYER_ADDRESS) {
  console.error("Usage: node debug-check-access.mjs <campaign-id> <buyer-address>");
  process.exit(1);
}

async function debugCheckAccess() {
  console.log("\n=== Debugging checkAccess ===\n");
  console.log("NETWORK:", NETWORK);
  console.log("CAMPAIGN_ID:", CAMPAIGN_ID);
  console.log("BUYER_ADDRESS:", BUYER_ADDRESS);

  const client = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });

  try {
    const accessRecord = await client.getDynamicFieldObject({
      parentId: CAMPAIGN_ID,
      name: {
        type: "address",
        value: BUYER_ADDRESS,
      },
    });

    console.log("\n=== Access Record Found ===\n", JSON.stringify(accessRecord, null, 2));

    if (accessRecord.data?.content?.dataType === "moveObject") {
      const fields = accessRecord.data.content.fields;
      const expiresAtMs = Number(fields.expiration_timestamp_ms);
      const now = Date.now();
      const hasAccess = expiresAtMs > now;

      console.log("\n=== Access Check Result ===");
      console.log("Has Valid Access:", hasAccess);
      console.log("Expires At (ms):", expiresAtMs);
      console.log("Expires At (Date):", new Date(expiresAtMs).toISOString());
      console.log("Current Time:", new Date(now).toISOString());
    }
  } catch (error) {
    console.log("\n=== Access Record NOT Found ===");
    console.error("Error:", error.message);
  }
}

debugCheckAccess().catch(console.error);
