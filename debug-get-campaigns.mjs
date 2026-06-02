
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import dotenv from "dotenv";

dotenv.config();

const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK);
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "0x56bee34a6afaef78b8d20893c869c8d00a66326d8071be9ef55af7adbea7f903";

async function debugGetCampaigns() {
  console.log("\n=== Debugging getCampaigns ===\n");
  console.log("NETWORK:", NETWORK);
  console.log("REGISTRY_ID:", REGISTRY_ID);

  const client = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });

  const registryObj = await client.getObject({ id: REGISTRY_ID, options: { showContent: true } });

  console.log("\n=== Registry Object ===\n", JSON.stringify(registryObj, null, 2));

  let campaignIds = [];
  const content = registryObj.data?.content;
  if (content?.dataType === "moveObject") {
    const fields = content?.fields;
    console.log("\n=== Registry fields ===\n", JSON.stringify(fields, null, 2));

    const campaignsField = fields?.campaigns;
    console.log("\n=== campaigns ===\n", JSON.stringify(campaignsField, null, 2));

    if (campaignsField) {
      if (campaignsField.fields?.contents) {
        const contents = campaignsField.fields.contents;
        console.log("\n=== campaigns.fields.contents ===\n", JSON.stringify(contents, null, 2));
        campaignIds = contents
          .map((c) => c?.fields?.value || c?.value)
          .filter((id) => id != null);
      } else if (campaignsField.contents) {
        const contents = campaignsField.contents;
        console.log("\n=== campaigns.contents ===\n", JSON.stringify(contents, null, 2));
        campaignIds = contents
          .map((c) => c?.fields?.value || c?.value)
          .filter((id) => id != null);
      }
    }

    console.log("\n=== Extracted campaignIds ===\n", campaignIds);

    if (campaignIds.length > 0) {
      const campaignObjects = await client.multiGetObjects({
        ids: campaignIds,
        options: { showContent: true },
      });

      console.log("\n=== Campaign Objects ===\n", JSON.stringify(campaignObjects, null, 2));
    }
  }
}

debugGetCampaigns();
