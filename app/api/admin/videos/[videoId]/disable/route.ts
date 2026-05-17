/**
 * POST /api/admin/videos/[videoId]/disable
 * Admin-only: toggle a campaign's disabled state
 *
 * Body: { disable: boolean, reason?: string }
 *
 * - disable: true  → marks isDisabled=true, hides from marketplace, blocks new purchases
 * - disable: false → re-enables the campaign (isDisabled=false)
 *
 * Existing paid users retain access until their access record expires.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth";
import { getVideoMetadata, uploadJsonToPinata, getLatestRegistry } from "@/lib/pinata";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAdmin(req, async () => {
    try {
      const { videoId } = await params;

      if (!videoId) {
        return NextResponse.json({ error: "Video ID required" }, { status: 400 });
      }

      const body = await req.json();
      const disable: boolean = body.disable === true;
      const reason: string = body.reason?.trim() || (disable ? "Disabled by admin" : "");

      // Fetch current metadata
      const result = await getVideoMetadata(videoId);
      if (!result) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const { metadata } = result;

      // Build updated metadata
      const updatedMetadata = {
        ...metadata,
        isDisabled: disable,
        disabledReason: disable ? reason : null,
        disabledAt: disable ? new Date().toISOString() : null,
      };

      // Upload new metadata version to Pinata
      const newCid = await uploadJsonToPinata(
        updatedMetadata,
        `video-metadata-${videoId}`
      );

      // Update registry entry
      const registry = await getLatestRegistry();
      const entry = registry.videos.find((v) => v.videoId === videoId);
      if (entry) {
        entry.cid = newCid;
        entry.isDisabled = disable;
      }
      await uploadJsonToPinata(registry, "private-tube-registry-latest");

      return NextResponse.json({
        success: true,
        videoId,
        isDisabled: disable,
        disabledReason: disable ? reason : null,
        message: disable
          ? `Campaign disabled: ${reason}`
          : "Campaign re-enabled",
      });
    } catch (err) {
      console.error("Admin disable error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to update campaign" },
        { status: 500 }
      );
    }
  });
}
