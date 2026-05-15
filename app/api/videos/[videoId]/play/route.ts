/**
 * GET /api/videos/[videoId]/play
 * Returns decrypted embed URL only if user has valid access
 * SECURITY: Decryption happens server-side only
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { findActiveAccess } from "@/lib/pinata";
import { getVideoMetadata } from "@/lib/pinata";
import { decryptText } from "@/lib/encryption";
import { toEmbedUrl, extractYouTubeId } from "@/lib/youtube";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;

      if (!videoId) {
        return NextResponse.json(
          { error: "Video ID required" },
          { status: 400 }
        );
      }

      // Check active access
      const access = await findActiveAccess(user.suiAddress, videoId);

      if (!access) {
        return NextResponse.json(
          {
            error: "Access denied",
            message: "You do not have active access to this video",
          },
          { status: 403 }
        );
      }

      // Fetch encrypted video metadata
      const result = await getVideoMetadata(videoId);

      if (!result) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const { metadata } = result;

      // Decrypt YouTube URL server-side
      const rawUrl = decryptText(
        metadata.encryptedUrl,
        metadata.iv,
        metadata.authTag
      );

      // Extract video ID and convert to safe embed URL
      const ytVideoId = extractYouTubeId(rawUrl);
      if (!ytVideoId) {
        return NextResponse.json(
          { error: "Invalid video data" },
          { status: 500 }
        );
      }

      const embedUrl = toEmbedUrl(ytVideoId);

      // Return ONLY the embed URL — never the raw YouTube URL
      return NextResponse.json({
        embedUrl,
        expiresAt: access.accessExpiresAt,
        title: metadata.title,
      });
    } catch (err) {
      console.error("Play video error:", err);
      return NextResponse.json(
        { error: "Failed to load video" },
        { status: 500 }
      );
    }
  });
}
