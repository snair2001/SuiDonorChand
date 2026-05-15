/**
 * GET /api/videos/list
 * Returns active videos from the registry (safe metadata only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveVideos } from "@/lib/videoRegistry";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSoldOut = searchParams.get("includeSoldOut") === "true";

    const videos = await getActiveVideos();

    // Filter based on query param
    const filtered = includeSoldOut
      ? videos
      : videos.filter((v) => !v.isSoldOut && v.status === "active");

    return NextResponse.json({ videos: filtered });
  } catch (err) {
    console.error("List videos error:", err);
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    );
  }
}
