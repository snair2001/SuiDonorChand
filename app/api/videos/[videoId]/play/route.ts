/**
 * GET /api/videos/[videoId]/play
 * Returns decrypted embed URL only if user has valid on-chain access.
 * SECURITY: Decryption happens server-side only. Sui chain is source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getCampaignByVideoId, getCampaignEncryptedData, checkAccess } from "@/lib/sui-server";
import { decryptText } from "@/lib/encryption";
import { toEmbedUrl, extractYouTubeId } from "@/lib/youtube";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;
      console.log("[play] Starting play request for:", { videoId, userEmail: user.email, userAddress: user.suiAddress });
      if (!videoId) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

      // Get campaign by video ID
      const campaign = await getCampaignByVideoId(videoId);
      if (!campaign) return NextResponse.json({ error: "Video not found" }, { status: 404 });

      // Check if campaign is disabled
      if (campaign.isDisabled) {
        return NextResponse.json({ error: "This video has been disabled" }, { status: 403 });
      }

      // Check on-chain access — single source of truth
      const access = await checkAccess(campaign.campaignId, user.suiAddress);

      if (!access.hasAccess) {
        return NextResponse.json(
          {
            error: "Access denied",
            message: "No active access found. Purchase access to watch this video.",
          },
          { status: 403 }
        );
      }

      console.log("[play] Access confirmed! Fetching encrypted data...");
      const encryptedData = await getCampaignEncryptedData(campaign.campaignId);
      if (!encryptedData) return NextResponse.json({ error: "Video not found" }, { status: 404 });

      let rawUrl: string;
      try {
        rawUrl = decryptText(encryptedData.encryptedUrl, encryptedData.iv, encryptedData.authTag);
      } catch (decryptErr) {
        console.error("[play] Decryption failed:", decryptErr);
        return NextResponse.json({ error: "Failed to decrypt video data" }, { status: 500 });
      }

      const ytVideoId = extractYouTubeId(rawUrl);
      if (!ytVideoId) {
        console.error("[play] extractYouTubeId failed for decrypted URL:", rawUrl?.slice(0, 60));
        return NextResponse.json({ error: "Invalid video data" }, { status: 500 });
      }

      console.log("[play] Success! Returning embed URL");
      return NextResponse.json({
        embedUrl: toEmbedUrl(ytVideoId),
        expiresAt: access.expiresAt,
        title: campaign.title,
      });
    } catch (err) {
      console.error("[play] FATAL Error:", err);
      return NextResponse.json({ error: "Failed to load video" }, { status: 500 });
    }
  });
}
