/**
 * Sui Blockchain Helpers
 * For verifying access via on-chain events and reading objects
 */

import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const SUI_RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC_URL || getFullnodeUrl(SUI_NETWORK as any);

export const suiClient = new SuiClient({ url: SUI_RPC_URL });

export interface AccessPurchaseEvent {
  campaignId: string;
  videoId: string; // as hex string
  buyer: string;
  creator: string;
  platformTreasury: string;
  totalAmountMist: string;
  creatorAmountMist: string;
  platformFeeMist: string;
  platformFeeBps: number;
  durationHours: number;
  expirationTimestampMs: number;
}

/**
 * Find all AccessPurchased events for a given buyer (address)
 */
export async function getAccessEventsForBuyer(
  buyerAddress: string,
  packageId: string
): Promise<AccessPurchaseEvent[]> {
  const events = await suiClient.queryEvents({
    query: {
      MoveEventType: `${packageId}::private_tube::AccessPurchased`,
    },
    limit: 100,
  });

  return events.data
    .filter((event) => {
      const parsed = event.parsedJson as any;
      return parsed.buyer === buyerAddress;
    })
    .map((event) => {
      const parsed = event.parsedJson as any;
      return {
        campaignId: parsed.campaign_id,
        videoId: parsed.video_id, // hex string
        buyer: parsed.buyer,
        creator: parsed.creator,
        platformTreasury: parsed.platform_treasury,
        totalAmountMist: parsed.total_amount_mist,
        creatorAmountMist: parsed.creator_amount_mist,
        platformFeeMist: parsed.platform_fee_mist,
        platformFeeBps: parsed.platform_fee_bps,
        durationHours: parsed.duration_hours,
        expirationTimestampMs: parsed.expiration_timestamp_ms,
      };
    });
}

/**
 * Check if a buyer has active access for a video by checking on-chain events
 */
export async function checkAccessOnChain(
  buyerAddress: string,
  videoId: string,
  packageId: string
): Promise<{ hasAccess: boolean; expiresAt: number | null }> {
  const events = await getAccessEventsForBuyer(buyerAddress, packageId);

  // Convert videoId string to hex bytes (matching Move's vector<u8>)
  const videoIdHex = Buffer.from(videoId, "utf-8").toString("hex");

  // Find events for this video that haven't expired
  const now = Date.now();
  const validEvents = events.filter(
    (event) =>
      event.videoId === videoIdHex && event.expirationTimestampMs > now
  );

  if (validEvents.length === 0) {
    return { hasAccess: false, expiresAt: null };
  }

  // Find the latest expiration time
  const latestExpiration = Math.max(
    ...validEvents.map((e) => e.expirationTimestampMs)
  );

  return { hasAccess: true, expiresAt: latestExpiration };
}
