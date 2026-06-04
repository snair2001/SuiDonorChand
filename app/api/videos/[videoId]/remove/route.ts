/**
 * POST /api/videos/[videoId]/remove
 * Lets the creator hide/remove their own campaign from the marketplace.
 * Marks it as disabled in Pinata metadata so it stops showing up.
 * Only the creator of the video can call this.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getCampaignByVideoId } from "@/lib/sui-server";
import { getVideoMetadata, updateVideoMetadata } from "@/lib/pinata";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;

      // Look up the campaign on-chain to verify ownership
      const campaign = await getCampaignByVideoId(videoId);
      if (!campaign) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      if (campaign.creatorAddress.toLowerCase() !== user.suiAddress.toLowerCase()) {
        return NextResponse.json(
          { error: "Only the creator can remove this video" },
          { status: 403 }
        );
      }

      // Mark as disabled in Pinata metadata
      const result = await getVideoMetadata(videoId);
      if (!result) {
        return NextResponse.json({ error: "Video metadata not found" }, { status: 404 });
      }

      await updateVideoMetadata(
        videoId,
        {
          isDisabled: true,
          disabledReason: "Removed by creator",
          disabledAt: new Date().toISOString(),
          status: "removed" as const,
        },
        result.metadata
      );

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Remove video error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to remove video" },
        { status: 500 }
      );
    }
  });
}
