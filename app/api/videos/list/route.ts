/**
 * GET /api/videos/list
 * Returns videos from the registry (safe metadata only)
 *
 * Query params:
 *   includeSoldOut=true   — include sold-out videos
 *   includeDisabled=true  — include admin-disabled videos (admin use only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveVideos } from "@/lib/videoRegistry";
import { getLatestRegistry } from "@/lib/pinata";
import { mistToSui } from "@/lib/pricing";
import { getThumbnailUrl } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSoldOut = searchParams.get("includeSoldOut") === "true";
    const includeDisabled = searchParams.get("includeDisabled") === "true";

    if (includeSoldOut || includeDisabled) {
      // Return broader set from registry directly
      const registry = await getLatestRegistry();
      let entries = registry.videos;

      if (!includeSoldOut) {
        entries = entries.filter((v) => !v.isSoldOut && v.status === "active");
      }
      if (!includeDisabled) {
        entries = entries.filter((v) => !v.isDisabled);
      }

      const videos = entries.map((entry) => ({
        videoId: entry.videoId,
        cid: entry.cid,
        title: entry.title,
        description: "",
        creatorAddress: entry.creatorAddress,
        creatorEmail: entry.creatorEmail ?? "",
        priceMist: entry.priceMist,
        priceSui: mistToSui(BigInt(entry.priceMist)).toString(),
        durationMs: entry.durationMs,
        durationHours: entry.durationMs / (60 * 60 * 1000),
        revenueCapUsd: parseFloat(process.env.VIDEO_REVENUE_CAP_USD || "20"),
        totalGrossRevenueUsd: 0,
        totalCreatorRevenueUsd: 0,
        totalPlatformRevenueUsd: 0,
        purchaseCount: 0,
        isSoldOut: entry.isSoldOut,
        isDisabled: entry.isDisabled ?? false,
        disabledReason: null,
        disabledAt: null,
        status: entry.status,
        createdAt: entry.createdAt,
        thumbnailUrl: entry.thumbnailVideoId
          ? getThumbnailUrl(entry.thumbnailVideoId)
          : undefined,
      }));

      return NextResponse.json({ videos });
    }

    // Default: active, non-disabled only
    const videos = await getActiveVideos();
    return NextResponse.json({ videos });
  } catch (err) {
    console.error("List videos error:", err);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
