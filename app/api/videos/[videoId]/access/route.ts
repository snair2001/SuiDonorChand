/**
 * GET /api/videos/[videoId]/access
 * Check if the current user has active access to a video
 * Checks by email (primary) and address (fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { findLatestFileByMetadataName, getJsonFromCid } from "@/lib/pinata";
import type { AccessRecord } from "@/lib/pinata";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;
      if (!videoId) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

      const emailKey = `access-email-${user.email.replace(/[@.]/g, "_")}-${videoId}`;
      const addrKey = `access-${user.suiAddress}-${videoId}`;

      const latest =
        (await findLatestFileByMetadataName(emailKey)) ??
        (await findLatestFileByMetadataName(addrKey));

      if (!latest) {
        return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
      }

      try {
        const record = await getJsonFromCid<AccessRecord>(latest.cid);
        const now = new Date();
        const expiry = new Date(record.accessExpiresAt);
        const isExpired = expiry <= now;

        return NextResponse.json({
          hasAccess: !isExpired,
          expiresAt: record.accessExpiresAt,
          isExpired,
        });
      } catch {
        return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
      }
    } catch (err) {
      console.error("Check access error:", err);
      return NextResponse.json({ error: "Failed to check access" }, { status: 500 });
    }
  });
}
