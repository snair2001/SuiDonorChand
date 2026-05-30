/**
 * POST /api/admin/grant-access
 * Grants admin access to a video for testing
 * ADMIN ONLY - checks ADMIN_EMAIL env var
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getVideoMetadata, createAccessRecord, AccessRecord } from "@/lib/pinata";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  console.log("[admin/grant-access] Starting...");
  try {
    const body = await req.json();
    const { videoId } = body;
    if (!videoId) {
      return NextResponse.json({ error: "videoId required" }, { status: 400 });
    }
    console.log("[admin/grant-access] Got request for videoId:", videoId);

    // Get admin email from env
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ error: "Admin not configured" }, { status: 500 });
    }

    // Get session user
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (user.email.toLowerCase() !== adminEmail) {
      return NextResponse.json({ error: "Unauthorized - admin only" }, { status: 403 });
    }

    console.log("[admin/grant-access] User is admin, fetching video metadata...");

    // Fetch video metadata
    const result = await getVideoMetadata(videoId);
    if (!result) {
      console.log("[admin/grant-access] Video not found!");
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const { metadata, cid: videoCid } = result;
    console.log("[admin/grant-access] Got video metadata:", metadata.title);

    // Create access record (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const accessRecord: AccessRecord = {
      accessId: uuidv4(),
      videoId,
      videoCid,
      viewerEmail: user.email,
      viewerAddress: user.suiAddress,
      txDigest: "admin-grant",
      paymentAmountMist: "0",
      paymentAmountUsd: 0,
      creatorAmountUsd: 0,
      platformFeeUsd: 0,
      accessExpiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    console.log("[admin/grant-access] Creating access record:", accessRecord);
    await createAccessRecord(accessRecord);
    console.log("[admin/grant-access] Success!");

    return NextResponse.json({
      success: true,
      message: "Access granted successfully!",
      access: accessRecord,
    });
  } catch (err) {
    console.error("[admin/grant-access] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to grant access" },
      { status: 500 }
    );
  }
}
