import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet" | "mainnet" | "devnet";

const RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getJsonRpcFullnodeUrl(NETWORK);
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "";
const PLATFORM_CONFIG_ID = process.env.NEXT_PUBLIC_PLATFORM_CONFIG_ID || "";

export const suiClient = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });

function decodeBytesToString(bytes: number[] | undefined | null): string {
  if (!bytes || !Array.isArray(bytes)) {
    return "";
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString();
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

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

export interface CampaignEncryptedData {
  encryptedUrl: string;
  iv: string;
  authTag: string;
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

    console.log("[server:getCampaigns] Registry object:", JSON.stringify(registryObj, null, 2));

    if (registryObj.data?.content?.dataType !== "moveObject") {
      return [];
    }

    const content = (registryObj.data.content as any);
    let campaignIds: string[] = [];

    const campaigns = content?.fields?.campaigns;
    if (campaigns) {
      console.log("[server:getCampaigns] campaigns raw:", JSON.stringify(campaigns, null, 2));
      
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

      console.log("[server:getCampaigns] extracted contents:", JSON.stringify(contents, null, 2));

      if (Array.isArray(contents)) {
        campaignIds = contents
          .map((c) => {
            console.log("[server:getCampaigns] processing entry:", JSON.stringify(c, null, 2));
            // Try all possible ways to get the value
            if (c?.fields?.value) return c.fields.value;
            if (c?.value) return c.value;
            if (c?.fields?.key?.value) return c.fields.key.value;
            if (typeof c === 'string') return c;
            return null;
          })
          .filter((id): id is string => id != null && id.length > 0);
      }
    }

    console.log("[server:getCampaigns] Final campaign IDs:", campaignIds);

    if (campaignIds.length === 0) {
      return [];
    }

    const campaignObjects = await suiClient.multiGetObjects({
      ids: campaignIds,
      options: { showContent: true },
    });

    console.log("[server:getCampaigns] Campaign objects:", JSON.stringify(campaignObjects, null, 2));

    return campaignObjects
      .filter((obj) => {
        if (obj.data?.content?.dataType !== "moveObject") {
          return false;
        }
        const content = obj.data.content as any;
        if (!content?.fields) {
          return false;
        }
        return true;
      })
      .map((obj) => {
        const content = obj.data!.content as any;
        const fields = content.fields;
        console.log("[server:getCampaigns] Campaign fields:", JSON.stringify(fields, null, 2));

        const videoId = fields.video_id 
          ? (typeof fields.video_id === 'string' ? fields.video_id : decodeBytesToString(fields.video_id))
          : "";
        
        const title = fields.title 
          ? (typeof fields.title === 'string' ? fields.title : decodeBytesToString(fields.title))
          : "";
        
        const description = fields.description 
          ? (typeof fields.description === 'string' ? fields.description : decodeBytesToString(fields.description))
          : "";
        
        const disabledReason = fields.disabled_reason 
          ? (typeof fields.disabled_reason === 'string' ? fields.disabled_reason : decodeBytesToString(fields.disabled_reason) || null)
          : null;
        
        const thumbnailVideoId = fields.thumbnail_video_id 
          ? (typeof fields.thumbnail_video_id === 'string' ? fields.thumbnail_video_id : decodeBytesToString(fields.thumbnail_video_id))
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
    console.error("Error fetching campaigns:", error);
    return [];
  }
}

export async function getCampaignByVideoId(videoId: string): Promise<SafeVideoMetadata | null> {
  const allCampaigns = await getCampaigns();
  return allCampaigns.find((c) => c.videoId === videoId) || null;
}

export async function getCampaignEncryptedData(campaignId: string): Promise<CampaignEncryptedData | null> {
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
      encryptedUrl: fields.encrypted_url ? (typeof fields.encrypted_url === 'string' ? fields.encrypted_url : decodeBytesToString(fields.encrypted_url)) : "",
      iv: fields.iv ? (typeof fields.iv === 'string' ? fields.iv : decodeBytesToString(fields.iv)) : "",
      authTag: fields.auth_tag ? (typeof fields.auth_tag === 'string' ? fields.auth_tag : decodeBytesToString(fields.auth_tag)) : "",
    };
  } catch (error) {
    console.error("Error fetching encrypted data:", error);
    return null;
  }
}

export async function checkAccess(campaignId: string, buyerAddress: string): Promise<{ hasAccess: boolean; expiresAt: string | null }> {
  try {
    console.log("[checkAccess] Checking access for:", { campaignId, buyerAddress });

    // AccessRecord is stored as a dynamic_object_field (DOF) keyed by buyer address.
    // getDynamicFields on the campaign returns the child object IDs directly.
    // The objectId in each field entry IS the AccessRecord object itself.
    let cursor: string | undefined | null = undefined;
    let expiresAtMs: number | null = null;

    do {
      const page = await suiClient.getDynamicFields({
        parentId: campaignId,
        cursor: cursor ?? undefined,
      });

      console.log("[checkAccess] getDynamicFields page:", JSON.stringify(page, null, 2));

      for (const field of page.data) {
        // The key is the buyer address stored as a Move `address`
        const keyValue =
          typeof field.name?.value === "string"
            ? field.name.value
            : null;

        const normalizedKey = keyValue?.toLowerCase();
        const normalizedBuyer = buyerAddress.toLowerCase();

        if (normalizedKey === normalizedBuyer) {
          // For dynamic_object_field, field.objectId is the AccessRecord object itself
          const recordObj = await suiClient.getObject({
            id: field.objectId,
            options: { showContent: true },
          });

          console.log("[checkAccess] AccessRecord object:", JSON.stringify(recordObj, null, 2));

          const content = recordObj.data?.content as any;
          // DOF: the record is a top-level object — fields are at content.fields
          const fields =
            content?.fields?.value?.fields ?? // DOF wrapper (some SDK versions)
            content?.fields ??                // direct object
            null;

          if (fields) {
            expiresAtMs = Number(fields.expiration_timestamp_ms) || 0;
          }
          break;
        }
      }

      if (expiresAtMs !== null) break;
      cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor != null);

    if (expiresAtMs === null) {
      console.log("[checkAccess] No access record found for buyer");
      return { hasAccess: false, expiresAt: null };
    }

    const now = Date.now();
    console.log("[checkAccess] Expiration check:", { expiresAtMs, now, isExpired: expiresAtMs <= now });

    if (expiresAtMs <= now) {
      return { hasAccess: false, expiresAt: expiresAtMs > 0 ? new Date(expiresAtMs).toISOString() : null };
    }

    return { hasAccess: true, expiresAt: new Date(expiresAtMs).toISOString() };
  } catch (error) {
    console.error("Error checking access:", error);
    return { hasAccess: false, expiresAt: null };
  }
}
