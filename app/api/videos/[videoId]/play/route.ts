/**
 * GET /api/videos/[videoId]/play
 * Returns decrypted embed URL only if user has valid access
 * SECURITY: Decryption happens server-side only
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { findLatestFileByMetadataName, getJsonFromCid, getVideoMetadata } from "@/lib/pinata";
import { decryptText } from "@/lib/encryption";
import { toEmbedUrl, extractYouTubeId } from "@/lib/youtube";
import type { AccessRecord } from "@/lib/pinata";

/**
 * Find active access with retries — Pinata metadata indexing lags 5-15s.
 * Tries up to 6 times with 3s delay = up to 18s total wait.
 */
async function findAccessWithRetry(
  viewerAddress: string,
  videoId: string
): Promise<AccessRecord | null> {
  const name = `access-${viewerAddress}-${videoId}`;
  const maxAttempts = 6;
  const delayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[play] Access lookup attempt ${attempt}/${maxAttempts} for ${name}`);

    try {
      const latest = await findLatestFileByMetadataName(name);

      if (latest) {
        const record = await getJsonFromCid<AccessRecord>(latest.cid);
        const expiry = new Date(record.accessExpiresAt);
        if (expiry > new Date()) {
          console.log(`[play] Access found on attempt ${attempt}`);
          return record;
        } else {
          console.log(`[play] Access record found but expired`);
          return null; // expired — no point retrying
        }
      }
    } catch (err) {
      console.warn(`[play] Attempt ${attempt} error:`, err);
    }

    if (attempt < maxAttempts) {
      console.log(`[play] Not found yet, waiting ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`[play] Access not found after ${maxAttempts} attempts`);
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

      console.log(`[play] Checking access for user=${user.suiAddress} video=${videoId}`);

      // Find access with retry
      const access = await findAccessWithRetry(user.suiAddress, videoId);

      if (!access) {
        console.log(`[play] 403 - no valid access found`);
        return NextResponse.json(
          {
            error: "Access denied",
            message: "You do not have active access to this video. If you just purchased, please wait a few seconds and refresh.",
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

      const ytVideoId = extractYouTubeId(rawUrl);
      if (!ytVideoId) {
        return NextResponse.json({ error: "Invalid video data" }, { status: 500 });
      }

      const embedUrl = toEmbedUrl(ytVideoId);

      console.log(`[play] Access granted, returning embed URL`);
      return NextResponse.json({
        embedUrl,
        expiresAt: access.accessExpiresAt,
        title: metadata.title,
      });
    } catch (err) {
      console.error("[play] Error:", err);
      return NextResponse.json({ error: "Failed to load video" }, { status: 500 });
    }
  });
}
