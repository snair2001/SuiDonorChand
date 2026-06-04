/**
 * GET /api/videos/create/check
 * Returns 409 if the user already has an active campaign, 200 if they can create.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getCampaigns } from "@/lib/sui-server";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const allCampaigns = await getCampaigns();
      const active = allCampaigns.filter(
        (c) =>
          c.creatorAddress.toLowerCase() === user.suiAddress.toLowerCase() &&
          !c.isDisabled
      );

      if (active.length > 0) {
        return NextResponse.json(
          {
            canCreate: false,
            error: "You already have an active campaign. Remove it from your dashboard before creating a new one.",
            existingVideoId: active[0].videoId,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ canCreate: true });
    } catch (err) {
      console.error("Create check error:", err);
      // On error, allow creation (fail open — don't block on RPC issues)
      return NextResponse.json({ canCreate: true });
    }
  });
}
