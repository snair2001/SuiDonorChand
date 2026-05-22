/**
 * GET /api/videos/[videoId]/play
 * Returns decrypted embed URL only if user has valid access
 * SECURITY: Decryption happens server-side only
 *
 * Retries access lookup up to 3 times with delay because Pinata IPFS
 * metadata indexing can take a few seconds after upload.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { findActiveAccess, findLatestFileByMetadataName, getJsonFromCid } from "@/lib/pinata";
import { getVideoMetadata } from "@/lib/pinata";
import { decryptText } from "@/lib/encryption";
import { toEmbedUrl, extractYouTubeId } from "@/lib/youtube";
import type { AccessRecord } from "@/lib/pinata";

/** Retry Pinata access lookup — IPFS indexing can lag by a few seconds */
async function findActiveAccessWithRetry(
  viewerAddress: string,
  videoId: string,
  maxRetries = 4,
  delayMs = 2000
): Promise<AccessRecord | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const access = await findActiveAccess(viewerAddress, videoId);
    if (access) return access;

    // Also try searching by a broader pattern in case address differs
    // (e.g. if Slush wallet address was used instead of zkLogin address)
    const altName = `access-${viewerAddress}-${videoId}`;
    const latest = await findLatestFileByMetadataName(altName);
    if (latest) {
      try {
        const record = await getJsonFromCid<AccessRecord>(latest.cid);
        const expiry = new Date(record.accessExpiresAt);
        if (expiry > new Date()) return record;
      } catch { /* continue */ }
    }
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;

      if (!videoId) {
        return NextResponse.json({ error: "Video ID required" }, { status: 400 });
      }

      // Check active access with retry (Pinata indexing lag)
      const access = await findActiveAccessWithRetry(user.suiAddress, videoId);

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
      const rawUrl = decryptText(metadata.encryptedUrl, metadata.iv, metadata.authTag);

      // Extract video ID and convert to safe embed URL
      const ytVideoId = extractYouTubeId(rawUrl);
      if (!ytVideoId) {
        return NextResponse.json({ error: "Invalid video data" }, { status: 500 });
      }

      const embedUrl = toEmbedUrl(ytVideoId);

      return NextResponse.json({
        embedUrl,
        expiresAt: access.accessExpiresAt,
        title: metadata.title,
      });
    } catch (err) {
      console.error("Play video error:", err);
      return NextResponse.json({ error: "Failed to load video" }, { status: 500 });
    }
  });
}
