/**
 * GET /api/videos/[videoId]/access
 * Check if the current user has active access to a video.
 * Checks on-chain only — Sui blockchain is the source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getCampaignByVideoId, checkAccess as checkOnChainAccess } from "@/lib/sui-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;
      if (!videoId) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

      // Use the actual Slush wallet address if provided (it's the on-chain buyer key).
      // Fall back to session suiAddress for backward compat.
      const walletParam = req.nextUrl.searchParams.get("wallet");
      const buyerAddress = walletParam || user.suiAddress;

      console.log(`[access] Checking access for videoId=${videoId}, addr=${buyerAddress}, email=${user.email}`);

      const campaign = await getCampaignByVideoId(videoId);
      if (!campaign) {
        return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
      }

      const access = await checkOnChainAccess(campaign.campaignId, buyerAddress);
      const isExpired = access.expiresAt ? new Date(access.expiresAt).getTime() <= Date.now() : false;

      console.log(`[access] On-chain result:`, { ...access, isExpired });

      return NextResponse.json({
        hasAccess: access.hasAccess,
        expiresAt: access.expiresAt,
        isExpired,
      });
    } catch (err) {
      console.error("Check access error:", err);
      return NextResponse.json({ error: "Failed to check access" }, { status: 500 });
    }
  });
}
