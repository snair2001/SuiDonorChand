
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import dotenv from "dotenv";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

dotenv.config();

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK);
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "0xdfe4c53514e2c5889d44579e2b7c91d0fe1ce480e2d53e99ad70901170a34182";
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "0x56bee34a6afaef78b8d20893c869c8d00a66326d8071be9ef55af7adbea7f903";
const PLATFORM_CONFIG_ID = process.env.NEXT_PUBLIC_PLATFORM_CONFIG_ID || "0x0febdb9671a669f1d1aa30af7edd5dfc1247c064cf06f9ca8a1fa3ec0cb9c0b1";
// Get your private key from your Sui wallet!
// IMPORTANT: NEVER commit your private key to version control!
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

async function debugPurchaseAccess() {
  console.log("\n=== Debugging purchase_access ===\n");
  console.log("NETWORK:", NETWORK);
  console.log("RPC_URL:", RPC_URL);
  console.log("PACKAGE_ID:", PACKAGE_ID);
  console.log("REGISTRY_ID:", REGISTRY_ID);
  console.log("PLATFORM_CONFIG_ID:", PLATFORM_CONFIG_ID);

  const client = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });

  // 1. First, get the list of campaigns to choose one
  console.log("\n=== Step 1: Getting campaigns ===\n");
  const registryObj = await client.getObject({ id: REGISTRY_ID, options: { showContent: true } });
  let campaignIds = [];
  const content = registryObj.data?.content;
  if (content?.dataType === "moveObject") {
    const fields = content?.fields;
    const campaignsField = fields?.campaigns;
    if (campaignsField?.fields?.contents) {
      campaignIds = campaignsField.fields.contents
        .map((c) => c?.fields?.value || c?.value)
        .filter((id) => id != null);
    } else if (campaignsField?.contents) {
      campaignIds = campaignsField.contents
        .map((c) => c?.fields?.value || c?.value)
        .filter((id) => id != null);
    }
  }

  console.log("Available Campaign IDs:", campaignIds);

  if (campaignIds.length === 0) {
    console.error("No campaigns available!");
    return;
  }

  // 2. Pick first campaign for testing
  const testCampaignId = campaignIds[0];
  console.log("\n=== Step 2: Fetching test campaign details ===\n");
  const campaignObj = await client.getObject({ id: testCampaignId, options: { showContent: true } });
  let priceMist = 0n;
  if (campaignObj.data?.content?.dataType === "moveObject") {
    const fields = campaignObj.data.content.fields;
    priceMist = BigInt(fields.price_mist);
    console.log("Campaign ID:", testCampaignId);
    console.log("Price (Mist):", priceMist);
    console.log("Price (SUI):", Number(priceMist) / 1e9);
  }

  // 3. If you provided a private key, try to build the transaction
  if (PRIVATE_KEY) {
    console.log("\n=== Step 3: Building transaction ===\n");
    const keypair = Ed25519Keypair.fromSecretKey(PRIVATE_KEY);
    console.log("Using address:", keypair.toSuiAddress());

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
    tx.moveCall({
      target: `${PACKAGE_ID}::private_tube::purchase_access`,
      arguments: [
        tx.object(PLATFORM_CONFIG_ID),
        tx.object(testCampaignId),
        coin,
      ],
    });

    console.log("\n=== Transaction Data (use with Sui CLI or Wallet) ===\n");
    console.log("Platform Config ID:", PLATFORM_CONFIG_ID);
    console.log("Campaign ID:", testCampaignId);
    console.log("Price (Mist):", priceMist);
  } else {
    console.log("\n=== Step 3: Instructions for Sui CLI ===\n");
    console.log("To test with Sui CLI, run:");
    console.log(`sui client call --function purchase_access --module private_tube --package ${PACKAGE_ID} --args ${PLATFORM_CONFIG_ID} ${testCampaignId} --gas-budget 10000000`);
    console.log("\nNote: You'll need to split a coin for the exact amount first!");
  }
}

debugPurchaseAccess().catch(console.error);
