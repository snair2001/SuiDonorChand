/**
 * Quick script to find the PlatformConfig shared object from our published package
 */

import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const PACKAGE_ID = "0x2856399f6070131317b3cead66aa7be5c947e6335068d5ca62c7bec3f5c58e25";
const SUI_NETWORK = "testnet";

async function main() {
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(SUI_NETWORK), network: SUI_NETWORK });

  console.log("Looking for PlatformConfig objects owned by package:", PACKAGE_ID);

  // Query all objects owned by the package
  const objects = await client.getOwnedObjects({
    owner: PACKAGE_ID,
    options: {
      showType: true,
      showContent: true,
      showOwner: true,
    },
  });

  console.log("\nFound", objects.data.length, "objects owned by package:");

  for (const obj of objects.data) {
    console.log("\n- Object ID:", obj.data?.objectId);
    console.log("  Type:", obj.data?.type);
  }

  // Also try querying past events for the package
  console.log("\n\nLooking for recent package events...");
  const events = await client.queryEvents({
    query: {
      MoveEventModule: {
        package: PACKAGE_ID,
        module: "private_tube",
      },
    },
    limit: 50,
  });

  console.log("\nFound", events.data.length, "events:");
  for (const evt of events.data) {
    console.log("- Event type:", evt.type);
    console.log("  Parsed:", JSON.stringify(evt.parsedJson, null, 2));
  }
}

main().catch(console.error);
