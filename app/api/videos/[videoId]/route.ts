/**
 * GET /api/videos/[videoId]
 * Returns safe public metadata for a specific video
 */

import { NextRequest, NextResponse } from "next/server";
import { getSafeVideoMetadata } from "@/lib/videoRegistry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID required" }, { status: 400 });
    }

    const video = await getSafeVideoMetadata(videoId);

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ video });
  } catch (err) {
    console.error("Get video error:", err);
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    );
  }
}
