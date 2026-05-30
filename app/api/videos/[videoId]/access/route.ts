/**
 * GET /api/videos/[videoId]/access
 * Check if the current user has active access to a video
 * NOW VIA SUI BLOCKCHAIN (tamper-proof, non-repudiation!)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { checkAccessOnChain } from "@/lib/sui";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  return withAuth(req, async (user) => {
    try {
      const { videoId } = await params;
      if (!videoId) return NextResponse.json({ error: "Video ID required" }, { status: 400 });

      console.log(`[access] Checking on-chain videoId=${videoId} addr=${user.suiAddress}`);

      const access = await checkAccessOnChain(user.suiAddress, videoId, PACKAGE_ID);

      const isExpired = access.expiresAt ? Date.now() > access.expiresAt : false;

      console.log(`[access] On-chain check result: hasAccess=${access.hasAccess}, isExpired=${isExpired}`);

      return NextResponse.json({
        hasAccess: access.hasAccess && !isExpired,
        expiresAt: access.expiresAt ? new Date(access.expiresAt).toISOString() : null,
        isExpired,
      });
    } catch (err) {
      console.error("Check access error:", err);
      return NextResponse.json({ error: "Failed to check access" }, { status: 500 });
    }
  });
}
