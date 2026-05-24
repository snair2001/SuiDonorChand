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

      console.log(`[access] Checking videoId=${videoId} email=${user.email} addr=${user.suiAddress}`);
      console.log(`[access] emailKey=${emailKey}`);

      const latest =
        (await findLatestFileByMetadataName(emailKey)) ??
        (await findLatestFileByMetadataName(addrKey));

      if (!latest) {
        console.log(`[access] No record found for videoId=${videoId}`);
        return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
      }

      console.log(`[access] Found record CID=${latest.cid}`);

      try {
        const record = await getJsonFromCid<AccessRecord>(latest.cid);
        console.log(`[access] Record videoId=${record.videoId} expiresAt=${record.accessExpiresAt}`);

        // Validate the record actually belongs to this video
        if (record.videoId !== videoId) {
          console.log(`[access] videoId mismatch: record has ${record.videoId}, requested ${videoId}`);
          return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
        }

        const now = new Date();
        const expiry = new Date(record.accessExpiresAt);
        const isExpired = expiry <= now;

        console.log(`[access] hasAccess=${!isExpired} isExpired=${isExpired}`);
        return NextResponse.json({
          hasAccess: !isExpired,
          expiresAt: record.accessExpiresAt,
          isExpired,
        });
      } catch (e) {
        console.error(`[access] Failed to fetch/parse record:`, e);
        return NextResponse.json({ hasAccess: false, expiresAt: null, isExpired: false });
      }
    } catch (err) {
      console.error("Check access error:", err);
      return NextResponse.json({ error: "Failed to check access" }, { status: 500 });
    }
  });
}
