import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
  | "testnet" | "mainnet" | "devnet";

const RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL ?? getJsonRpcFullnodeUrl(NETWORK);
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
const REGISTRY_ID = process.env.NEXT_PUBLIC_REGISTRY_ID || "";
const PLATFORM_CONFIG_ID = process.env.NEXT_PUBLIC_PLATFORM_CONFIG_ID || "";

export const suiClient = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });

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

    if (registryObj.data?.content?.dataType !== "moveObject") {
      return [];
    }

    const campaigns = (registryObj.data.content as any).campaigns.fields.contents as any[];
    const campaignIds = campaigns.map((c) => c.fields.value);

    const campaignObjects = await suiClient.multiGetObjects({
      ids: campaignIds,
      options: { showContent: true },
    });

    return campaignObjects
      .filter((obj) => obj.data?.content?.dataType === "moveObject")
      .map((obj) => {
        const content = obj.data!.content as any;
        const fields = content.fields;
        return {
          videoId: Buffer.from(fields.video_id).toString(),
          campaignId: obj.data!.objectId,
          title: Buffer.from(fields.title).toString(),
          description: Buffer.from(fields.description).toString(),
          creatorAddress: fields.creator,
          priceMist: fields.price_mist.toString(),
          priceSui: (Number(fields.price_mist) / 1e9).toFixed(4),
          durationHours: Number(fields.duration_hours),
          isDisabled: fields.is_disabled,
          disabledReason: Buffer.from(fields.disabled_reason).toString() || null,
          totalPurchases: Number(fields.total_purchases),
          totalGrossMist: fields.total_gross_mist.toString(),
          thumbnailVideoId: Buffer.from(fields.thumbnail_video_id).toString(),
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
    return {
      encryptedUrl: Buffer.from(fields.encrypted_url).toString(),
      iv: Buffer.from(fields.iv).toString(),
      authTag: Buffer.from(fields.auth_tag).toString(),
    };
  } catch (error) {
    console.error("Error fetching encrypted data:", error);
    return null;
  }
}

export async function checkAccess(campaignId: string, buyerAddress: string): Promise<{ hasAccess: boolean; expiresAt: string | null }> {
  try {
    const obj = await suiClient.getObject({
      id: campaignId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType !== "moveObject") {
      return { hasAccess: false, expiresAt: null };
    }

    // Check dynamic fields for access record
    const dynamicFields = await suiClient.getDynamicFields({
      parentId: campaignId,
    });

    const accessField = dynamicFields.data.find(
      (field) => field.name.value === buyerAddress
    );

    if (!accessField) {
      return { hasAccess: false, expiresAt: null };
    }

    const accessRecord = await suiClient.getObject({
      id: accessField.objectId,
      options: { showContent: true },
    });

    if (accessRecord.data?.content?.dataType !== "moveObject") {
      return { hasAccess: false, expiresAt: null };
    }

    const content = accessRecord.data.content as any;
    const fields = content.fields;
    const expiresAtMs = Number(fields.expiration_timestamp_ms);
    const now = Date.now();

    if (expiresAtMs <= now) {
      return { hasAccess: false, expiresAt: new Date(expiresAtMs).toISOString() };
    }

    return { hasAccess: true, expiresAt: new Date(expiresAtMs).toISOString() };
  } catch (error) {
    console.error("Error checking access:", error);
    return { hasAccess: false, expiresAt: null };
  }
}
