import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

const NETWORK_ENV = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL || getJsonRpcFullnodeUrl(NETWORK_ENV as any);
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "";
const PLATFORM_CONFIG_ID = process.env.NEXT_PUBLIC_PLATFORM_CONFIG_ID || "";

export const suiClient = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK_ENV as any });

export interface SafeVideoMetadata {
  videoId: string;
  campaignId: string;
  title: string;
  description: string;
  creatorAddress: string;
  priceMist: string;
  priceSui: string;
  durationHours: number;
  isDisabled: boolean;
  disabledReason: string | null;
  totalPurchases: number;
  totalGrossMist: string;
  thumbnailVideoId: string;
}

export async function getCampaigns(): Promise<SafeVideoMetadata[]> {
  if (!REGISTRY_ID || !PACKAGE_ID) {
    console.warn("Missing REGISTRY_ID or PACKAGE_ID environment variables");
    return [];
  }

  try {
    const registryObj = await suiClient.getObject({
      id: REGISTRY_ID,
      options: { showContent: true },
    });

    console.log("[getCampaigns] Registry object:", JSON.stringify(registryObj, null, 2));

    if (registryObj.data?.content?.dataType !== "moveObject") {
      console.warn("[getCampaigns] Registry is not a move object");
      return [];
    }

    const content = (registryObj.data.content as any);
    console.log("[getCampaigns] Registry content:", JSON.stringify(content, null, 2));

    let campaignIds: string[] = [];

    if (content.campaigns) {
      const campaigns = content.campaigns;
      console.log("[getCampaigns] campaigns raw:", JSON.stringify(campaigns, null, 2));

      let contents: any[] = [];
      
      // Try all possible VecMap structures
      if (campaigns?.fields?.contents) {
        contents = campaigns.fields.contents;
      } else if (campaigns?.contents) {
        contents = campaigns.contents;
      } else if (campaigns?.fields) {
        // Maybe fields is the contents?
        contents = campaigns.fields;
      } else if (Array.isArray(campaigns)) {
        contents = campaigns;
      }

      console.log("[getCampaigns] extracted contents:", JSON.stringify(contents, null, 2));

      if (Array.isArray(contents)) {
        campaignIds = contents
          .map((c) => {
            console.log("[getCampaigns] processing entry:", JSON.stringify(c, null, 2));
            // Try all possible ways to get the value
            if (c?.fields?.value) return c.fields.value;
            if (c?.value) return c.value;
            if (c?.fields?.key?.value) return c.fields.key.value; // just in case
            if (typeof c === 'string') return c;
            return null;
          })
          .filter((id): id is string => id != null && id.length > 0);
      }
    }

    console.log("[getCampaigns] Final campaign IDs:", campaignIds);

    if (campaignIds.length === 0) {
      console.warn("[getCampaigns] No campaign IDs found in registry");
      return [];
    }

    const campaignObjects = await suiClient.multiGetObjects({
      ids: campaignIds,
      options: { showContent: true },
    });

    console.log("[getCampaigns] Campaign objects:", JSON.stringify(campaignObjects, null, 2));

    return campaignObjects
      .filter((obj) => {
        if (obj.data?.content?.dataType !== "moveObject") {
          console.warn("[getCampaigns] Skipping non-move object:", obj);
          return false;
        }
        const content = obj.data.content as any;
        if (!content?.fields) {
          console.warn("[getCampaigns] Skipping object with no fields:", obj);
          return false;
        }
        return true;
      })
      .map((obj) => {
        const content = obj.data!.content as any;
        const fields = content.fields;
        console.log("[getCampaigns] Campaign object fields:", JSON.stringify(fields, null, 2));
        
        const videoId = fields.video_id 
          ? (typeof fields.video_id === 'string' ? fields.video_id : Buffer.from(fields.video_id).toString())
          : "";
        
        const title = fields.title 
          ? (typeof fields.title === 'string' ? fields.title : Buffer.from(fields.title).toString())
          : "";
        
        const description = fields.description 
          ? (typeof fields.description === 'string' ? fields.description : Buffer.from(fields.description).toString())
          : "";
        
        const disabledReason = fields.disabled_reason 
          ? (typeof fields.disabled_reason === 'string' ? fields.disabled_reason : Buffer.from(fields.disabled_reason).toString() || null)
          : null;
        
        const thumbnailVideoId = fields.thumbnail_video_id 
          ? (typeof fields.thumbnail_video_id === 'string' ? fields.thumbnail_video_id : Buffer.from(fields.thumbnail_video_id).toString())
          : "";
          
        return {
          videoId,
          campaignId: obj.data!.objectId,
          title,
          description,
          creatorAddress: fields.creator || "",
          priceMist: fields.price_mist?.toString() || "0",
          priceSui: fields.price_mist ? (Number(fields.price_mist) / 1e9).toFixed(4) : "0",
          durationHours: Number(fields.duration_hours) || 0,
          isDisabled: fields.is_disabled || false,
          disabledReason,
          totalPurchases: Number(fields.total_purchases) || 0,
          totalGrossMist: fields.total_gross_mist?.toString() || "0",
          thumbnailVideoId,
        };
      });
  } catch (error) {
    console.error("[getCampaigns] Error fetching campaigns:", error);
    return [];
  }
}

export async function getCampaign(campaignId: string): Promise<SafeVideoMetadata | null> {
  try {
    const obj = await suiClient.getObject({
      id: campaignId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType !== "moveObject") {
      return null;
    }

    const content = obj.data.content as any;
    const fields = content.fields;
    if (!fields) {
      return null;
    }
    return {
      videoId: fields.video_id ? Buffer.from(fields.video_id).toString() : "",
      campaignId: obj.data.objectId,
      title: fields.title ? Buffer.from(fields.title).toString() : "",
      description: fields.description ? Buffer.from(fields.description).toString() : "",
      creatorAddress: fields.creator || "",
      priceMist: fields.price_mist?.toString() || "0",
      priceSui: fields.price_mist ? (Number(fields.price_mist) / 1e9).toFixed(4) : "0",
      durationHours: Number(fields.duration_hours) || 0,
      isDisabled: fields.is_disabled || false,
      disabledReason: fields.disabled_reason ? Buffer.from(fields.disabled_reason).toString() || null : null,
      totalPurchases: Number(fields.total_purchases) || 0,
      totalGrossMist: fields.total_gross_mist?.toString() || "0",
      thumbnailVideoId: fields.thumbnail_video_id ? Buffer.from(fields.thumbnail_video_id).toString() : "",
    };
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return null;
  }
}

export async function getCampaignEncryptedData(campaignId: string) {
  try {
    const obj = await suiClient.getObject({
      id: campaignId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType !== "moveObject") {
      return null;
    }

    const content = obj.data.content as any;
    const fields = content.fields;
    if (!fields) {
      return null;
    }
    return {
      encryptedUrl: fields.encrypted_url ? Buffer.from(fields.encrypted_url).toString() : "",
      iv: fields.iv ? Buffer.from(fields.iv).toString() : "",
      authTag: fields.auth_tag ? Buffer.from(fields.auth_tag).toString() : "",
    };
  } catch (error) {
    console.error("Error fetching encrypted data:", error);
    return null;
  }
}

export function createCreateCampaignTransaction({
  videoId,
  priceMist,
  durationHours,
  title,
  description,
  thumbnailVideoId,
  encryptedUrl,
  iv,
  authTag,
}: {
  videoId: string;
  priceMist: bigint;
  durationHours: bigint;
  title: string;
  description: string;
  thumbnailVideoId: string;
  encryptedUrl: string;
  iv: string;
  authTag: string;
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::private_tube::create_campaign`,
    arguments: [
      tx.object(REGISTRY_ID),
      tx.pure.string(videoId),
      tx.pure.u64(priceMist),
      tx.pure.u64(durationHours),
      tx.pure.string(title),
      tx.pure.string(description),
      tx.pure.string(thumbnailVideoId),
      tx.pure.string(encryptedUrl),
      tx.pure.string(iv),
      tx.pure.string(authTag),
    ],
  });
  return tx;
}

export function createPurchaseAccessTransaction({
  campaignId,
  priceMist,
}: {
  campaignId: string;
  priceMist: bigint;
}) {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::private_tube::purchase_access`,
    arguments: [
      tx.object(PLATFORM_CONFIG_ID),
      tx.object(campaignId),
      coin,
    ],
  });
  return tx;
}
