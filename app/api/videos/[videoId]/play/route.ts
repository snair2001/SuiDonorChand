/**
 * GET /api/videos/[videoId]/play
 * Returns decrypted embed URL only if user has valid access
 * SECURITY: Decryption happens server-side only
 *
 * Now checks access via SUI BLOCKCHAIN EVENTS for tamper-proof, non-repudiation!
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getVideoMetadata } from "@/lib/pinata";
import { decryptText } from "@/lib/encryption";
import { toEmbedUrl, extractYouTubeId } from "@/lib/youtube";
import { checkAccessOnChain } from "@/lib/sui";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;
      console.log("[play] Starting play request for:", { videoId, userEmail: user.email, userAddress: user.suiAddress });
      if (!videoId) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

      // 🔒 CHECK ACCESS ON SUI BLOCKCHAIN (tamper-proof!)
      // Try both the zkLogin address and Slush wallet address (if different)
      let accessCheck = await checkAccessOnChain(user.suiAddress, videoId, PACKAGE_ID);
      
      // If no access with primary address, check if there's a wallet connected (we could look up, but for now, trust the client's optimistic check)
      console.log("[play] On-chain access check result:", accessCheck);

      if (!accessCheck.hasAccess) {
        console.log("[play] No access found on-chain—returning 403");
        return NextResponse.json(
          {
            error: "Access denied",
            message: "No active access found. If you just purchased, click Try Again in a few seconds.",
          },
          { status: 403 }
        );
      }

      console.log("[play] Access confirmed via Sui blockchain! Fetching video metadata...");
      const result = await getVideoMetadata(videoId);
      if (!result) return NextResponse.json({ error: "Video not found" }, { status: 404 });

      const { metadata } = result;

      let rawUrl: string;
      try {
        rawUrl = decryptText(metadata.encryptedUrl, metadata.iv, metadata.authTag);
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
        expiresAt: accessCheck.expiresAt,
        title: metadata.title,
      });
    } catch (err) {
      console.error("[play] FATAL Error:", err);
      return NextResponse.json({ error: "Failed to load video" }, { status: 500 });
    }
  });
}
