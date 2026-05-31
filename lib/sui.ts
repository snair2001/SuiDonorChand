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
    return {
      videoId: Buffer.from(fields.video_id).toString(),
      campaignId: obj.data.objectId,
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
